// POST /api/unidades/:u/importacao/:cadastro — prévia (sem gravar) ou, com ?confirmar=1, gravação.
// Sem estado: a confirmação recebe o mesmo arquivo e refaz o plano antes de gravar.
import { Hono } from 'hono';
import type { ResultadoImportacao } from 'contratos';
import { CADASTRO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerPlanilha, type Aba } from './planilha.ts';
import type { Importador } from './tipos.ts';

export function rotasImportacao(dep: { banco: Banco; auth: Auth }, importadores: Record<string, Importador<unknown>>): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/unidades/:u/importacao/*', exigirSessao(dep.banco, dep.auth));
  r.post('/unidades/:u/importacao/:cadastro', async (c) => {
    const unidadeId = c.req.param('u');
    const imp = importadores[c.req.param('cadastro')];
    const negado = await exigirPapel(c, unidadeId, imp?.papeis ?? CADASTRO);
    if (negado) return negado;
    if (!imp) return c.json({ erro: 'Importação desconhecida.' }, 404);

    const corpo = await c.req.parseBody();
    const arquivo = corpo.arquivo;
    if (!(arquivo instanceof File)) return c.json({ erro: 'Escolha o arquivo .xlsx da planilha.' }, 400);
    let abas: Record<string, Aba>;
    try {
      abas = await lerPlanilha(await arquivo.arrayBuffer());
    } catch {
      return c.json({ erro: 'Não foi possível ler o arquivo. Envie a planilha baixada em .xlsx.' }, 400);
    }
    const falta = imp.abas.find((a) => !(a in abas));
    if (falta) {
      return c.json({ erro: `A planilha não tem a aba "${falta}". Baixe a sandbox inteira em .xlsx (Arquivo › Fazer download).` }, 400);
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
