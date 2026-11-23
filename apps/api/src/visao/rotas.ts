// A borda das camadas de visão e a marca "de oficiais" dos quadros (entrega 6.11): só o administrador lê e ajusta. Nada aqui dá permissão de gravar
// a quem apenas vê.
import { MarcaDeOficiais, NovaBorda } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerQuadros } from '../cadastros/quadros.ts';
import { lerCorpo } from '../erros.ts';
import { carregarBorda, lerBorda } from './visao.ts';

const SO_ADMINISTRADOR = 'Só o administrador do sistema ajusta quem vê o quê.';
const MSG_IDENTIFICACAO = 'A identificação de “todos” não se desliga: sem ela a consulta não mostra nada.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rotasVisao(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/visao', '/quadros/:id']) r.use(caminho, sessao);

  r.get('/visao', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMINISTRADOR);
    if (negado) return negado;
    return c.json(await lerBorda(c.get('banco')));
  });

  r.put('/visao', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMINISTRADOR);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaBorda);
    if (!corpo.ok) return corpo.resposta;
    if (!corpo.dados.find((l) => l.bloco === 'identificacao')!.todos) return c.json({ erro: MSG_IDENTIFICACAO }, 400);
    // as camadas se somam: o que "todos" vê o oficial e o chefe de divisão também veem (a tela marca e trava as outras duas)
    const linhas = corpo.dados.map((l) => (l.todos ? { ...l, oficial: true, chefeDivisao: true } : l));
    await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) => {
      const atual = await carregarBorda(tx);
      for (const l of linhas) {
        for (const [camada, ve] of [['todos', l.todos], ['oficial', l.oficial], ['chefe_divisao', l.chefeDivisao]] as const) {
          // só as marcas que mudaram: a auditoria registra uma linha por mudança, e não 21 a cada "Salvar"
          if (atual[camada].has(l.bloco) !== ve) await tx.query('update visao_bloco set ve = $3 where bloco = $1 and camada = $2', [l.bloco, camada, ve]);
        }
      }
    });
    return c.json(await lerBorda(c.get('banco')));
  });

  // a marca "de oficiais" de um quadro: quem está nele tem a camada do oficial
  r.patch('/quadros/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMINISTRADOR);
    if (negado) return negado;
    const corpo = await lerCorpo(c, MarcaDeOficiais);
    if (!corpo.ok) return corpo.resposta;
    const id = c.req.param('id');
    const atual = UUID.test(id) ? (await lerQuadros(c.get('banco'), id))[0] : undefined;
    if (!atual) return c.json({ erro: 'Quadro não encontrado.' }, 404);
    if (atual.oficial !== corpo.dados.oficial) await comUsuario(c.get('banco'), c.get('usuarioId'), (tx) => tx.query('update quadro set oficial = $2 where id = $1', [id, corpo.dados.oficial]));
    return c.json((await lerQuadros(c.get('banco'), id))[0]!);
  });

  return r;
}
