import type { CardDaGuarnicao, Cota, DiaDaEscala, EfetivoDoDia, EscalaDoMes, FaixaDoDia, GradeDoMes, LinhaEscala, MilitarDoVoluntariado, OcupanteDaVaga, PainelDoDia, TrechoNoEfetivo, UnidadeDeTrabalho, VoluntariadoDoMes, VoluntariadoDoMilitar } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { hoje, mesAtual } from '@/lib/meses';
import { escolherUnidade, guardarUnidade, guardarUnidadeDeConsulta, lerUnidadeDeConsulta, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.12, Task 9: as telas de escala numa unidade só de consulta. Dados fictícios (D7).
const unidade = (id: string, sigla: string, nivel: number, tipo: string, caminho: string[]): UnidadeDeTrabalho => ({ id, sigla, nivel, tipo, caminho, maeId: null });
const GB = unidade('u-gb', '2º GB', 3, 'grupamento', ['CBMPE', 'DGO', 'DInter/1', '2º GB']);
const DIVOP = unidade('u-divop', 'DivOp', 4, 'divisao', [...GB.caminho, 'DivOp']);
const SB1 = unidade('u-1sb', '1ª SB', 5, 'secao', [...DIVOP.caminho, '1ª SB']);
const DA = unidade('u-da', 'DA', 4, 'divisao', [...GB.caminho, 'DA']);
const SB2 = unidade('u-2sb', '2ª SB', 5, 'secao', [...DA.caminho, '2ª SB']);
/** O chefe da DivOp: trabalha na DivOp e na 1ª SB; a DA e a 2ª SB (da divisão irmã) ele só consulta. */
const CHEFE: EuDaApi = {
  ...EU_EXEMPLO, papeis: [{ papel: 'gestor_lateral', unidadeId: 'u-divop', unidadeSigla: 'DivOp' }], unidades: [DIVOP, SB1], unidadesSoConsulta: [DA, SB2],
};
/** O oficial: sem nível de acesso, lotado na 2ª SB; com a marca ligada, vê a escala em montagem de toda a corporação. */
const OFICIAL: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [SB2], lotacao: SB2, unidadesSoConsulta: [GB, DIVOP, SB1, DA, SB2] };
const FAIXA_DE_CONSULTA = 'Só consulta: você não altera nada em 2ª SB.';
const MES = mesAtual();
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const EDITAR = [/Desfazer/, /sábados e domingos/, /folga/i, /Como marcar/, /Salvar/, /Alterar/, /Editar/, /Incluir/, /Adicionar/, /Remover/, /Trocar/, /Desativar/, /Reativar/, /Gerar/, /Importar/, /Copiar/, /Voltar ao padrão/, /Escolher militar/, /Ações de/, /Limpar/, /Tirar/, /Permitir de novo/, /Mover/];
const semBotaoDeAlterar = () => {
  for (const nome of EDITAR) expect(screen.queryByRole('button', { name: nome }), String(nome)).toBeNull();
};

// --- as cinco telas, com o mínimo que cada uma precisa para mostrar o que mostra ---
const GRADE: GradeDoMes = {
  mes: MES,
  dias: Array.from({ length: 28 }, (_, i) => ({ data: dia(i + 1), diaDaSemana: i % 7, feriado: null })),
  grupos: [{
    chave: 'eq-alfa', nome: 'Alfa',
    linhas: [{
      militarId: 'm-cabo', posto: 'SD', nomeGuerra: 'CABO', matricula: '990001-1', jornada: 'pronto', choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0,
      dias: { [dia(10)]: [{ alocacaoId: 'a1', servico: { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' }, letra: 'A', inicio: '08:00', fim: '20:00', expediente: false }] },
    }],
  }],
};
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-cabo', posto: 'SD', nomeGuerra: 'CABO', matricula: '990001-1', equipe: 'Alfa', jornada: 'pronto', cnh: [], voluntarioJes: true },
  data: dia(10), afastamento: null, disponibilidade: [], choques: [],
  servicos: [{ alocacaoId: 'a1', escalaId: 'e1', servico: { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' }, letra: 'A', inicio: '08:00', fim: '20:00', escala: 'Ordinário', guarnicao: 'ABT', funcao: 'Motorista', acumulaCom: [] }],
  opcoes: [],
};
const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, acumuloId: null, acumulaCom: [], militarId: `m-${nome}`, posto: 'SD', nomeGuerra: nome, matricula: '990001-1', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
});
const CARD: CardDaGuarnicao = {
  guarnicaoId: 'g-abt', nome: 'ABT', viatura: 'ABT-01', prioridade: 1, completa: false, faltam: ['Falta 1 Combatente'],
  funcoes: [
    { funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D', ocupantes: [ocupante('MOTOR')] },
    { funcaoId: 'f-comb', funcao: 'Combatente', minimo: 1, maximo: 2, cnhExigida: null, ocupantes: [] },
  ],
};
const FAIXA: FaixaDoDia = {
  inicio: '08:00', fim: '20:00', noturna: false, turnos: [{ turnoId: 't-a', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'A' }], guarnicoes: [CARD], semPosto: [{ ...ocupante('SOBRA') }],
  removidos: [{ remocaoId: 'r1', militarId: 'm-x', nomeGuerra: 'REMOVIDO', servico: 'Pronto' }],
};
const DIA_DA_ESCALA: DiaDaEscala = { data: dia(1), diaDaSemana: 2, feriado: null, faixas: [FAIXA], obrigatoriasVazias: 1 };
const ESCALA: EscalaDoMes = { escalaId: 'e1', nome: 'Ordinário', mes: MES, dias: [DIA_DA_ESCALA], resumo: { preenchidas: 1, obrigatorias: 2, obrigatoriasVazias: 1 } };
const ESCALAS: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' }];
const COTAS: Cota[] = [{ id: 'c1', mes: MES, servicoId: 'sv-jes', quantidade: 30, origem: 'interna', prioridade: 1, servico: 'JES', cor: '#6E56A8', distribuidas: 12 }];
const DIA_DO_EFETIVO = hoje();
const trecho = (inicio: number, fim: number, ocupado: boolean): TrechoNoEfetivo => ({
  inicio, fim, opcoes: ocupado ? [] : [{ escalaId: 'e1', escala: 'Ordinário', inicio: '08:00', fim: '20:00' }],
  ocupante: ocupado ? { militarId: 'm-alfa', posto: 'SD', nomeGuerra: 'ALFA', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, acumulo: false, alocacoes: [{ alocacaoId: 'a-alfa', acumuloId: null, inicio: '08:00', fim: '20:00', acumulaCom: [] }] } : null,
});
const EFETIVO: EfetivoDoDia = {
  data: DIA_DO_EFETIVO, meta: { origem: 'dia', total: 1, ativadas: 0 },
  guarnicoes: [{
    guarnicaoId: 'g1', nome: 'ABT', viatura: null, ordem: 1, ativada: false, horarios: [{ inicio: '08:00', fim: '20:00' }], faltas: [{ funcao: 'Motorista', faltam: 1, inicio: '08:00', fim: '20:00' }], alocados: 1,
    funcoes: [{ funcaoId: 'f1', funcao: 'Motorista', minimo: 2, cnhExigida: 'D', linhas: [[trecho(480, 1200, true)], [trecho(480, 1200, false)]] }],
  }],
  desativadas: [{ guarnicaoId: 'g9', nome: 'Antiga', viatura: null }], cotas: [],
};
const MILITARES: MilitarDoVoluntariado[] = [{ militarId: 'm1', posto: 'SD', nomeGuerra: 'CABRAL', matricula: '990021-1', equipe: 'Alfa', jornada: 'pronto', voluntarioJes: true, lancado: true, horas: 12, dias: 1 }];
const MES_DO_VOLUNTARIADO = (() => {
  const d = new Date();
  const proximo = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
})();
const BLOCOS = [{ inicio: '00:00', fim: '12:00' }, { inicio: '12:00', fim: '24:00' }];
const LISTA: VoluntariadoDoMes = { mes: MES_DO_VOLUNTARIADO, militares: MILITARES };
const DO_MILITAR: VoluntariadoDoMilitar = {
  militarId: 'm1', mes: MES_DO_VOLUNTARIADO, faixas: [{ data: `${MES_DO_VOLUNTARIADO}-05`, inicio: '00:00', fim: '12:00' }], doMesAnterior: [], blocos: BLOCOS, folgas: null,
};

// o jsdom não tem scrollIntoView (a Grade rola até a coluna de hoje)
const rolagemOriginal = Element.prototype.scrollIntoView;
beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  Element.prototype.scrollIntoView = rolagemOriginal;
});

/** A API com o chefe, a 2ª SB (da divisão irmã) como unidade de consulta e os dados das cinco telas. */
function api(eu: EuDaApi = CHEFE, extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [`GET /api/unidades/u-2sb/grade/${MES}`]: { status: 200, corpo: GRADE },
    [`GET /api/unidades/u-2sb/grade/${MES}/militares/m-cabo/dias/${dia(10)}`]: { status: 200, corpo: PAINEL },
    'GET /api/unidades/u-2sb/escalas': { status: 200, corpo: ESCALAS },
    [`GET /api/escalas/e1/mes/${MES}`]: { status: 200, corpo: ESCALA },
    'GET /api/unidades/u-2sb/cotas': { status: 200, corpo: COTAS },
    [`GET /api/unidades/u-2sb/efetivo-do-dia/${DIA_DO_EFETIVO}`]: { status: 200, corpo: EFETIVO },
    [`GET /api/unidades/u-2sb/voluntariado/${MES_DO_VOLUNTARIADO}`]: { status: 200, corpo: LISTA },
    [`GET /api/militares/m1/voluntariado/${MES_DO_VOLUNTARIADO}`]: { status: 200, corpo: DO_MILITAR },
    ...extra,
  });
}
/** Abre numa unidade só de consulta: a escolha do seletor vale na aba (a 2ª SB). */
const abrirEmConsulta = (caminho: string) => {
  guardarUnidadeDeConsulta('u-2sb');
  return abrir(caminho);
};

describe('o seletor de unidade: o grupo "Só consulta"', () => {
  it('lista as unidades de trabalho e, num grupo à parte, as só de consulta, com o recuo da árvore', async () => {
    api();
    abrir('/grade');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    const itens = await screen.findAllByRole('menuitem');
    expect(itens.map((i) => i.textContent)).toEqual(['DivOp', '1ª SB', 'DA', '2ª SB']);
    expect(screen.getByText('Só consulta')).toBeInTheDocument();
    const consulta = itens.filter((i) => i.hasAttribute('data-so-consulta'));
    expect(consulta.map((i) => i.textContent)).toEqual(['DA', '2ª SB']);
    expect(consulta.map((i) => i.getAttribute('data-nivel'))).toEqual(['0', '1']);
  });

  it('sem unidade só de consulta (sem divisão irmã), o grupo não aparece (Review Focus 2)', async () => {
    api({ ...CHEFE, unidadesSoConsulta: [] });
    abrir('/grade');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    await screen.findAllByRole('menuitem');
    expect(screen.queryByText('Só consulta')).toBeNull();
  });

  it('escolher uma unidade de consulta abre a tela nela, com a faixa, e NÃO a guarda para a próxima entrada', async () => {
    guardarUnidade('u-divop');
    api(CHEFE, { [`GET /api/unidades/u-divop/grade/${MES}`]: { status: 200, corpo: GRADE } });
    abrir('/grade');
    await screen.findByRole('heading', { name: 'Grade geral' });
    expect(screen.queryByText(/^Só consulta:/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Unidade de trabalho/ }));
    await userEvent.click((await screen.findAllByRole('menuitem')).find((i) => i.textContent === '2ª SB')!);
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    expect(lerUnidadeDeConsulta()).toBe('u-2sb');
    // o navegador continua com a última unidade de trabalho
    expect(lerUnidadeGuardada()).toBe('u-divop');
    expect(localStorage.getItem('unidade-de-trabalho')).toBe('u-divop');
    // na próxima entrada (outra aba, sem a escolha da aba), o sistema abre na última unidade de trabalho
    expect(escolherUnidade(CHEFE, lerUnidadeGuardada())).toMatchObject({ id: 'u-divop' });
  });

  it('voltar a uma unidade de trabalho tira a faixa e guarda a unidade', async () => {
    api(CHEFE, { [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: GRADE } });
    abrirEmConsulta('/grade');
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Unidade de trabalho/ }));
    await userEvent.click((await screen.findAllByRole('menuitem')).find((i) => i.textContent === '1ª SB')!);
    await waitFor(() => expect(screen.queryByText(/^Só consulta:/)).toBeNull());
    expect(lerUnidadeDeConsulta()).toBeNull();
    expect(lerUnidadeGuardada()).toBe('u-1sb');
  });
});

describe('as cinco telas numa unidade só de consulta', () => {
  it('Grade geral: a faixa aparece, a grade abre e o painel do dia mostra o dia sem trocar, remover nem adicionar', async () => {
    api();
    abrirEmConsulta(`/grade?mes=${MES}&militar=m-cabo&dia=${dia(10)}`);
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    await screen.findByRole('table', { name: /Grade geral/ });
    const painel = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    expect(await within(painel).findByRole('listitem', { name: 'Pronto A, 08h–20h' })).toBeInTheDocument();
    expect(within(painel).getByText('ABT, Motorista', { exact: false })).toBeInTheDocument();
    semBotaoDeAlterar();
    expect(screen.queryByText(/Ele não volta para este turno/)).toBeNull();
    // o painel fecha (isso não altera nada)
    expect(within(painel).getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('Escala do mês: a faixa aparece; sem "Gerar pré-escala", sem "Escolher militar" nas vagas e sem "Remover"; a vaga livre é só um aviso', async () => {
    api();
    abrirEmConsulta('/escala-do-mes');
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    const secao = await screen.findByRole('region', { name: 'Dia 1' });
    expect(within(secao).getByText('MOTOR')).toBeInTheDocument();
    // a vaga que falta (obrigatória) e a opcional: as duas são só um aviso
    expect(within(secao).getAllByText('Vaga livre')).toHaveLength(1);
    expect(within(secao).getByText('Vaga opcional')).toBeInTheDocument();
    // o resto da tela continua: o filtro das guarnições completas e quem foi removido
    expect(screen.getByRole('button', { name: 'Ocultar guarnições completas' })).toBeInTheDocument();
    expect(within(secao).getByText('REMOVIDO')).toBeInTheDocument();
    semBotaoDeAlterar();
  });

  it('Efetivo por dia: a faixa aparece; sem "Voltar ao padrão", "Adicionar guarnição", "Desativar guarnição" nem "Reativar"; as vagas e os trechos são só para ver', async () => {
    api();
    abrirEmConsulta(`/efetivo-por-dia?data=${DIA_DO_EFETIVO}`);
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    const card = await screen.findByRole('region', { name: '1º ABT' });
    expect(within(card).getByRole('group', { name: /Motorista: SD ALFA/ })).toBeInTheDocument();
    expect(within(card).getByRole('group', { name: /Motorista: vaga/ })).toBeInTheDocument();
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
    // o que foi desativado hoje continua listado, só sem "Reativar"
    expect(within(screen.getByRole('region', { name: 'Desativadas hoje' })).getByText('Antiga')).toBeInTheDocument();
    expect(screen.getByText(/Meta do dia:/)).toBeInTheDocument();
    semBotaoDeAlterar();
  });

  it('Cotas: a faixa aparece e a tabela vem sem a coluna dos botões; sem importar, copiar, adicionar, editar nem remover', async () => {
    api();
    abrirEmConsulta('/cotas');
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getByText('JES')).toBeInTheDocument();
    expect(within(tabela).getByText('12 de 30')).toBeInTheDocument();
    expect(within(tabela).getAllByRole('columnheader')).toHaveLength(4);
    // o "Destino" é de quem grava (adicionar e copiar): na consulta não há destino
    expect(screen.queryByText(/^Destino:/)).toBeNull();
    semBotaoDeAlterar();
  });

  it('Cotas sem nenhuma cota: o texto não manda adicionar nem copiar', async () => {
    api(CHEFE, { 'GET /api/unidades/u-2sb/cotas': { status: 200, corpo: [] } });
    abrirEmConsulta('/cotas');
    const vazio = (await screen.findByText(/Nenhuma cota em/)).closest('[data-vazio]') as HTMLElement;
    expect(vazio.textContent).not.toMatch(/Adicionar cota|Copiar do mês anterior/);
  });

  it('Voluntariado: a faixa aparece e o mês do militar é só para ver (sem guia, atalhos, "Limpar" nem "Salvar")', async () => {
    api();
    abrirEmConsulta(`/voluntariado?mes=${MES_DO_VOLUNTARIADO}&militar=m1`);
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    const calendario = await screen.findByRole('group', { name: 'Calendário do voluntariado' });
    // o bloco marcado e o que não está marcado, ditos no nome (a cor sozinha não diz nada ao leitor de tela)
    expect(within(calendario).getByRole('img', { name: 'Dia 5, 00h às 12h: marcado' })).toBeInTheDocument();
    expect(within(calendario).getByRole('img', { name: 'Dia 5, 12h às 24h: não marcado' })).toBeInTheDocument();
    expect(within(calendario).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText(/Como marcar|Atalhos de teclado/)).toBeNull();
    // o militar aberto não está "lançando": a lista só diz quantos dias ele tem
    const lista = screen.getByRole('region', { name: 'Já lançados' });
    expect(within(lista).getByText('1 dia')).toBeInTheDocument();
    expect(within(lista).queryByText('lançando')).toBeNull();
    semBotaoDeAlterar();
  });

  it('nas unidades de trabalho, as mesmas telas continuam com os botões de sempre (a faixa e o modo só aparecem na consulta)', async () => {
    // sem unidade escolhida, o chefe trabalha na DivOp (o nível de acesso dele)
    api(CHEFE, { 'GET /api/unidades/u-divop/cotas': { status: 200, corpo: COTAS } });
    abrir('/cotas');
    await screen.findByRole('table');
    expect(screen.queryByText(/^Só consulta:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar cota' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar cota de JES (interna)' })).toBeInTheDocument();
  });
});

describe('o trilho e o endereço numa unidade só de consulta', () => {
  it('o trilho tem só Grade geral, Escala do mês, Efetivo por dia, Voluntariado e Cotas, e o pé não aparece', async () => {
    api();
    abrirEmConsulta('/grade');
    const trilho = await screen.findByRole('navigation', { name: 'Navegação principal' });
    expect(within(trilho).getAllByRole('link').filter((l) => l.getAttribute('aria-label') !== 'Ir para o início').map((l) => l.textContent)).toEqual(['Grade geral', 'Escala do mês', 'Efetivo por dia', 'Voluntariado', 'Cotas']);
    for (const fora of ['Oficiais', 'Militares', 'Turnos', 'Escalas', 'Feriados', 'Configurações', 'Estrutura', 'Histórico', 'Ajuda']) expect(within(trilho).queryByText(fora), fora).toBeNull();
  });

  it('abrir uma tela de cadastro nesse modo leva à Grade geral (Militares, Turnos, Escalas, Feriados, Oficiais e Configurações da escala)', async () => {
    for (const caminho of ['/militares', '/servicos', '/escalas', '/feriados', '/oficiais', '/configuracoes-da-escala']) {
      guardarUnidadeDeConsulta('u-2sb');
      api();
      const router = abrir(caminho);
      await waitFor(() => expect(router.state.location.pathname, caminho).toBe('/grade'));
      expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
      screen.getByRole('heading', { name: 'Grade geral' });
      document.body.innerHTML = '';
    }
  });

  it('o Pecúlio, que é de outro módulo, continua aberto: a unidade dele é a do nível de acesso mais alto', async () => {
    const f = api(CHEFE, { [`GET /api/unidades/u-divop/peculio`]: { status: 200, corpo: { militares: [] } } });
    const router = abrirEmConsulta('/peculio');
    await screen.findByRole('heading', { name: 'Pecúlio' });
    expect(router.state.location.pathname).toBe('/peculio');
    await waitFor(() => expect(chamadasA(f, 'GET /api/unidades/u-divop/peculio')).toBeGreaterThan(0));
  });
});

describe('quem só tem unidades de consulta: o oficial, com a marca ligada', () => {
  it('vê o cartão "Confecção de escalas" na tela inicial', async () => {
    api(OFICIAL);
    abrir('/');
    const cartao = await screen.findByRole('link', { name: /Confecção de escalas/ });
    expect(cartao).toHaveAttribute('href', '/grade');
    // o Pecúlio é de todos; sem nível de acesso, o cartão leva direto à Consulta de militares
    expect(screen.getByRole('link', { name: /Pecúlio/ })).toHaveAttribute('href', '/consulta');
  });

  it('sem nenhuma unidade de consulta, o cartão não aparece (o militar comum de sempre)', async () => {
    api({ ...OFICIAL, unidadesSoConsulta: [] });
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /Confecção de escalas/ })).toBeNull();
  });

  it('entra já no modo de consulta, na lotação dele, e a Grade geral abre (não diz que é só de auxiliares e gestores)', async () => {
    const f = api(OFICIAL);
    const router = abrir('/grade');
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/grade');
    await screen.findByRole('table', { name: /Grade geral/ });
    expect(screen.queryByText(/dos auxiliares administrativos e gestores/)).toBeNull();
    expect(chamadasA(f, `GET /api/unidades/u-2sb/grade/${MES}`)).toBeGreaterThan(0);
  });

  it('o seletor só tem o grupo "Só consulta", com a corporação inteira na ordem da árvore', async () => {
    api(OFICIAL);
    abrir('/grade');
    await userEvent.click(await screen.findByRole('button', { name: /Unidade de trabalho/ }));
    const itens = await screen.findAllByRole('menuitem');
    expect(itens.map((i) => i.textContent)).toEqual(['2º GB', 'DivOp', '1ª SB', 'DA', '2ª SB']);
    expect(itens.every((i) => i.hasAttribute('data-so-consulta'))).toBe(true);
    expect(screen.getByText('Só consulta')).toBeInTheDocument();
  });

  it('a lotação do oficial está nas duas listas do /api/eu, e vale como de consulta: sem botão de alterar na Escala do mês', async () => {
    api(OFICIAL);
    abrir('/escala-do-mes');
    expect(await screen.findByText(FAIXA_DE_CONSULTA)).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Dia 1' });
    semBotaoDeAlterar();
  });
});

describe('acabamento do modo só consulta (6.17, itens 29 e 30)', () => {
  it('item 29: o vazio da Escala do mês não mostra o link "Crie uma em Escalas" (a pessoa não cria nada)', async () => {
    api(CHEFE, { 'GET /api/unidades/u-2sb/escalas': { status: 200, corpo: [] } });
    abrirEmConsulta('/escala-do-mes');
    expect(await screen.findByRole('heading', { name: 'Nenhuma escala ativa' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Escalas' })).toBeNull();
    expect(screen.queryByText(/Crie uma em/)).toBeNull();
  });

  it('item 30: os trechos ocupados do Efetivo por dia não são paradas do teclado (o horário está no nome e na dica)', async () => {
    api();
    abrirEmConsulta(`/efetivo-por-dia?dia=${DIA_DO_EFETIVO}`);
    await screen.findByText(FAIXA_DE_CONSULTA);
    const ocupado = (await screen.findAllByRole('group', { name: /Motorista: SD ALFA/ }))[0]!;
    expect(ocupado).not.toHaveAttribute('tabindex');
  });
});

