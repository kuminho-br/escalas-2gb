import type { CardDaGuarnicao, DiaDaEscala, EscalaDoMes, EscalaVisivel, FaixaDoDia, OcupanteDaVaga, UnidadeDaConsulta } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mesAtual } from '@/lib/meses';
import { abrir, EU_EXEMPLO, escolherNaArvore, simularApi } from './apoio';

// Entrega 7.5, Task 2: as Escalas da corporação (lista e escala aberta só para leitura). O militar comum lotado na 1ª SB. Dados fictícios (D7).
const MES = mesAtual();
const LOTADO = { id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: null };
const COMUM = { ...EU_EXEMPLO, papeis: [], lotacao: LOTADO };
const UNIDADES: UnidadeDaConsulta[] = [
  { id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: null }, { id: 'u-divop', sigla: 'DivOp', nivel: 4, maeId: 'u-gb' }, { id: 'u-1sb', sigla: '1ª SB', nivel: 5, maeId: 'u-divop' }, { id: 'u-3gb', sigla: '3º GB', nivel: 3, maeId: null },
];
const visivel = (escalaId: string, nome: string, unidadeId: string, unidadeSigla: string, extra: Partial<EscalaVisivel> = {}): EscalaVisivel => ({
  escalaId, nome, unidadeId, unidadeSigla, mes: MES, estado: 'publicada', emRetificacao: false, em: '2026-11-20T15:00:00.000Z', dosOficiais: false, ...extra,
});
const ESCALAS: EscalaVisivel[] = [
  visivel('e1', 'Ordinário', 'u-1sb', '1ª SB', { estado: 'previa' }),
  visivel('e2', 'Oficiais', 'u-1sb', '1ª SB', { dosOficiais: true }),
  visivel('e3', 'Ordinário da DivOp', 'u-divop', 'DivOp', { emRetificacao: true }),
  visivel('e4', 'Ordinário do 3º GB', 'u-3gb', '3º GB', { estado: 'retificada' }),
];
const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, acumuloId: null, acumulaCom: [], militarId: `m-${nome}`, posto: 'SD', nomeGuerra: nome, matricula: '', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
});
const card: CardDaGuarnicao = {
  guarnicaoId: 'g1', nome: 'ABT', viatura: null, prioridade: 1, completa: true, faltam: [],
  funcoes: [{ funcaoId: 'f1', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: null, ocupantes: [ocupante('MOTOR')] }],
};
const faixa: FaixaDoDia = { inicio: '08:00', fim: '20:00', noturna: false, turnos: [{ turnoId: 't1', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'A' }], guarnicoes: [card], semPosto: [], removidos: [] };
const dia: DiaDaEscala = { data: `${MES}-01`, diaDaSemana: 1, feriado: null, faixas: [faixa], obrigatoriasVazias: 0 };
const ESCALA: EscalaDoMes = {
  escalaId: 'e3', nome: 'Ordinário da DivOp', mes: MES, dias: [dia], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 },
  estado: { estado: 'publicada', emRetificacao: false, em: '2026-11-20T15:00:00.000Z', por: null }, podePublicar: false, podeAlterarPassado: false,
};

function api(extra: Parameters<typeof simularApi>[0] = {}, eu: unknown = COMUM) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/consulta/unidades': { status: 200, corpo: UNIDADES },
    [`GET /api/visualizacao/escalas/${MES}`]: { status: 200, corpo: ESCALAS },
    [`GET /api/visualizacao/escalas/e3/mes/${MES}`]: { status: 200, corpo: ESCALA },
    ...extra,
  });
}
const lista = async (nome: string) => within(await screen.findByRole('region', { name: nome }));

describe('as Escalas da corporação (7.5)', () => {
  it('a lista começa filtrada na unidade de lotação da pessoa e nas de baixo, por unidade, cada escala com o estado', async () => {
    api();
    abrir('/escalas-da-corporacao');
    expect(await screen.findByRole('heading', { name: 'Escalas' })).toBeInTheDocument();
    const sb = await lista('1ª SB');
    expect(sb.getByRole('link', { name: /Ordinário/ })).toHaveTextContent('Prévia');
    expect(sb.getByRole('link', { name: /Oficiais/ })).toHaveTextContent('Publicada');
    expect(sb.getByRole('link', { name: /Oficiais/ })).toHaveTextContent('Oficiais');
    // a DivOp (acima) e o 3º GB (outro) só aparecem sem o filtro
    expect(screen.queryByRole('region', { name: 'DivOp' })).toBeNull();
    expect(screen.queryByRole('region', { name: '3º GB' })).toBeNull();
  });

  it('a árvore troca a unidade (a escolhida e as de baixo), e "Limpar" mostra todas, com a etiqueta de retificação', async () => {
    api();
    abrir('/escalas-da-corporacao');
    await lista('1ª SB');
    await escolherNaArvore(screen.getByLabelText('Escalas da unidade'), 'DivOp, em 2º GB');
    expect(await lista('DivOp')).toBeTruthy();
    expect(screen.getByRole('region', { name: '1ª SB' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '3º GB' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'DivOp' })).getByRole('link')).toHaveTextContent('Escala em retificação');
    await userEvent.click(screen.getByLabelText('Escalas da unidade'));
    await userEvent.click(await screen.findByRole('button', { name: 'Limpar' }));
    const tres = await lista('3º GB');
    expect(tres.getByRole('link')).toHaveTextContent('Retificada');
  });

  it('o vazio do mês tem o texto fixo; com o filtro escondendo tudo, diz para limpar o filtro', async () => {
    api({ [`GET /api/visualizacao/escalas/${MES}`]: { status: 200, corpo: [] } });
    abrir('/escalas-da-corporacao');
    expect(await screen.findByText(/^Nenhuma escala de .+ está aberta para você\.$/)).toBeInTheDocument();
  });

  it('abrir uma escala mostra a Escala do mês só para leitura, com a linha do estado e sem nenhum botão de montagem ou de passagem', async () => {
    api();
    const router = abrir('/escalas-da-corporacao');
    await escolherNaArvore(await screen.findByLabelText('Escalas da unidade'), 'DivOp, em 2º GB');
    await userEvent.click((await lista('DivOp')).getByRole('link', { name: /Ordinário da DivOp/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/escalas-da-corporacao/e3'));
    expect(await screen.findByRole('heading', { name: 'Ordinário da DivOp' })).toBeInTheDocument();
    expect(await screen.findByText('Publicada em 20/11.')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Dia 1' })).toBeInTheDocument();
    for (const b of [/Escalar/, /Remover/, /Trocar/, /Lançar prévia/, /Publicar/, /Republicar/, /Gerar/, /Ações de/, /Desfazer/, /Escolher/]) expect(screen.queryByRole('button', { name: b }), String(b)).toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar às escalas' })).toBeInTheDocument();
  });

  it('a linha do estado de cada estado, com o texto fixo', async () => {
    for (const [estado, texto] of [['previa', 'Prévia lançada em 20/11. Pode mudar até o dia do serviço.'], ['retificada', 'Republicada em 20/11.'], ['remessada', 'Remessada em 20/11.']] as const) {
      const { cleanup } = await import('@testing-library/react');
      cleanup();
      api({ [`GET /api/visualizacao/escalas/e3/mes/${MES}`]: { status: 200, corpo: { ...ESCALA, estado: { ...ESCALA.estado, estado } } } });
      abrir('/escalas-da-corporacao/e3');
      expect(await screen.findByText(texto), estado).toBeInTheDocument();
    }
  });

  it('Review Focus 4: a escala que deixou de estar aberta (404) diz "Esta escala não está aberta para você." e tem o caminho de volta', async () => {
    api({ [`GET /api/visualizacao/escalas/e3/mes/${MES}`]: { status: 404, corpo: { erro: 'Esta escala não está aberta para você.' } } });
    abrir('/escalas-da-corporacao/e3');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta escala não está aberta para você.');
    expect(screen.getByRole('link', { name: 'Voltar às escalas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Dia/ })).toBeNull();
  });
});
