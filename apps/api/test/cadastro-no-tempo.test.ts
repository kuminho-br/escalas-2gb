import type { Candidatos, FichaMilitar, GradeDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { elegiveisDoMes } from '../src/oficiais/participantes.ts';
import { inserir, situacaoDoMilitar } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Cenário fictício (D7), dezembro de 2026. O quadro e a situação valem por período: MUDOU é QBMG até o dia 14 e QOA a partir do 15;
// RESERVA fica Ativa até o dia 9 e em Reserva a partir do 10.
let api: ApiDeTeste;
let escala: string;
let alfa: string;
let pronto: { id: string; a: string };
const militar: Record<string, string> = {};
const quadro: Record<string, string> = {};
const posto: Record<string, string> = {};
const MES = '2026-12';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;

async function criar(nome: string, postoSigla: string, periodos: { desde: string; ate?: string; quadro: string | null; situacao?: string }[]) {
  const id = await inserir(api.banco, 'militar', { matricula: `99${1400 + Object.keys(militar).length + 1}-${(Object.keys(militar).length + 1) % 10}`, posto_grad_id: posto[postoSigla], nome_guerra: nome, antiguidade: Object.keys(militar).length + 1 });
  militar[nome] = id;
  for (const p of periodos) {
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: api.ids.secao, equipe_id: alfa, jornada: 'pronto', desde: p.desde, ate: p.ate ?? null,
      quadro_id: p.quadro ? quadro[p.quadro] : null, situacao_id: await situacaoDoMilitar(api.banco, p.situacao ?? 'Ativa'),
    });
  }
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  for (const p of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows) posto[p.sigla] = p.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  alfa = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', tipo: 'pronto', posicao_ciclo: 1 });
  const s = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  pronto = { id: s, a: await inserir(api.banco, 'turno', { servico_id: s, letra: 'A', inicio: '08:00', fim: '20:00' }) };
  escala = await inserir(api.banco, 'escala', { unidade_id: api.ids.secao, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(api.banco, 'escala_servico', { escala_id: escala, servico_id: s, ordem: 1 }, 'escala_id');
  await criar('PRACA', 'SD', [{ desde: '2026-11-01', quadro: 'QBMG' }]);
  await criar('MUDOU', 'CAP', [{ desde: '2026-11-01', ate: dia(14), quadro: 'QBMG' }, { desde: dia(15), quadro: 'QOA' }]);
  await criar('RESERVA', 'SD', [{ desde: '2026-11-01', ate: dia(9), quadro: 'QBMG' }, { desde: dia(10), quadro: 'QBMG', situacao: 'Reserva' }]);
  await inserir(api.banco, 'alocacao', { militar_id: militar.RESERVA, escala_id: escala, servico_id: pronto.id, turno_id: pronto.a, data: dia(5), origem: 'manual' });
});
afterAll(async () => {
  await api.fechar();
});

const candidatos = async (data: string): Promise<string[]> => {
  const q = new URLSearchParams({ data, inicio: '08:00', fim: '20:00' });
  const c: Candidatos = await (await api.pedir('escalante', 'GET', `/api/escalas/${escala}/mes/${MES}/candidatos?${q}`)).json();
  return [...c.aptos, ...c.semVoluntariado].map((x) => x.nomeGuerra).sort();
};
const grade = async (mes = MES): Promise<GradeDoMes> => (await api.pedir('escalante', 'GET', `${secao()}/grade/${mes}`)).json();
const nomesDaGrade = (g: GradeDoMes) => g.grupos.flatMap((x) => x.linhas.map((l) => l.nomeGuerra)).sort();

describe('o quadro por período', () => {
  it('QBMG até o dia 14 e QOA a partir do 15: candidato de praça no dia 10, e não no dia 20', async () => {
    expect(await candidatos(dia(10))).toContain('MUDOU');
    expect(await candidatos(dia(20))).not.toContain('MUDOU');
    expect(await candidatos(dia(20))).toContain('PRACA');
  });

  it('aparece na Grade das praças no mês da mudança (o período de QBMG está nele)', async () => {
    expect(nomesDaGrade(await grade())).toContain('MUDOU');
  });

  it('entra na escala dos oficiais só com os dias a partir do 15, e num mês anterior à mudança não participa', async () => {
    const p = (await elegiveisDoMes(api.banco, api.ids.gb, MES)).find((x) => x.nomeGuerra === 'MUDOU');
    expect(p).toMatchObject({ quadro: 'QOA', dias: 17 });
    expect((await elegiveisDoMes(api.banco, api.ids.gb, '2026-11')).some((x) => x.nomeGuerra === 'MUDOU')).toBe(false);
  });
});

describe('a situação por período', () => {
  it('Reserva a partir do dia 10: candidato no dia 9 e não do dia 10 em diante', async () => {
    expect(await candidatos(dia(9))).toContain('RESERVA');
    expect(await candidatos(dia(10))).not.toContain('RESERVA');
    expect(await candidatos(dia(20))).not.toContain('RESERVA');
  });

  it('a Grade mostra o que já estava escalado antes da Reserva', async () => {
    const linha = (await grade()).grupos.flatMap((x) => x.linhas).find((l) => l.nomeGuerra === 'RESERVA');
    expect(linha).toBeDefined();
    expect(Object.keys(linha!.dias)).toEqual([dia(5)]);
  });
});

describe('a Grade com duas situações no mês (revisão final)', () => {
  it('Desativado até o dia 14 e Ativa a partir do 15, sem escala no mês: aparece na Grade', async () => {
    await criar('VOLTOU', 'SD', [{ desde: '2026-11-01', ate: dia(14), quadro: 'QBMG', situacao: 'Desativado' }, { desde: dia(15), quadro: 'QBMG' }]);
    await criar('VOLTOU2', 'SD', [{ desde: dia(15), quadro: 'QBMG' }]);
    await api.banco.query("insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, ate, quadro_id, situacao_id) values ($1, $2, $3, 'pronto', '2026-11-01', $4, $5, $6)", [
      militar.VOLTOU2, api.ids.secao, alfa, dia(14), quadro.QBMG, await situacaoDoMilitar(api.banco, 'Desativado'),
    ]);
    const nomes = nomesDaGrade(await grade());
    expect(nomes).toContain('VOLTOU');
    expect(nomes).toContain('VOLTOU2');
  });

  it('o Adm em Reserva a partir do dia 10 continua na Grade, só com o que foi lançado (6.71: não há expediente calculado)', async () => {
    const id = await inserir(api.banco, 'militar', { matricula: '991499-9', posto_grad_id: posto['SD'], nome_guerra: 'ADMRES', antiguidade: 99 });
    const base = { militar_id: id, unidade_id: api.ids.secao, jornada: 'adm', quadro_id: quadro.QBMG };
    await inserir(api.banco, 'rastreio', { ...base, desde: '2026-11-01', ate: dia(9), situacao_id: await situacaoDoMilitar(api.banco, 'Ativa') });
    await inserir(api.banco, 'rastreio', { ...base, desde: dia(10), situacao_id: await situacaoDoMilitar(api.banco, 'Reserva') });
    // o expediente que a pré-escala lançou, antes de ele ir para a Reserva
    const expediente = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Expediente', tipo: 'ordinario', cor: '#8A94A1' });
    const turno = await inserir(api.banco, 'turno', { servico_id: expediente, letra: 'A', inicio: '08:00', fim: '16:00' });
    await inserir(api.banco, 'alocacao', { militar_id: id, escala_id: null, servico_id: expediente, turno_id: turno, data: dia(4), origem: 'pre_escala' });
    const linha = (await grade()).grupos.flatMap((x) => x.linhas).find((l) => l.nomeGuerra === 'ADMRES');
    expect(linha).toBeDefined();
    expect(Object.keys(linha!.dias)).toEqual([dia(4)]);
  });
});

describe('o posto e o quadro do período', () => {
  it('trocar o posto de um 2º TEN do QOA para CEL leva o período aberto ao QOC, sem erro', async () => {
    const id = await criar('PROMOVIDO', '2º TEN', [{ desde: '2026-11-01', quadro: 'QOA' }]);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, { postoGradId: posto['CEL'] });
    expect(r.status).toBe(200);
    const f: FichaMilitar = await r.json();
    expect(f.quadro).toMatchObject({ sigla: 'QOC' });
    // o período de antes continua QOA; o novo (a partir de hoje) é QOC
    expect(f.rastreio.map((p) => [p.quadro, p.ate === null])).toEqual(hojeRecife() === '2026-11-01' ? [['QOC', true]] : [['QOC', true], ['QOA', false]]);
  });

  it('o PATCH não aceita mais "ativo" nem "quadroId" (o quadro e a situação vão pelo "Alterar situação")', async () => {
    for (const corpo of [{ ativo: false }, { quadroId: quadro.QOA }]) {
      const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${militar.PRACA}`, corpo);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
    }
  });
});

describe('"Alterar situação" com situação', () => {
  const alterar = (id: string, corpo: Record<string, unknown>, quem: 'gestorGb' | 'escalante' = 'gestorGb') =>
    api.pedir(quem, 'POST', `/api/militares/${id}/situacao`, { unidadeId: api.ids.secao, equipeId: alfa, jornada: 'pronto', desde: hojeRecife(), ...corpo });

  it('muda a situação a partir do dia: o período novo leva a situação, e a anterior fica até a véspera', async () => {
    const id = await criar('SITUADO', 'SD', [{ desde: '2026-11-01', quadro: 'QBMG' }]);
    const reserva = await situacaoDoMilitar(api.banco, 'Reserva');
    const r = await alterar(id, { situacaoId: reserva, desde: '2026-11-20' });
    expect(r.status).toBe(201);
    const f: FichaMilitar = await r.json();
    expect(f.rastreio.map((p) => [p.situacao, p.desde, p.ate])).toEqual([['Reserva', '2026-11-20', null], ['Ativa', '2026-11-01', '2026-11-19']]);
  });

  it('quem só tem nível de acesso na seção não muda a situação (403, com o texto do Pecúlio)', async () => {
    const id = await criar('TRAVADO', 'SD', [{ desde: '2026-11-01', quadro: 'QBMG' }]);
    const r = await alterar(id, { situacaoId: await situacaoDoMilitar(api.banco, 'Reserva') }, 'escalante');
    expect(r.status).toBe(403);
    // mudar só equipe e jornada continua valendo para ele
    expect((await alterar(id, {}, 'escalante')).status).toBeLessThan(300);
  });

  it('situação desativada no catálogo é recusada, com o texto fixo', async () => {
    const id = await criar('DESATIVADA', 'SD', [{ desde: '2026-11-01', quadro: 'QBMG' }]);
    const adido = await situacaoDoMilitar(api.banco, 'Adido');
    await api.banco.query('update situacao_militar set ativo = false where id = $1', [adido]);
    const r = await alterar(id, { situacaoId: adido });
    expect(r.status).toBe(400);
    expect((await r.json()).campos.situacaoId).toBe('Esta situação está desativada.');
    await api.banco.query('update situacao_militar set ativo = true where id = $1', [adido]);
  });

  it('o período novo sem situação nem quadro no pedido leva os de agora', async () => {
    const id = await criar('HERDA', 'CAP', [{ desde: '2026-11-01', quadro: 'QOA', situacao: 'Agregado' }]);
    const f: FichaMilitar = await (await alterar(id, { desde: '2026-11-20' })).json();
    expect(f.rastreio[0]).toMatchObject({ quadro: 'QOA', situacao: 'Agregado', desde: '2026-11-20' });
  });
});

describe('os dados pessoais na ficha', () => {
  const CPF = '529.982.247-25';
  const patch = (id: string, corpo: Record<string, unknown>, quem: 'gestorGb' | 'escalante' = 'gestorGb') => api.pedir(quem, 'PATCH', `/api/militares/${id}`, corpo);

  it('grava o CPF (só dígitos), o ano de nascimento e o endereço; a ficha devolve tudo', async () => {
    const r = await patch(militar.PRACA!, { cpf: CPF, nascimento: { dia: 29, mes: 2, ano: 1992 }, endereco: { cep: '50030-000', logradouro: 'Rua Fictícia', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Recife', uf: 'pe' } });
    expect(r.status).toBe(200);
    const f: FichaMilitar = await r.json();
    expect(f).toMatchObject({ cpf: '52998224725', nascimento: { dia: 29, mes: 2, ano: 1992 }, endereco: { cep: '50030000', logradouro: 'Rua Fictícia', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Recife', uf: 'PE' } });
  });

  it('CPF inválido, CEP curto, UF fora da lista e 29/02 em ano comum são 400 no campo, com os textos fixos', async () => {
    const id = militar.PRACA!;
    const erro = async (corpo: Record<string, unknown>) => (await (await patch(id, corpo)).json()).campos as Record<string, string>;
    expect((await erro({ cpf: '111.111.111-11' })).cpf).toBe('CPF inválido: confira os 11 dígitos.');
    expect((await erro({ endereco: { cep: '5003' } }))['endereco.cep']).toBe('O CEP tem 8 dígitos.');
    expect((await erro({ endereco: { uf: 'XX' } }))['endereco.uf']).toBe('Use a sigla do estado (ex.: PE).');
    expect((await erro({ nascimento: { dia: 29, mes: 2, ano: 1991 } }))['nascimento.dia']).toBe('Esse dia não existe nesse mês.');
  });

  it('CPF repetido é 409 no campo, com o nome de quem já o tem', async () => {
    const r = await patch(militar.MUDOU!, { cpf: CPF });
    expect(r.status).toBe(409);
    const corpo = await r.json();
    expect(corpo.erro).toBe('Este CPF já é de PRACA.');
    expect(corpo.campos.cpf).toBe('Este CPF já é de PRACA.');
  });

  it('o CPF e o endereço são do Pecúlio: quem só tem nível de acesso na seção não altera', async () => {
    expect((await patch(militar.PRACA!, { cpf: null }, 'escalante')).status).toBe(403);
    expect((await patch(militar.PRACA!, { endereco: { cidade: 'Olinda' } }, 'escalante')).status).toBe(403);
  });
});
