// Voluntariado lançado à mão: ler a lista do mês e as marcações de um militar, e lançar o mês de um militar.
import { ColetaDoVoluntariado, LancamentoDeVoluntariado, Mes, mesParaData, mesPorExtenso, type FaixaDeDisponibilidade } from 'contratos';
import { Hono, type Context } from 'hono';
import { CADASTRO, GESTAO, exigirPapel, exigirSessao, type AmbienteApi } from '../acesso.ts';
import { exigirLeituraDaEscala } from '../visao/leitura.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco, type Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo, respostaDoErroDoBanco } from '../erros.ts';
import { lerRegistro, mesmasFaixas, registrar } from '../registro.ts';
import { coletaAberta, mensagemColetaFechada, mensagemNaoLotado, mensagemSemEscala, mensagemSoAPartirDe, mudarColeta } from './coleta.ts';
import { lancar, travarMes } from './lancamento.ts';
import { faixasDoMes, lotadosNoMes, meuVoluntariado, temLotacaoNoMes, unidadeDoMilitarNoMes, voluntariadoDoMes, voluntariadoDoMilitar } from './leitura.ts';

const MES_INVALIDO = 'Mês inválido: use o formato aaaa-mm.';

/** As faixas fora do mês pedido: o texto por faixa, no formato do `campos` das respostas 400. */
function faixasForaDoMes(faixas: FaixaDeDisponibilidade[], mes: string): Record<string, string> {
  const campos: Record<string, string> = {};
  faixas.forEach((f, i) => {
    if (f.data.slice(0, 7) !== mes) campos[`faixas.${i}`] = `Use um dia de ${mesPorExtenso(mes)}.`;
  });
  return campos;
}

/** Sem poder ser escalado no mês: a frase certa (sem lotação na seção, ou lotado mas com uma situação que não permite escala); null se pode. */
async function semEscala(banco: Consulta, conta: { militarId: string; unidadeId: string }, mes: string): Promise<string | null> {
  if ((await lotadosNoMes(banco, conta.unidadeId, mes, conta.militarId)).length) return null;
  return (await temLotacaoNoMes(banco, conta.unidadeId, mes, conta.militarId)) ? mensagemSemEscala(mes) : mensagemNaoLotado(mes);
}

/** O militar da conta (a sessão) e a seção em que ele fica no mês; ou a resposta de erro: 404 se a conta não é de um militar, 409 se ele não está lotado. */
async function contaNoMes(c: Context<AmbienteApi>, banco: Consulta, mes: string): Promise<{ militarId: string; unidadeId: string } | Response> {
  const { rows } = await banco.query<{ militar_id: string }>('select militar_id from usuario where id = $1 and ativo', [c.get('usuarioId')]);
  const militarId = rows[0]?.militar_id;
  if (!militarId) return c.json({ erro: 'Esta conta não é de um militar.' }, 404);
  const unidadeId = await unidadeDoMilitarNoMes(banco, militarId, mes);
  if (!unidadeId) return c.json({ erro: mensagemNaoLotado(mes) }, 409);
  return { militarId, unidadeId };
}

export function rotasVoluntariado(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  const sessao = exigirSessao(dep.banco, dep.auth);
  for (const caminho of ['/unidades/:u/voluntariado/*', '/militares/:id/voluntariado/*', '/eu/voluntariado/*']) r.use(caminho, sessao);

  r.get('/unidades/:u/voluntariado/:mes', async (c) => {
    const negado = await exigirLeituraDaEscala(c, c.req.param('u'));
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    return c.json(await voluntariadoDoMes(dep.banco, c.req.param('u'), mes));
  });

  r.get('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const unidadeId = await unidadeDoMilitarNoMes(dep.banco, id, mes);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirLeituraDaEscala(c, unidadeId);
    if (negado) return negado;
    return c.json(await voluntariadoDoMilitar(dep.banco, unidadeId, id, mes));
  });

  /** Lança o mês inteiro do militar (substitui o que havia) e devolve a lista do mês para a tela passar ao próximo. */
  r.put('/militares/:id/voluntariado/:mes', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const unidadeId = await unidadeDoMilitarNoMes(dep.banco, id, mes);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirPapel(c, unidadeId, CADASTRO);
    if (negado) return negado;
    const corpo = await lerCorpo(c, LancamentoDeVoluntariado);
    if (!corpo.ok) return corpo.resposta;
    const campos = faixasForaDoMes(corpo.dados.faixas, mes);
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    if (!(await lotadosNoMes(dep.banco, unidadeId, mes, id)).length) return c.json({ erro: `Este militar não está lotado na seção em ${mesPorExtenso(mes)}.` }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), async (tx) => {
        await travarMes(tx, id, mes);
        // o mês que o próprio militar preencheu só é corrigido com registro (e só se a correção muda alguma faixa); o que o escalante lançou ele mesmo segue sem registro
        const peloMilitar = (await tx.query<{ pelo_militar: boolean }>('select pelo_militar from voluntariado_lancamento where militar_id = $1 and mes = $2::date', [id, mesParaData(mes)])).rows[0]?.pelo_militar === true;
        const antes = peloMilitar ? await faixasDoMes(tx, id, mes) : [];
        await lancar(tx, id, mes, corpo.dados.faixas, c.get('usuarioId'));
        if (!peloMilitar) return;
        const depois = await faixasDoMes(tx, id, mes);
        if (!mesmasFaixas(antes, depois)) await registrar(tx, { usuarioId: c.get('usuarioId'), unidadeId, tipo: 'voluntariado_corrigido', militarId: id, mes, antes, depois });
      });
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await voluntariadoDoMes(dep.banco, unidadeId, mes));
  });

  /** As correções que o escalante fez no voluntariado que o militar marcou, da mais nova para a mais velha. */
  r.get('/militares/:id/voluntariado/:mes/registro', async (c) => {
    const id = c.req.param('id');
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const unidadeId = await unidadeDoMilitarNoMes(dep.banco, id, mes);
    if (!unidadeId) return c.json({ erro: 'Militar não encontrado.' }, 404);
    const negado = await exigirLeituraDaEscala(c, unidadeId);
    if (negado) return negado;
    return c.json(await lerRegistro(dep.banco, { militarId: id, mes, tipo: 'voluntariado_corrigido' }));
  });

  /** O gestor (ou o coordenador, ou o administrador) abre e fecha a coleta do mês da unidade; devolve a lista do mês. */
  r.put('/unidades/:u/voluntariado/:mes/coleta', async (c) => {
    const unidadeId = c.req.param('u');
    const negado = await exigirPapel(c, unidadeId, GESTAO);
    if (negado) return negado;
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const corpo = await lerCorpo(c, ColetaDoVoluntariado);
    if (!corpo.ok) return corpo.resposta;
    const mesAtual = hojeRecife().slice(0, 7);
    // abrir mês que passou não vale; fechar vale sempre (uma coleta esquecida precisa poder ser fechada)
    if (corpo.dados.aberta && mes < mesAtual) return c.json({ erro: `A coleta só abre a partir de ${mesPorExtenso(mesAtual)}.` }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => mudarColeta(tx, unidadeId, mes, corpo.dados.aberta, c.get('usuarioId')));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await voluntariadoDoMes(dep.banco, unidadeId, mes));
  });

  /** O próprio voluntariado do militar no mês: as marcações, os blocos da seção dele e se a coleta está aberta. */
  r.get('/eu/voluntariado/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const conta = await contaNoMes(c, dep.banco, mes);
    if (conta instanceof Response) return conta;
    const mesAtual = hojeRecife().slice(0, 7);
    // mês passado só se lê; de hoje em diante, quem não está lotado na seção no mês não tem o que marcar
    const semGet = mes >= mesAtual ? await semEscala(dep.banco, conta, mes) : null;
    if (semGet) return c.json({ erro: semGet }, 409);
    return c.json(await meuVoluntariado(dep.banco, conta.militarId, conta.unidadeId, mes, mesAtual));
  });

  /** O militar marca o próprio mês (substitui o que havia) enquanto a coleta da seção dele está aberta. */
  r.put('/eu/voluntariado/:mes', async (c) => {
    const mes = c.req.param('mes');
    if (!Mes.safeParse(mes).success) return c.json({ erro: MES_INVALIDO }, 400);
    const corpo = await lerCorpo(c, LancamentoDeVoluntariado);
    if (!corpo.ok) return corpo.resposta;
    const campos = faixasForaDoMes(corpo.dados.faixas, mes);
    if (Object.keys(campos).length) return c.json({ erro: 'Confira os campos destacados.', campos }, 400);
    const mesAtual = hojeRecife().slice(0, 7);
    if (mes < mesAtual) return c.json({ erro: mensagemSoAPartirDe(mesAtual) }, 409);
    const conta = await contaNoMes(c, dep.banco, mes);
    if (conta instanceof Response) return conta;
    const semPut = await semEscala(dep.banco, conta, mes);
    if (semPut) return c.json({ erro: semPut }, 409);
    if (!(await coletaAberta(dep.banco, conta.unidadeId, mes))) return c.json({ erro: mensagemColetaFechada(mes) }, 409);
    try {
      await comUsuario(dep.banco, c.get('usuarioId'), (tx) => lancar(tx, conta.militarId, mes, corpo.dados.faixas, c.get('usuarioId'), 'militar'));
    } catch (e) {
      return respostaDoErroDoBanco(c, e);
    }
    return c.json(await meuVoluntariado(dep.banco, conta.militarId, conta.unidadeId, mes, mesAtual));
  });

  return r;
}
