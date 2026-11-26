// Primeiro acesso e "Esqueci minha senha": o militar pede um código ao e-mail institucional da ficha e, com ele, cria a senha. As duas rotas são públicas (sem sessão).
// A resposta do pedido nunca revela se o e-mail está numa ficha: mesma frase, mesmo código de resposta, e o envio sai depois dela.
import { FRASE_DO_PEDIDO, MSG_ENVIO_FORA_DO_AR, MSG_MUITOS_PEDIDOS, PedidoDeCodigo } from 'contratos';
import { Hono } from 'hono';
import type { Banco, Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { mensagemDoCodigo, resumir, sortearCodigo } from './codigo.ts';
import { aposResponder, type EnviarEmail } from './enviar-email.ts';

/** O código vale 15 minutos. */
export const VALIDADE_DO_CODIGO_MS = 15 * 60_000;
const LIMITE_DO_ENDERECO_POR_HORA = 3;
const LIMITE_DO_ENDERECO_POR_DIA = 6;
const LIMITE_DA_ORIGEM_POR_HORA = 10;
/** O plano gratuito do Brevo envia 300 por dia: com 280, o envio fica fora do ar até a meia-noite (Recife). */
const COTA_DO_DIA = 280;

export interface DependenciasDoAcessoPorEmail {
  banco: Banco;
  /** A chave dos resumos (HMAC) do código, do e-mail e da origem: o `BETTER_AUTH_SECRET`. */
  segredo: string;
  /** `null`: o envio está fora do ar (sem chave do Brevo). */
  enviarEmail: EnviarEmail | null;
  agora?: () => Date;
}

/** O primeiro valor de `x-forwarded-for` (o endereço de rede de quem pediu); sem o cabeçalho, não há origem para limitar. */
function origemDoPedido(cabecalho: string | undefined): string | null {
  const primeiro = cabecalho?.split(',')[0]?.trim();
  return primeiro || null;
}

/** O militar da ficha que recebe o código: o e-mail institucional é o digitado (sem diferenciar maiúsculas) e o acesso não está desativado. */
async function quemRecebe(c: Consulta, email: string): Promise<{ id: string; email: string } | null> {
  return (
    (await c.query<{ id: string; email: string }>(
      'select m.id, m.email from militar m left join usuario u on u.militar_id = m.id where lower(m.email) = $1 and (u.id is null or u.ativo) limit 1',
      [email],
    )).rows[0] ?? null
  );
}

type Resultado = { tipo: 'limite' } | { tipo: 'fora-do-ar' } | { tipo: 'ok'; pedidoId: string; destino: { militarId: string; email: string; codigo: string } | null };

export function rotasAcessoPorEmail(dep: DependenciasDoAcessoPorEmail): Hono {
  const r = new Hono();
  const { banco, segredo } = dep;
  const agora = dep.agora ?? (() => new Date());

  r.post('/acesso/codigo', async (c) => {
    const corpo = await lerCorpo(c, PedidoDeCodigo);
    if (!corpo.ok) return corpo.resposta;
    // sem chave do Brevo, o envio está fora do ar para todos: cadastrados ou não
    if (!dep.enviarEmail) return c.json({ erro: MSG_ENVIO_FORA_DO_AR }, 503);
    const email = corpo.dados.email.toLowerCase();
    const emailResumo = resumir(email, segredo);
    const origem = origemDoPedido(c.req.header('x-forwarded-for'));
    const origemResumo = origem ? resumir(origem, segredo) : null;
    const agoraEm = agora();
    const dia = hojeRecife(agoraEm);

    const resultado: Resultado = await banco.transacao(async (tx) => {
      // dois pedidos do mesmo endereço ao mesmo tempo contam um depois do outro
      await tx.query('select pg_advisory_xact_lock(hashtext($1))', [emailResumo]);
      // a cota conta os envios de hoje (fuso de Recife); o resto, as janelas móveis de uma hora e de 24 horas (a consulta olha as últimas 48 horas, que cobrem o dia de Recife inteiro)
      const conta = (await tx.query<{ no_dia: string; email_hora: string; email_dia: string; origem_hora: string }>(
        `select count(*) filter (where situacao in ('enviado', 'concluido') and criado_em >= $4::date::timestamp at time zone 'America/Recife'
                                  and criado_em < ($4::date + 1)::timestamp at time zone 'America/Recife') as no_dia,
                count(*) filter (where email_resumo = $1 and criado_em > $3::timestamptz - interval '1 hour') as email_hora,
                count(*) filter (where email_resumo = $1 and criado_em > $3::timestamptz - interval '24 hours') as email_dia,
                count(*) filter (where origem_resumo = $2 and criado_em > $3::timestamptz - interval '1 hour') as origem_hora
           from pedido_de_codigo where criado_em > $3::timestamptz - interval '48 hours'`,
        [emailResumo, origemResumo, agoraEm.toISOString(), dia],
      )).rows[0]!;
      if (Number(conta.no_dia) >= COTA_DO_DIA) return { tipo: 'fora-do-ar' };
      if (Number(conta.email_hora) >= LIMITE_DO_ENDERECO_POR_HORA || Number(conta.email_dia) >= LIMITE_DO_ENDERECO_POR_DIA || (origemResumo && Number(conta.origem_hora) >= LIMITE_DA_ORIGEM_POR_HORA)) {
        return { tipo: 'limite' };
      }
      // o código é sorteado e resumido sempre, exista a ficha ou não: o trabalho da resposta é o mesmo
      const codigo = sortearCodigo();
      const codigoResumo = resumir(codigo, segredo);
      const militar = await quemRecebe(tx, email);
      const pedidoId = (await tx.query<{ id: string }>(
        'insert into pedido_de_codigo (email_resumo, origem_resumo, militar_id, situacao, criado_em) values ($1, $2, $3, $4, $5) returning id',
        [emailResumo, origemResumo, militar?.id ?? null, militar ? 'enviado' : 'nao_enviado', agoraEm.toISOString()],
      )).rows[0]!.id;
      if (!militar) return { tipo: 'ok', pedidoId, destino: null };
      // um código vivo por militar: o pedido novo substitui o anterior
      await tx.query(
        `insert into codigo_de_acesso (militar_id, pedido_id, codigo_resumo, vale_ate, tentativas) values ($1, $2, $3, $4, 0)
         on conflict (militar_id) do update set pedido_id = excluded.pedido_id, codigo_resumo = excluded.codigo_resumo, vale_ate = excluded.vale_ate, tentativas = 0`,
        [militar.id, pedidoId, codigoResumo, new Date(agoraEm.getTime() + VALIDADE_DO_CODIGO_MS).toISOString()],
      );
      return { tipo: 'ok', pedidoId, destino: { militarId: militar.id, email: militar.email, codigo } };
    });

    if (resultado.tipo === 'fora-do-ar') return c.json({ erro: MSG_ENVIO_FORA_DO_AR }, 503);
    if (resultado.tipo === 'limite') return c.json({ erro: MSG_MUITOS_PEDIDOS }, 429);
    const { destino, pedidoId } = resultado;
    if (destino) {
      const enviar = dep.enviarEmail;
      // o envio sai depois da resposta; se falhar, o pedido fica "falhou" (sem o código) e o código vivo some, porque ninguém o recebeu
      aposResponder(
        (async () => {
          try {
            await enviar({ para: destino.email, ...mensagemDoCodigo(destino.codigo) });
          } catch {
            await banco.transacao(async (tx) => {
              await tx.query("update pedido_de_codigo set situacao = 'falhou' where id = $1", [pedidoId]);
              await tx.query('delete from codigo_de_acesso where militar_id = $1 and pedido_id = $2', [destino.militarId, pedidoId]);
            });
          }
        })(),
      );
    }
    return c.json({ mensagem: FRASE_DO_PEDIDO }, 202);
  });

  return r;
}
