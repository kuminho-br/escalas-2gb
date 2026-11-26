import type { BlocoDaGrade, FichaMilitar, GradeDoMes, LinhaDaGrade, PainelDoDia } from 'contratos';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TabelaDaGrade, maximosDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { guardarUnidadeDeConsulta } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, EU_EXEMPLO, responderConfirmacao, simularApi } from './apoio';

// 6.65, Task 3: a ficha pela Grade (pool 35), o filtro de equipes (17 e 18) e "Tirar do expediente" (K1). Dezembro de 2026; matrículas fictícias 990xxx-x.
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', expediente: false };
const linha = (nomeGuerra: string, matricula: string, extra: Partial<LinhaDaGrade> = {}): LinhaDaGrade => ({
  militarId: `m-${nomeGuerra}`, posto: 'SD', nomeGuerra, matricula, jornada: 'pronto', dias: {}, choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra,
});
const CABO = linha('CABO', '990001-1', { dias: { [DIA]: [BLOCO] }, choques: [DIA] });
const GRADE: GradeDoMes = {
  mes: MES,
  dias: DIAS,
  grupos: [
    { chave: 'eq-alfa', nome: 'Alfa', linhas: [CABO, linha('SOLDADO', '990002-2')] },
    { chave: 'eq-bravo', nome: 'Bravo', linhas: [linha('BRAVO', '990003-3')] },
    { chave: 'eq-charlie', nome: 'Charlie', linhas: [linha('CHARLIE', '990004-4')] },
    { chave: 'eq-delta', nome: 'Delta', linhas: [linha('DELTA', '990005-5')] },
    { chave: 'adm', nome: 'Adm', linhas: [linha('ADMIR', '990006-6', { jornada: 'adm' })] },
  ],
};
const FICHA = (id: string, nomeGuerra: string, matricula: string): FichaMilitar => ({
  id, matricula, posto: 'SD', quadro: { id: 'q-qbmg', sigla: 'QBMG' }, nomeGuerra, equipe: 'Alfa', jornada: 'pronto', motorista: null, voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
  podeEditar: { peculio: true, escala: true, unidadeDeCima: '2º GB' },
  postoGradId: 'p-sd', veDadosRestritos: false, cpf: null, endereco: { cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: null, uf: null }, situacaoDoMilitar: { id: 'sit-ativa', nome: 'Ativa', escalavel: true },
  nomeCompleto: `Fulano ${nomeGuerra}`, sexo: 'M', nascimento: null, telefone: null, email: null, comportamento: null, comportamentoBoletim: null, antiguidade: 3, antiguidadeRepetidaCom: [], funcao: null, funcaoMilitarId: null, abonoPermanencia: false,
  noQuadroDeMotoristas: false, cnh: [], cnhPorHierarquia: [],
  rastreio: [{ id: 'l1', unidadeId: 'u-1sb', unidadeSigla: '1ª SB', alteradoPor: null, alteradoEm: null, podeMexer: false, equipe: 'Alfa', jornada: 'pronto', desde: '2026-11-01', quadro: 'QBMG', situacao: 'Ativa', ate: null }], afastamentos: [],
});
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '990001-1', equipe: 'Alfa', jornada: 'pronto', cnh: [], voluntarioJes: false },
  data: DIA, afastamento: null, disponibilidade: [], choques: ['Choque de horário: Pronto A (08h–20h) com JES A (08h–20h)'], opcoes: [],
  servicos: [{ alocacaoId: 'a-1', escalaId: 'e-ord', escala: 'Ordinário', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: 'ABT', funcao: 'Combatente', acumulaCom: [] }],
};
const ROTAS = {
  '/api/eu': { status: 200, corpo: EU_EXEMPLO },
  [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: GRADE },
  [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: PAINEL },
  'GET /api/militares/m-CABO': { status: 200, corpo: FICHA('m-CABO', 'CABO', '990001-1') },
  'GET /api/militares/m-SOLDADO': { status: 200, corpo: FICHA('m-SOLDADO', 'SOLDADO', '990002-2') },
  'GET /api/postos': { status: 200, corpo: [] },
  'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
  'GET /api/sistema/tipos-afastamento': { status: 200, corpo: [] },
};
const ABERTA = `/grade?mes=${MES}&militar=m-CABO&dia=${DIA}`;

describe('a ficha pela Grade (pool 35)', () => {
  it('clicar no militar (posto, nome e matrícula) abre a ficha da escala por cima da Grade, e fechar volta sem perder nada', async () => {
    simularApi(ROTAS);
    const router = abrir(`/grade?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a ficha de SD SOLDADO' }));
    const janela = await screen.findByRole('dialog', { name: 'Ficha do militar' });
    expect(await within(janela).findByRole('heading', { name: /SOLDADO/ })).toBeInTheDocument();
    expect(within(janela).getByText('990002-2')).toBeInTheDocument();
    // a ficha da escala (a enxuta): sem Dados pessoais nem Comportamento
    expect(within(janela).queryByRole('heading', { name: 'Comportamento' })).toBeNull();
    expect(router.state.location.search).toMatchObject({ ficha: 'm-SOLDADO' });
    // dentro da janela a seta de voltar não existe: a janela fecha
    expect(within(janela).queryByRole('link', { name: /Voltar/ })).toBeNull();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ficha do militar' })).toBeNull());
    expect(router.state.location.search).not.toHaveProperty('ficha');
  });

  it('pelo teclado: Enter no militar abre a ficha, e o foco volta ao botão ao fechar', async () => {
    simularApi(ROTAS);
    abrir(`/grade?mes=${MES}`);
    const botao = await screen.findByRole('button', { name: 'Abrir a ficha de SD SOLDADO' });
    botao.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Ficha do militar' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(botao).toHaveFocus();
  });

  it('Review Focus 3: com a célula de um turno com choque escolhida, a ficha de outro militar não troca a seleção nem a rolagem da Grade', async () => {
    simularApi(ROTAS);
    const router = abrir(ABERTA);
    await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    const rolagem = document.querySelector<HTMLElement>('[data-rolagem="grade"]')!;
    rolagem.scrollTop = 120;
    rolagem.scrollLeft = 80;
    await userEvent.click(screen.getByRole('button', { name: 'Abrir a ficha de SD SOLDADO' }));
    await screen.findByRole('dialog', { name: 'Ficha do militar' });
    expect(router.state.location.search).toMatchObject({ militar: 'm-CABO', dia: DIA, ficha: 'm-SOLDADO' });
    // (a janela esconde o resto da tela dos leitores: a célula se acha pelo endereço)
    expect(document.querySelector('[data-escolhida]')).toHaveAttribute('aria-label', 'SD CABO, dia 10: Pronto A, choque');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ficha do militar' })).toBeNull());
    // a mesma tabela, no mesmo lugar, e o painel do dia continua aberto
    expect(document.querySelector('[data-rolagem="grade"]')).toBe(rolagem);
    expect(rolagem.scrollTop).toBe(120);
    expect(rolagem.scrollLeft).toBe(80);
    expect(router.state.location.search).toMatchObject({ militar: 'm-CABO', dia: DIA });
    expect(screen.getByRole('complementary', { name: 'Dia de SD CABO' })).toBeInTheDocument();
  });

  it('o endereço com ficha abre a ficha direto; a falha ao buscar aparece na janela', async () => {
    simularApi({ ...ROTAS, 'GET /api/militares/m-SOLDADO': { status: 403, corpo: { erro: 'Sem permissão para ver esta ficha.' } } });
    abrir(`/grade?mes=${MES}&ficha=m-SOLDADO`);
    const janela = await screen.findByRole('dialog', { name: 'Ficha do militar' });
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Sem permissão para ver esta ficha.');
  });
});

describe('a ficha pela Grade: o que a revisão achou (6.65)', () => {
  it('quem só consulta a unidade não ganha o botão da ficha (a ficha da escala é de quem tem nível: seria uma janela de "sem permissão")', async () => {
    const SO_CONSULTA = { ...EU_EXEMPLO, papeis: [], unidades: [], lotacao: null, unidadesSoConsulta: [{ id: 'u-2sb', sigla: '2ª SB', caminho: ['CBMPE', '2ª SB'], nivel: 4, tipo: 'secao', maeId: null }] };
    simularApi({ ...ROTAS, '/api/eu': { status: 200, corpo: SO_CONSULTA }, [`GET /api/unidades/u-2sb/grade/${MES}`]: { status: 200, corpo: GRADE } });
    guardarUnidadeDeConsulta('u-2sb');
    try {
      abrir(`/grade?mes=${MES}`);
      await screen.findByRole('rowheader', { name: /SOLDADO/ });
      expect(screen.queryByRole('button', { name: /Abrir a ficha de/ })).toBeNull();
      expect(screen.getByRole('rowheader', { name: /SOLDADO/ })).toHaveTextContent('990002-2');
    } finally {
      guardarUnidadeDeConsulta(null);
    }
  });

  it('ao fechar a janela, a Grade é buscada de novo (o que se mudou na ficha, como a equipe, já aparece)', async () => {
    const f = simularApi(ROTAS);
    abrir(`/grade?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a ficha de SD SOLDADO' }));
    await screen.findByRole('dialog', { name: 'Ficha do militar' });
    const antes = chamadasA(f, `GET /api/unidades/u-1sb/grade/${MES}`);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(chamadasA(f, `GET /api/unidades/u-1sb/grade/${MES}`)).toBeGreaterThan(antes));
  });
});

describe('o filtro de equipes (pool 17 e 18)', () => {
  const grupo = async () => within(await screen.findByRole('group', { name: 'Equipe' }));

  it('o corte do celular é o do resto do site (768 px): classes md, e nenhuma sm', async () => {
    simularApi(ROTAS);
    abrir(`/grade?mes=${MES}`);
    const caixa = (await screen.findByRole('group', { name: 'Equipe' })) as HTMLElement;
    expect(caixa.className).toMatch(/md:flex/);
    expect(caixa.className).not.toMatch(/(^| )sm:flex/);
    expect(caixa.parentElement!.className).toMatch(/max-md:w-full/);
    for (const b of within(caixa).getAllByRole('button')) expect(b.className).not.toMatch(/max-sm:/);
  });

  it('com cinco segmentos (Todas e quatro equipes, mais o Adm = seis): a última linha estica até o fim, três por linha', async () => {
    simularApi(ROTAS);
    abrir(`/grade?mes=${MES}`);
    const botoes = (await grupo()).getAllByRole('button');
    expect(botoes.map((b) => b.textContent)).toEqual(['Todas', 'Alfa', 'Bravo', 'Charlie', 'Delta', 'ADM']);
    // seis segmentos: duas linhas cheias, nada estica
    expect(botoes.some((b) => /max-md:col-span-[36]/.test(b.className))).toBe(false);
  });

  it('com cinco segmentos de verdade (sem o Adm): os dois últimos esticam em metade da linha', async () => {
    const semAdm = { ...GRADE, grupos: GRADE.grupos.filter((g) => g.chave !== 'adm') };
    simularApi({ ...ROTAS, [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: semAdm } });
    abrir(`/grade?mes=${MES}`);
    const botoes = (await grupo()).getAllByRole('button');
    expect(botoes).toHaveLength(5);
    expect(botoes.slice(0, 3).some((b) => /max-md:col-span-3/.test(b.className))).toBe(false);
    expect(/max-md:col-span-3/.test(botoes[3]!.className)).toBe(true);
    expect(/max-md:col-span-3/.test(botoes[4]!.className)).toBe(true);
  });

  it('o nome fica centrado no segmento não marcado (o espaço do visto vale dos dois lados); marcado, só o visto à esquerda', async () => {
    simularApi(ROTAS);
    abrir(`/grade?mes=${MES}&equipes=${encodeURIComponent('["eq-alfa"]')}`);
    const botoes = (await grupo()).getAllByRole('button');
    const todas = botoes[0]!; // não marcado
    const alfa = botoes[1]!; // marcado
    expect(todas).toHaveAttribute('aria-pressed', 'false');
    expect(alfa).toHaveAttribute('aria-pressed', 'true');
    expect(todas.querySelector('[data-espaco-do-visto]')).not.toBeNull();
    expect(alfa.querySelector('[data-espaco-do-visto]')).toBeNull();
  });
});

describe('a faixa da equipe tem as mesmas colunas da linha (pool 18)', () => {
  it('a soma das colunas da faixa é a do cabeçalho: o militar, os dias e PJES e Diárias', () => {
    render(<TabelaDaGrade grade={GRADE} grupos={GRADE.grupos} maximos={maximosDaGrade(GRADE.grupos)} escolhida={null} aoEscolher={() => {}} aoAbrirFicha={() => {}} recolhidas={new Set()} aoAlternar={() => {}} />);
    const cabecalho = document.querySelectorAll('thead th').length;
    expect(cabecalho).toBe(1 + DIAS.length + 2);
    for (const faixa of document.querySelectorAll<HTMLTableRowElement>('tr[data-grupo]')) {
      const soma = [...faixa.cells].reduce((n, c) => n + c.colSpan, 0);
      expect(soma, faixa.getAttribute('data-grupo') ?? '').toBe(cabecalho);
    }
    // e uma linha de militar também soma o mesmo
    const linhaDeMilitar = document.querySelector<HTMLTableRowElement>('tr[data-militar]')!;
    expect([...linhaDeMilitar.cells].reduce((n, c) => n + c.colSpan, 0)).toBe(cabecalho);
  });
});

describe('o painel do dia: o expediente lançado e o ADM (pool 18 e K1)', () => {
  const EXPEDIENTE_LANCADO = {
    alocacaoId: 'a-exp', escalaId: null, escala: 'Expediente', servico: { id: 's-exp', nome: 'Expediente', cor: '#8A94A1', tipo: 'ordinario' }, letra: 'A', inicio: '08:00', fim: '16:00', guarnicao: null, funcao: null, acumulaCom: [],
  };
  const DO_ADM = { ...PAINEL, militar: { ...PAINEL.militar, jornada: 'adm' as const, equipe: null }, choques: [], servicos: [EXPEDIENTE_LANCADO] };

  it('"ADM" no painel vem da mesma função das outras telas', async () => {
    simularApi({ ...ROTAS, [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: DO_ADM } });
    abrir(ABERTA);
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    expect(await within(painel).findByText(/jornada ADM/)).toBeInTheDocument();
  });

  it('K1: o expediente lançado ganha "Tirar do expediente" (e não "Remover"), pede confirmação e tira sem pôr nada no lugar', async () => {
    const f = simularApi({
      ...ROTAS,
      [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: DO_ADM },
      'DELETE /api/alocacoes/a-exp': { status: 200, corpo: { escalaId: null, remocaoId: 'r-1', mes: MES } },
    });
    abrir(ABERTA);
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    const item = await within(painel).findByRole('listitem', { name: /Expediente A/ });
    expect(within(item).queryByRole('button', { name: 'Remover' })).toBeNull();
    // os avisos de remover de uma escala não valem para o expediente
    expect(within(item).queryByText(/pré-escala for gerada de novo/)).toBeNull();
    await userEvent.click(within(item).getByRole('button', { name: 'Tirar do expediente' }));
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-exp')).toBe(0); // antes de confirmar, nada
    const pergunta = await screen.findByRole('dialog');
    expect(pergunta).toHaveTextContent('Tirar do expediente?');
    await responderConfirmacao('Tirar');
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/alocacoes/a-exp')).toBe(1));
  });

  it('K1: cancelar a confirmação não tira', async () => {
    const f = simularApi({ ...ROTAS, [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: DO_ADM } });
    abrir(ABERTA);
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    await userEvent.click(await within(painel).findByRole('button', { name: 'Tirar do expediente' }));
    await responderConfirmacao('Cancelar');
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-exp')).toBe(0);
  });

  it('um serviço de escala continua com "Remover", sem confirmação nova', async () => {
    simularApi(ROTAS);
    abrir(ABERTA);
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    expect(await within(painel).findByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: 'Tirar do expediente' })).toBeNull();
  });
});
