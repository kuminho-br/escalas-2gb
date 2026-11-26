// Primeiro acesso e "Esqueci minha senha": o militar pede um código ao e-mail institucional da ficha e, com ele, cria a senha. As duas rotas são públicas (sem sessão).
// A resposta do pedido nunca revela se o e-mail está numa ficha: mesma frase, mesmo código de resposta, e o envio sai depois dela.
import { hashPassword } from 'better-auth/crypto';
import { FRASE_DO_PEDIDO, MSG_CODIGO_INVALIDO, MSG_ENVIO_FORA_DO_AR, MSG_MUITOS_PEDIDOS, PedidoDeCodigo, SenhaPeloCodigo } from 'contratos';
import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { Banco, Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { EmailEmUso, garantirUsuario, MSG_EMAIL_EM_USO } from '../usuarios/rotas.ts';
import { mensagemDoCodigo, resumir, sortearCodigo } from './codigo.ts';
import { aposResponder, type EnviarEmail } from './enviar-email.ts';

/** O código vale 15 minutos. */
export const VALIDADE_DO_CODIGO_MS = 15 * 60_000;
const LIMITE_DO_ENDERECO_POR_HORA = 3;
const LIMITE_DO_ENDERECO_POR_DIA = 6;
const LIMITE_DA_ORIGEM_POR_HORA = 10;
/** O plano gratuito do Brevo envia 300 por dia: com 280, o envio fica fora do ar até a meia-noite (Recife). */
const COTA_DO_DIA = 280;
/** Na quinta tentativa errada o código morre, e a pessoa pede outro. */
const TENTATIVAS_DO_CODIGO = 5;

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

const iguais = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

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

  r.post('/acesso/senha', async (c) => {
    const corpo = await lerCorpo(c, SenhaPeloCodigo);
    if (!corpo.ok) return corpo.resposta;
    const { codigo, novaSenha } = corpo.dados;
    const email = corpo.dados.email.toLowerCase();
    const invalido = () => c.json({ erro: MSG_CODIGO_INVALIDO, campos: { codigo: MSG_CODIGO_INVALIDO } }, 400);
    // o hash custa o mesmo com o código certo ou errado
    const hash = await hashPassword(novaSenha);
    const agoraEm = agora();
    let resultado: 'ok' | 'invalido' | 'email-em-uso';
    try {
      resultado = await banco.transacao(async (tx) => {
        const militar = await quemRecebe(tx, email);
        if (!militar) return 'invalido';
        // um uso de cada vez: o código fica travado até o fim desta transação
        const vivo = (await tx.query<{ pedido_id: string; codigo_resumo: string; tentativas: number; vale: boolean }>(
          'select pedido_id, codigo_resumo, tentativas, vale_ate >= $2::timestamptz as vale from codigo_de_acesso where militar_id = $1 for update',
          [militar.id, agoraEm.toISOString()],
        )).rows[0];
        if (!vivo || !vivo.vale || vivo.tentativas >= TENTATIVAS_DO_CODIGO) return 'invalido';
        if (!iguais(vivo.codigo_resumo, resumir(codigo, segredo))) {
          // a tentativa errada fica gravada (a transação termina normalmente); na quinta, o código morre
          if (vivo.tentativas + 1 >= TENTATIVAS_DO_CODIGO) await tx.query('delete from codigo_de_acesso where militar_id = $1', [militar.id]);
          else await tx.query('update codigo_de_acesso set tentativas = tentativas + 1 where militar_id = $1', [militar.id]);
          return 'invalido';
        }
        const usuarioId = await garantirUsuario(tx, militar.id);
        // o ficha tem e-mail (foi por ele que o código chegou), então o usuário existe ou foi criado agora
        if (!usuarioId) return 'invalido';
        // a auditoria registra a própria pessoa como autora da troca
        await tx.query("select set_config('app.usuario_id', $1, true)", [usuarioId]);
        const conta = (await tx.query<{ id: string }>("select id from conta where usuario_id = $1 and provedor_id = 'credential'", [usuarioId])).rows[0];
        if (conta) await tx.query('update conta set senha = $2, atualizado_em = now() where id = $1', [conta.id, hash]);
        else await tx.query("insert into conta (usuario_id, conta_id, provedor_id, senha) values ($1, $2, 'credential', $3)", [usuarioId, usuarioId, hash]);
        // a senha provisória pendente deixa de valer, e quem tinha sessão aberta (com ela ou com a senha esquecida) sai
        await tx.query('update usuario set senha_provisoria_ate = null, atualizado_em = now() where id = $1', [usuarioId]);
        await tx.query('delete from sessao where usuario_id = $1', [usuarioId]);
        await tx.query('delete from codigo_de_acesso where militar_id = $1', [militar.id]);
        await tx.query("update pedido_de_codigo set situacao = 'concluido', concluido_em = $2 where id = $1", [vivo.pedido_id, agoraEm.toISOString()]);
        return 'ok';
      });
    } catch (e) {
      if (!(e instanceof EmailEmUso)) throw e;
      resultado = 'email-em-uso';
    }
    if (resultado === 'email-em-uso') return c.json({ erro: MSG_EMAIL_EM_USO, campos: { email: MSG_EMAIL_EM_USO } }, 409);
    if (resultado === 'invalido') return invalido();
    // a senha não pode ficar guardada em nenhum cache
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: true });
  });

  return r;
}
