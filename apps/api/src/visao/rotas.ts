// A borda das camadas de visão e a marca "de oficiais" dos quadros (entrega 6.11): só o administrador lê e ajusta. Nada aqui dá permissão de gravar
// a quem apenas vê.
import { MarcaDeOficiais, NovaBorda } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { lerQuadros } from '../cadastros/quadros.ts';
import { lerCorpo } from '../erros.ts';
import { hojeRecife } from '../datas.ts';
import { limitarPorConta } from '../limites.ts';
import { buscarMilitares, fichaDeConsulta, unidadesDaConsulta } from './consulta.ts';
import { carregarBorda, lerBorda } from './visao.ts';

const SO_ADMINISTRADOR = 'Só o administrador do sistema ajusta quem vê o quê.';
const MSG_IDENTIFICACAO = 'A identificação de “todos” não se desliga: sem ela a consulta não mostra nada.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rotasVisao(dep: { banco: Banco; auth: Auth; limiteDeBuscas?: number }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/visao', '/quadros/:id', '/consulta/*']) r.use(caminho, sessao);

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
    // as camadas se somam: o que "todos" vê o oficial e o quinto nível também veem (a tela marca e trava as outras duas)
    const linhas = corpo.dados.map((l) => (l.todos ? { ...l, oficial: true, gestorLateral: true } : l));
    await comUsuario(c.get('banco'), c.get('usuarioId'), async (tx) => {
      const atual = await carregarBorda(tx);
      for (const l of linhas) {
        for (const [camada, ve] of [['todos', l.todos], ['oficial', l.oficial], ['gestor_lateral', l.gestorLateral]] as const) {
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

  // --- a consulta de militares: para toda pessoa com conta; o que cada uma vê vem da borda (visao.ts), e nenhuma rota daqui grava ---
  const MSG_BUSCA = 'Digite pelo menos 3 letras ou escolha uma unidade.';

  r.get('/consulta/unidades', async (c) => c.json(await unidadesDaConsulta(c.get('banco'), hojeRecife())));

  // a busca é a rota que se varre (a ficha pede um militar por vez): 30 por minuto por conta; a exportação completa do banco não passa por aqui
  const limiteDaBusca = limitarPorConta({ max: dep.limiteDeBuscas ?? 30, janelaMs: 60_000, mensagem: 'Muitas buscas em pouco tempo. Espere um minuto e tente de novo.' });
  r.get('/consulta/militares', limiteDaBusca, async (c) => {
    const texto = (c.req.query('texto') ?? '').trim();
    const unidadeId = c.req.query('unidadeId') || null;
    if (texto.length < 3 && !unidadeId) return c.json({ erro: MSG_BUSCA }, 400);
    if (unidadeId && !(UUID.test(unidadeId) && (await c.get('banco').query('select 1 from unidade where id = $1', [unidadeId])).rows.length)) {
      return c.json({ erro: 'Unidade não encontrada.' }, 404);
    }
    return c.json(await buscarMilitares(c.get('banco'), { texto, unidadeId, hoje: hojeRecife() }));
  });

  r.get('/consulta/militares/:id', async (c) => {
    const id = c.req.param('id');
    const ficha = UUID.test(id) ? await fichaDeConsulta(c.get('banco'), c.get('usuarioId'), id, hojeRecife()) : null;
    return ficha ? c.json(ficha) : c.json({ erro: 'Militar não encontrado.' }, 404);
  });

  return r;
}
