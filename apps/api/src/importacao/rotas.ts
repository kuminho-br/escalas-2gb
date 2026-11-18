// GET /api/unidades/:u/importacao/:cadastro/modelo — planilha em branco, com a ajuda.
// POST /api/unidades/:u/importacao/:cadastro — prévia (sem gravar) ou, com ?confirmar=1, gravação.
// Sem estado: a confirmação recebe o mesmo arquivo e refaz o plano antes de gravar.
import { Hono } from 'hono';
import type { ResultadoImportacao } from 'contratos';
import { CADASTRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { gerarModelo } from './modelo.ts';
import { lerPlanilha, type Aba } from './planilha.ts';
import type { Importador } from './tipos.ts';

export function rotasImportacao(dep: { banco: Banco; auth: Auth }, importadores: Record<string, Importador<unknown>>): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/unidades/:u/importacao/*', exigirSessao(dep.banco, dep.auth));
  r.get('/unidades/:u/importacao/:cadastro/modelo', async (c) => {
    const unidadeId = c.req.param('u');
    const cadastro = c.req.param('cadastro');
    const imp = importadores[cadastro];
    const negado = await exigirPapel(c, unidadeId, imp?.papeis ?? CADASTRO);
    if (negado) return negado;
    if (!imp) return c.json({ erro: 'Importação desconhecida.' }, 404);
    const arquivo = await dep.banco.transacao(async (tx) => {
      await tx.query('set transaction read only');
      return gerarModelo(imp, { tx, unidadeId, hoje: hojeRecife() });
    });
    return c.body(arquivo, 200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="modelo-${cadastro}.xlsx"`,
    });
  });
  r.post('/unidades/:u/importacao/:cadastro', async (c) => {
    const unidadeId = c.req.param('u');
    const imp = importadores[c.req.param('cadastro')];
    const negado = await exigirPapel(c, unidadeId, imp?.papeis ?? CADASTRO);
    if (negado) return negado;
    if (!imp) return c.json({ erro: 'Importação desconhecida.' }, 404);

    // formulário quebrado (sem fronteira, truncado) é erro de quem enviou, não da API
    const corpo = await c.req.parseBody().catch(() => null);
    const arquivo = corpo?.arquivo;
    if (!(arquivo instanceof File)) return c.json({ erro: 'Escolha o arquivo .xlsx da planilha.' }, 400);
    let abas: Record<string, Aba>;
    try {
      abas = await lerPlanilha(await arquivo.arrayBuffer());
    } catch {
      return c.json({ erro: 'Não foi possível ler o arquivo. Se ele veio da sandbox inteira, o Google Planilhas pode ter exportado com defeito: baixe o modelo e cole só as abas nele.' }, 400);
    }
    const falta = imp.abas.find((a) => !(a in abas));
    if (falta) {
      return c.json({ erro: `A planilha não tem a aba "${falta}". Baixe o modelo na tela de importação e cole os dados nele, ou confira o nome da aba.` }, 400);
    }

    const hoje = hojeRecife();
    if (c.req.query('confirmar') !== '1') {
      const previa = await dep.banco.transacao(async (tx) => {
        await tx.query('set transaction read only');
        return (await imp.planejar(abas, { tx, unidadeId, hoje })).previa;
      });
      return c.json(previa);
    }
    const resultado: ResultadoImportacao = await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
      const ctx = { tx, unidadeId, hoje };
      const { previa, plano } = await imp.planejar(abas, ctx);
      return { ...previa, gravados: await imp.aplicar(plano, ctx) };
    });
    return c.json(resultado);
  });
  return r;
}
