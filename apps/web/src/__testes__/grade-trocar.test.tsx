import type { BlocoDaGrade, EscalaDoMes, GradeDoMes, LinhaDaGrade, OpcoesDeTroca, PainelDoDia } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Trocar no painel do dia da Grade geral: o CABO, dia 10 de dezembro de 2026, de Pronto A (ABT, Combatente).
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', expediente: false };
const CABO: LinhaDaGrade = {
  militarId: 'm-CABO', posto: 'SD BM', nomeGuerra: 'CABO', matricula: '990001-1', jornada: 'pronto', dias: { [DIA]: [BLOCO] }, choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0,
};
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'eq-alfa', nome: 'Alfa', linhas: [CABO] }] };
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-CABO', posto: 'SD BM', nomeGuerra: 'CABO', matricula: '990001-1', equipe: 'Alfa', jornada: 'pronto', cnh: ['D'], voluntarioJes: true },
  data: DIA, afastamento: null, disponibilidade: [],
  servicos: [{ alocacaoId: 'a-1', escalaId: 'e-ord', escala: 'Ordinário', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: 'ABT', funcao: 'Combatente', acumulaCom: [] }],
  choques: [], opcoes: [],
};
const TROCAS: OpcoesDeTroca = {
  livres: {
    aptos: [{
      militarId: 'm-livre', posto: 'SD BM', nomeGuerra: 'CHARLIE', matricula: '990003-3', equipe: 'Alfa', jornada: 'pronto',
      servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto' }, { servicoId: 's-jes', turnoId: 't-jes', nome: 'JES' }],
    }],
    semVoluntariado: [], fora: [{ motivo: 'Afastado', quantidade: 2 }], acumular: [],
  },
  escalados: [{
    militarId: 'm-bravo', posto: 'SD BM', nomeGuerra: 'BRAVO', matricula: '990002-2',
    alocacoes: [
      { alocacaoId: 'a-b1', onde: 'Ordinário, 20h–08h, Motorista do ABT', permuta: true },
      { alocacaoId: 'a-b2', onde: 'Ordinário, 08h–16h, sem guarnição', permuta: false },
    ],
  }],
};
const ESCALA: EscalaDoMes = { escalaId: 'e-ord', nome: 'Ordinário', mes: MES, dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } };
const ROTA_GRADE = `GET /api/unidades/u-1sb/grade/${MES}`;
const POST = 'POST /api/alocacoes/a-1/trocar';
const ABERTA = `/?mes=${MES}&militar=m-CABO&dia=${DIA}`;

function api(extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [ROTA_GRADE]: { status: 200, corpo: GRADE },
    [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: PAINEL },
    'GET /api/alocacoes/a-1/trocas': { status: 200, corpo: TROCAS },
    [POST]: { status: 200, corpo: { escalas: [{ escalaId: 'e-ord', mes: MES }] } },
    'GET /api/escalas/e-ord/mes/2026-12': { status: 200, corpo: ESCALA },
    ...extra,
  });
}
const abrirTroca = async () => {
  const servico = await screen.findByRole('listitem', { name: 'Pronto A, 08h–20h' });
  await userEvent.click(within(servico).getByRole('button', { name: 'Trocar' }));
  return screen.findByRole('dialog', { name: 'Trocar' });
};

describe('grade geral: trocar', () => {
  it('"Trocar" lista os livres e os já escalados no dia, com onde eles estão', async () => {
    api();
    abrir(ABERTA);
    const d = await abrirTroca();
    expect(await within(d).findByRole('button', { name: /CHARLIE/ })).toBeInTheDocument();
    expect(within(d).getByText('Ficaram de fora: 2 afastados')).toBeInTheDocument();
    expect(within(d).getByRole('heading', { name: 'Já escalados neste dia' })).toBeInTheDocument();
    expect(within(d).getByText('SD BM BRAVO')).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Ordinário, 08h–16h, sem guarnição' })).toBeInTheDocument();
  });

  it('escolher um livre e confirmar manda { militarId, turnoId }, com o serviço escolhido', async () => {
    const f = api();
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.selectOptions(await within(d).findByLabelText('Serviço de CHARLIE'), 't-jes');
    await userEvent.click(within(d).getByRole('button', { name: /CHARLIE/ }));
    expect(within(d).getByText('Trocar CABO por CHARLIE?')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Trocar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-livre', turnoId: 't-jes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Trocar' })).toBeNull());
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });

  it('escolher o lugar de um escalado mostra onde ele está e "Permuta" quando os dois são ordinários; confirmar manda { comAlocacaoId }', async () => {
    const f = api();
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' }));
    expect(within(d).getByText('BRAVO está no Ordinário, 20h–08h, Motorista do ABT.')).toBeInTheDocument();
    expect(within(d).getByText('Permuta')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Fazer a permuta' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ comAlocacaoId: 'a-b1' }));
  });

  it('quem está em dois lugares mostra os dois, e a troca usa o escolhido; fora da permuta o botão é "Trocar os dois"', async () => {
    const f = api();
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 08h–16h, sem guarnição' }));
    expect(within(d).getByText('BRAVO está no Ordinário, 08h–16h, sem guarnição.')).toBeInTheDocument();
    expect(within(d).queryByText('Permuta')).toBeNull();
    await userEvent.click(within(d).getByRole('button', { name: 'Trocar os dois' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ comAlocacaoId: 'a-b2' }));
  });

  it('quem só não marcou o horário no voluntariado vem numa seção própria, com o aviso na confirmação (achado da revisão final)', async () => {
    const delta = { militarId: 'm-delta', posto: 'SD BM', nomeGuerra: 'DELTA', matricula: '990004-4', equipe: 'Alfa', jornada: 'pronto' as const, servicos: [{ servicoId: 's-jes', turnoId: 't-jes', nome: 'JES' }] };
    const f = api({ 'GET /api/alocacoes/a-1/trocas': { status: 200, corpo: { ...TROCAS, livres: { ...TROCAS.livres, semVoluntariado: [delta] } } } });
    abrir(ABERTA);
    const d = await abrirTroca();
    const secao = await within(d).findByRole('region', { name: 'Sem voluntariado neste horário' });
    expect(within(secao).getByRole('button', { name: /DELTA/ })).toBeInTheDocument();
    // quem marcou o horário não fica nessa seção
    expect(within(secao).queryByRole('button', { name: /CHARLIE/ })).toBeNull();
    await userEvent.click(within(secao).getByRole('button', { name: /DELTA/ }));
    expect(within(d).getByText('Não marcou voluntariado neste horário.')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('button', { name: 'Trocar' }));
    await waitFor(() => expect(corpoEnviado(f, POST)).toEqual({ militarId: 'm-delta', turnoId: 't-jes' }));
  });

  it('substituir quem acumula outra vaga avisa que ela também fica vazia (achado da revisão final)', async () => {
    const comAcumulo: PainelDoDia = { ...PAINEL, servicos: [{ ...PAINEL.servicos[0]!, acumulaCom: ['Motorista ABT'] }] };
    api({ [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: comAcumulo } });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: /CHARLIE/ }));
    expect(within(d).getByText('CABO também sai de: Motorista ABT.')).toBeInTheDocument();
  });

  it('"Voltar" na confirmação volta à lista sem mandar nada', async () => {
    const f = api();
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Voltar' }));
    expect(within(d).getByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' })).toBeInTheDocument();
    expect(chamadasA(f, POST)).toBe(0);
  });

  it('depois de uma troca que deu certo, as opções da troca não são buscadas de novo', async () => {
    const f = api();
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' }));
    expect(chamadasA(f, 'GET /api/alocacoes/a-1/trocas')).toBe(1);
    await userEvent.click(within(d).getByRole('button', { name: 'Fazer a permuta' }));
    await waitFor(() => expect(chamadasA(f, POST)).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Trocar' })).toBeNull());
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
    await new Promise((ok) => setTimeout(ok, 150));
    expect(chamadasA(f, 'GET /api/alocacoes/a-1/trocas')).toBe(1);
  });

  it('depois de uma troca recusada, as opções são buscadas de novo', async () => {
    const f = api({ [POST]: { status: 409, corpo: { erro: 'Sem a CNH exigida' } } });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Fazer a permuta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Sem a CNH exigida');
    await waitFor(() => expect(chamadasA(f, 'GET /api/alocacoes/a-1/trocas')).toBe(2));
  });

  it('a recusa aparece no diálogo e a grade volta a ser buscada (Review Focus 5)', async () => {
    const f = api({ [POST]: { status: 409, corpo: { erro: 'Sem a CNH exigida' } } });
    abrir(ABERTA);
    const d = await abrirTroca();
    await userEvent.click(await within(d).findByRole('button', { name: 'Ordinário, 20h–08h, Motorista do ABT' }));
    await userEvent.click(within(d).getByRole('button', { name: 'Fazer a permuta' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent('Sem a CNH exigida');
    expect(screen.getByRole('dialog', { name: 'Trocar' })).toBeInTheDocument();
    await waitFor(() => expect(chamadasA(f, ROTA_GRADE)).toBe(2));
  });
});
