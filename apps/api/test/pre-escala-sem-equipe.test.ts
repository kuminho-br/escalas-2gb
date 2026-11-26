import { somarMeses } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { planejarPreEscala } from '../src/escala/pre-escala.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { inserir } from './banco-teste.ts';

// O aviso da prévia da pré-escala: militares do Pronto lotados na seção no mês, sem equipe do ciclo, não entram no turno; a prévia diz quem são.
// Cenário fictício (D7): a seção com as quatro equipes do ciclo e uma quinta, fora do ciclo; Pronto A e B; uma escala.
let api: ApiDeTeste;
let escala: string;
let posto: string;
let alfa: string;
let fora: string;
let secaoB: string;
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
let seq = 0;

async function militar(nome: string, p: { unidadeId?: string; equipeId?: string | null; jornada?: 'pronto' | 'adm'; desde?: string; ate?: string | null; situacaoId?: string }) {
  seq++;
  const id = await inserir(api.banco, 'militar', { matricula: `99${String(6000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, antiguidade: 100 + seq });
  await inserir(api.banco, 'rastreio', {
    militar_id: id, unidade_id: p.unidadeId ?? api.ids.secao, equipe_id: p.equipeId ?? null, jornada: p.jornada ?? 'pronto', desde: p.desde ?? `${atual}-01`, ate: p.ate ?? null,
    ...(p.situacaoId ? { situacao_id: p.situacaoId } : {}),
  });
  return id;
}
const avisoDe = async () => (await planejarPreEscala(api.banco, escala, mes, alfa)).previa.avisos.filter((a) => /sem equipe/.test(a));

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-PE', nome: 'Soldado PE', ordem: 940 });
  const ids: string[] = [];
  for (const [i, nome] of ['Alfa', 'Bravo', 'Charlie', 'Delta'].entries()) ids.push(await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome, ordem_ciclo: i + 1 }));
  alfa = ids[0]!;
  fora = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Extra', ordem_ciclo: 5 });
  secaoB = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  const s = (await (await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/servicos`, { nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
  await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'A', inicio: '08:00', fim: '20:00' });
  await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'B', inicio: '20:00', fim: '08:00' });
  escala = (await (await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Ordinário' })).json()).id as string;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [s.id] })).status).toBe(200);
  await militar('COMEQUIPE', { equipeId: alfa });
});
afterAll(async () => {
  await api.fechar();
});

describe('o aviso de quem está sem equipe', () => {
  it('sem ninguém sem equipe, a prévia não traz o aviso', async () => {
    expect(await avisoDe()).toEqual([]);
  });

  it('um militar do Pronto sem equipe: o aviso diz o posto e o nome dele (singular)', async () => {
    await militar('SEMEQUIPE', {});
    expect(await avisoDe()).toEqual(['1 militar do Pronto está sem equipe e não entra na pré-escala: SD-PE SEMEQUIPE.']);
  });

  it('quem está numa equipe fora do ciclo também não entra: o aviso lista os dois (plural), na ordem do posto e do nome', async () => {
    await militar('ABCFORA', { equipeId: fora });
    expect(await avisoDe()).toEqual(['2 militares do Pronto estão sem equipe e não entram na pré-escala: SD-PE ABCFORA, SD-PE SEMEQUIPE.']);
  });

  it('a chegada marcada para o meio do mês, sem equipe, também aparece (o caso da mudança de seção para dezembro)', async () => {
    await militar('CHEGADA', { desde: `${mes}-10` });
    expect((await avisoDe())[0]).toMatch(/^3 militares .*CHEGADA/);
  });

  it('não entram no aviso: o Adm sem equipe, quem já saiu antes do mês, quem só chega depois dele, quem não pode ser escalado e quem é de outra seção', async () => {
    const antes = (await avisoDe())[0];
    await militar('DOADM', { jornada: 'adm' });
    await militar('JASAIU', { desde: `${atual}-01`, ate: `${atual}-20` });
    await militar('SOMESQUE', { desde: `${somarMeses(mes, 1)}-01` });
    await militar('DEOUTRA', { unidadeId: secaoB });
    const inativa = await inserir(api.banco, 'situacao_militar', { nome: 'Sem escala (teste)', escalavel: false, ativo: true });
    await militar('NAOESCALA', { situacaoId: inativa });
    expect((await avisoDe())[0]).toBe(antes);
  });

  it('a prévia ainda gera para quem tem equipe, e o aviso não impede de gravar', async () => {
    const { previa, novas } = await planejarPreEscala(api.banco, escala, mes, alfa);
    expect(previa.entramNoTurno).toBeGreaterThan(0);
    expect(novas.length).toBeGreaterThan(0);
  });
});
