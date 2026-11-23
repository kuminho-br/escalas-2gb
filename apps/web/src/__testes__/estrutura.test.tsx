import type { EfeitoDeMover, NoDaArvore, TipoDeUnidadeComUso } from 'contratos';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.25, Task 4: a árvore de unidades, editável. Dados fictícios.
const GB = { id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento' };
const SB1 = EU_EXEMPLO.unidades[0]!;
const GESTOR_GB = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }], unidades: [GB, SB1] };
const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }], unidades: [{ id: 'raiz', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao' }, GB, SB1] };

const TIPOS: TipoDeUnidadeComUso[] = [
  { id: 't-gb', codigo: 'grupamento', nome: 'Grupamento', ordem: 3, unidades: 1 },
  { id: 't-div', codigo: 'divisao', nome: 'Divisão', ordem: 4, unidades: 2 },
  { id: 't-sec', codigo: 'secao', nome: 'Seção', ordem: 5, unidades: 3 },
];
const tipo = (codigo: string) => { const t = TIPOS.find((x) => x.codigo === codigo)!; return { codigo: t.codigo, nome: t.nome, ordem: t.ordem }; };

type Extra = Partial<NoDaArvore> & { filhas?: NoDaArvore[] };
/** Um nó que a pessoa edita e reorganiza, sem nada ligado; `extra` muda o que for preciso. */
const no = (id: string, sigla: string, nome: string, codigoDoTipo: string, extra: Extra = {}): NoDaArvore => ({
  id, sigla, nome, tipo: tipo(codigoDoTipo), desde: '2026-01-01', ate: null, filhas: [], podeEditar: true, podeReorganizar: true,
  ligados: { unidades: 0, militaresHoje: 0, historico: [] }, ...extra,
});
const ARVORE: NoDaArvore = no('u-gb', '2º GB', '2º Grupamento de Bombeiros', 'grupamento', {
  podeReorganizar: false,
  ligados: { unidades: 4, militaresHoje: 2, historico: ['3 unidades abaixo'] },
  filhas: [
    no('u-1sb', '1ª SB', '1ª Seção de Bombeiros', 'secao', { ligados: { unidades: 0, militaresHoje: 12, historico: ['12 militares que já foram lotados'] } }),
    no('u-da', 'DA', 'Divisão Administrativa', 'divisao', { ligados: { unidades: 1, militaresHoje: 0, historico: ['1 unidade abaixo'] }, filhas: [no('u-3sb', '3ª SB', '3ª Seção de Bombeiros', 'secao')] }),
    no('u-divop', 'DivOp', 'Divisão Operacional', 'divisao'),
  ],
});
const EFEITO: EfeitoDeMover = {
  passamAAlcancar: [{ nome: 'SD LATERAL', papel: 'gestor_lateral', unidadeSigla: 'DivOp' }],
  deixamDeAlcancar: [], passamAVer: [], deixamDeVer: [{ nome: 'CB FULANO', papel: 'gestor_lateral', unidadeSigla: 'DA' }],
  deixaDeHerdar: [], passaAHerdar: [{ unidadeSigla: 'DivOp', parametros: 0, feriados: 1, funcoes: 0 }], irmasNovas: ['4ª SB'],
};

const ESTRUTURA = 'GET /api/estrutura';
function comEstrutura(extra: Parameters<typeof simularApi>[0] = {}, eu: typeof EU_EXEMPLO = GESTOR_GB, arvore: NoDaArvore = ARVORE) {
  return simularApi({ '/api/eu': { status: 200, corpo: eu }, [ESTRUTURA]: { status: 200, corpo: arvore }, 'GET /api/tipos-de-unidade': { status: 200, corpo: TIPOS }, ...extra });
}
const siglas = (lista: HTMLElement) => [...lista.querySelectorAll('[data-sigla]')].map((l) => l.getAttribute('data-sigla'));
const abrirMenu = async (sigla: string) => userEvent.click(await screen.findByRole('button', { name: `Ações de ${sigla}` }));

describe('a árvore de unidades (6.25)', () => {
  it('mostra a árvore com recuo: sigla, nome, o tipo numa etiqueta neutra e quantos militares estão lotados hoje', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    const arvore = await screen.findByRole('list', { name: 'Estrutura de 2º GB' });
    expect(siglas(arvore)).toEqual(['2º GB', '1ª SB', 'DA', '3ª SB', 'DivOp']);
    // o recuo: a 3ª SB está numa lista dentro da DA, que está numa lista dentro do 2º GB
    expect(within(screen.getByRole('list', { name: 'Dentro de DA' })).getByText('3ª SB')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Dentro de 2º GB' })).toBeInTheDocument();
    const sb1 = arvore.querySelector('[data-sigla="1ª SB"]') as HTMLElement;
    expect(within(sb1).getByText('1ª Seção de Bombeiros')).toBeInTheDocument();
    expect(within(sb1).getByText('Seção')).toBeInTheDocument();
    expect(within(sb1).getByText('12 lotados')).toBeInTheDocument();
    // sem militares lotados, nada dito; com um só, no singular
    expect(within(arvore.querySelector('[data-sigla="DivOp"]') as HTMLElement).queryByText(/lotado/)).toBeNull();
    expect(within(arvore.querySelector('[data-sigla="2º GB"]')!.firstElementChild as HTMLElement).getByText('2 lotados')).toBeInTheDocument();
  });

  it('recolhe e abre por unidade', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    const arvore = await screen.findByRole('list', { name: 'Estrutura de 2º GB' });
    await userEvent.click(screen.getByRole('button', { name: 'Recolher DA' }));
    expect(siglas(arvore)).toEqual(['2º GB', '1ª SB', 'DA', 'DivOp']);
    expect(screen.getByRole('button', { name: 'Abrir DA' })).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir DA' }));
    expect(siglas(arvore)).toEqual(['2º GB', '1ª SB', 'DA', '3ª SB', 'DivOp']);
    // a unidade sem filhas não tem o botão
    expect(screen.queryByRole('button', { name: /(Recolher|Abrir) DivOp/ })).toBeNull();
  });

  it('em 390 px nada rola de lado: a linha quebra em vez de empurrar a página', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    const arvore = await screen.findByRole('list', { name: 'Estrutura de 2º GB' });
    expect(arvore.className).not.toMatch(/overflow-x/);
    const linha = (arvore.querySelector('[data-sigla="1ª SB"]') as HTMLElement).firstElementChild as HTMLElement;
    expect(linha.className).toContain('flex-wrap');
  });

  it('o menu da linha tem só o que a pessoa pode fazer: na unidade dela, nova e renomear; nas de baixo, também mover, extinguir e excluir', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('2º GB');
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Nova unidade abaixo', 'Renomear']);
    await userEvent.keyboard('{Escape}');
    await abrirMenu('DivOp');
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Nova unidade abaixo', 'Renomear', 'Mover para…', 'Extinguir', 'Excluir']);
  });

  it('"Excluir" só aparece quando não há nada ligado: com histórico, só "Extinguir"', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    for (const sigla of ['1ª SB', 'DA']) {
      await abrirMenu(sigla);
      expect(screen.getAllByRole('menuitem').map((m) => m.textContent), sigla).toEqual(['Nova unidade abaixo', 'Renomear', 'Mover para…', 'Extinguir']);
      await userEvent.keyboard('{Escape}');
    }
  });

  it('"Extinguir" diz o que está ligado e o que falta mover', async () => {
    comEstrutura();
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DA');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Extinguir' }));
    const janela = await screen.findByRole('dialog', { name: 'Extinguir DA?' });
    expect(within(janela).getByText(/Ligado a esta unidade: 1 unidade abaixo\./)).toBeInTheDocument();
    expect(within(janela).getByText('Antes de extinguir, mova 1 unidades e 0 militares lotados.')).toBeInTheDocument();
  });

  it('extingue pela data do último dia, e a árvore é buscada de novo', async () => {
    const f = comEstrutura({ 'POST /api/unidades/u-divop/extinguir': { status: 200, corpo: { id: 'u-divop', ate: '2026-12-31' } } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DivOp');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Extinguir' }));
    const janela = await screen.findByRole('dialog', { name: 'Extinguir DivOp?' });
    const data = within(janela).getByLabelText('Último dia da unidade');
    await userEvent.clear(data);
    await userEvent.type(data, '2026-12-31');
    await userEvent.click(within(janela).getByRole('button', { name: 'Extinguir' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-divop/extinguir')).toEqual({ ate: '2026-12-31' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, ESTRUTURA)).toBeGreaterThan(1);
  });

  it('o 409 de extinguir aparece na janela, que continua aberta', async () => {
    comEstrutura({ 'POST /api/unidades/u-divop/extinguir': { status: 409, corpo: { erro: 'Antes de extinguir, mova 1 unidades e 2 militares lotados.' } } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DivOp');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Extinguir' }));
    const janela = await screen.findByRole('dialog');
    await userEvent.click(within(janela).getByRole('button', { name: 'Extinguir' }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Antes de extinguir, mova 1 unidades e 2 militares lotados.');
  });

  it('exclui a unidade sem nada ligado, depois de confirmar', async () => {
    const f = comEstrutura({ 'DELETE /api/unidades/u-divop': { status: 204 } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DivOp');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    const janela = await screen.findByRole('dialog', { name: 'Excluir DivOp?' });
    expect(chamadasA(f, 'DELETE /api/unidades/u-divop')).toBe(0);
    await userEvent.click(within(janela).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/unidades/u-divop')).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('cria uma unidade abaixo de outra: sigla, nome, tipo e o mês em que passa a valer', async () => {
    const f = comEstrutura({ 'POST /api/unidades': { status: 201, corpo: no('u-nova', 'DEns', 'Divisão de Ensino', 'divisao') } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('2º GB');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nova unidade abaixo' }));
    const janela = await screen.findByRole('dialog', { name: 'Nova unidade abaixo de 2º GB' });
    await userEvent.type(within(janela).getByLabelText('Sigla'), 'DEns');
    await userEvent.type(within(janela).getByLabelText('Nome'), 'Divisão de Ensino');
    await userEvent.selectOptions(within(janela).getByLabelText('Tipo'), 'divisao');
    const mes = within(janela).getByLabelText('Vale a partir de');
    await userEvent.clear(mes);
    await userEvent.type(mes, '2026-12');
    await userEvent.click(within(janela).getByRole('button', { name: 'Criar unidade' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades')).toEqual({ maeId: 'u-gb', tipo: 'divisao', sigla: 'DEns', nome: 'Divisão de Ensino', desde: '2026-12-01' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, ESTRUTURA)).toBeGreaterThan(1);
  });

  it('a sigla repetida entre irmãs aparece no campo da janela', async () => {
    const aviso = 'Já existe 1ª SB abaixo de 2º GB.';
    comEstrutura({ 'POST /api/unidades': { status: 409, corpo: { erro: aviso, campos: { sigla: aviso } } } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('2º GB');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nova unidade abaixo' }));
    const janela = await screen.findByRole('dialog');
    await userEvent.type(within(janela).getByLabelText('Sigla'), '1ª SB');
    await userEvent.type(within(janela).getByLabelText('Nome'), 'Repetida');
    await userEvent.click(within(janela).getByRole('button', { name: 'Criar unidade' }));
    await waitFor(() => expect(within(janela).getByLabelText('Sigla')).toHaveAccessibleDescription(aviso));
  });

  it('renomeia sigla, nome e tipo, mandando só o que mudou', async () => {
    const f = comEstrutura({ 'PATCH /api/unidades/u-da': { status: 200, corpo: no('u-da', 'DAdm', 'Divisão Administrativa', 'divisao') } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DA');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    const janela = await screen.findByRole('dialog', { name: 'Renomear DA' });
    expect(within(janela).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    const sigla = within(janela).getByLabelText('Sigla');
    await userEvent.clear(sigla);
    await userEvent.type(sigla, 'DAdm');
    await userEvent.selectOptions(within(janela).getByLabelText('Tipo'), 'secao');
    await userEvent.click(within(janela).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/unidades/u-da')).toEqual({ sigla: 'DAdm', tipo: 'secao' }));
  });
});

describe('mover para… (6.25)', () => {
  it('abre a árvore de destino só com as unidades permitidas (sem a própria unidade e as de baixo) e mostra o efeito antes de salvar', async () => {
    const f = comEstrutura({ 'GET /api/unidades/u-da/efeito-de-mover': { status: 200, corpo: EFEITO }, 'PATCH /api/unidades/u-da': { status: 200, corpo: ARVORE } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DA');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para…' }));
    const janela = await screen.findByRole('dialog', { name: 'Mover DA para…' });
    // a DA e a 3ª SB (dentro dela) não são destino
    expect(within(janela).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['u-gb', 'u-1sb', 'u-divop']);
    // sem escolher, não há o que confirmar
    expect(within(janela).getByRole('button', { name: 'Mover' })).toBeDisabled();
    await userEvent.click(within(janela).getByRole('radio', { name: /DivOp/ }));
    const efeito = await within(janela).findByLabelText('O que muda');
    expect(within(efeito).getByText('Passam a alcançar a unidade')).toBeInTheDocument();
    expect(within(efeito).getByText('SD LATERAL, Coordenador em DivOp')).toBeInTheDocument();
    expect(within(efeito).getByText('Deixam de ver a unidade')).toBeInTheDocument();
    expect(within(efeito).getByText('CB FULANO, Coordenador em DA')).toBeInTheDocument();
    expect(within(efeito).getByText('DivOp: 1 feriados')).toBeInTheDocument();
    expect(within(efeito).getByText('4ª SB')).toBeInTheDocument();
    // só o "Mover" grava
    expect(chamadasA(f, 'PATCH /api/unidades/u-da')).toBe(0);
    await userEvent.click(within(janela).getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/unidades/u-da')).toEqual({ maeId: 'u-divop' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // o que a unidade herda mudou: tudo o que já foi carregado é buscado de novo
    expect(chamadasA(f, ESTRUTURA)).toBeGreaterThan(1);
  });

  it('só oferece de destino as unidades que a pessoa edita', async () => {
    const parcial = no('u-gb', '2º GB', '2º Grupamento de Bombeiros', 'grupamento', {
      podeReorganizar: false,
      filhas: [no('u-1sb', '1ª SB', '1ª Seção', 'secao'), no('u-fora', 'FORA', 'Fora da árvore dele', 'secao', { podeEditar: false }), no('u-da', 'DA', 'Divisão', 'divisao')],
    });
    comEstrutura({}, GESTOR_GB, parcial);
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DA');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para…' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['u-gb', 'u-1sb']);
  });

  it('o erro ao mover aparece na janela, que continua aberta', async () => {
    comEstrutura({ 'GET /api/unidades/u-da/efeito-de-mover': { status: 200, corpo: EFEITO }, 'PATCH /api/unidades/u-da': { status: 400, corpo: { erro: 'Uma unidade não pode ficar abaixo de si mesma.' } } });
    abrir('/configuracoes?aba=estrutura');
    await abrirMenu('DA');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para…' }));
    const janela = await screen.findByRole('dialog');
    await userEvent.click(within(janela).getByRole('radio', { name: /DivOp/ }));
    await within(janela).findByLabelText('O que muda');
    await userEvent.click(within(janela).getByRole('button', { name: 'Mover' }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Uma unidade não pode ficar abaixo de si mesma.');
  });
});

describe('quem vê a aba Estrutura (6.25)', () => {
  it('o auxiliar, o gestor e o administrador veem a aba', async () => {
    for (const [eu, aparece] of [[EU_EXEMPLO, true], [GESTOR_GB, true], [ADMIN, true]] as const) {
      comEstrutura({}, eu);
      abrir('/configuracoes');
      await screen.findByRole('tab', { name: 'Regras do processo' });
      expect(screen.queryAllByRole('tab', { name: 'Estrutura' }), JSON.stringify(eu.papeis)).toHaveLength(aparece ? 1 : 0);
      cleanup();
    }
  });

  it('o auxiliar vê a árvore sem nenhum menu de ações', async () => {
    comEstrutura({}, EU_EXEMPLO, no('u-1sb', '1ª SB', '1ª Seção', 'secao', { podeEditar: false, podeReorganizar: false }));
    abrir('/configuracoes?aba=estrutura');
    await screen.findByRole('list', { name: 'Estrutura de 1ª SB' });
    expect(screen.queryByRole('button', { name: /Ações de/ })).toBeNull();
    expect(screen.getByText(/Você só consulta/)).toBeInTheDocument();
  });

  it('quem tem nível em duas árvores separadas escolhe de qual quer ver', async () => {
    const dois = { ...GESTOR_GB, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-gb', unidadeSigla: '2º GB' }, { papel: 'gestor' as const, unidadeId: 'u-gb9', unidadeSigla: '9º GB' }], unidades: [GB, { id: 'u-gb9', sigla: '9º GB', caminho: ['CBMPE', 'DGO', 'DInter/9', '9º GB'], nivel: 3, tipo: 'grupamento' }] };
    const f = comEstrutura({}, dois);
    abrir('/configuracoes?aba=estrutura');
    const seletor = await screen.findByLabelText('Árvore de');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['2º GB', '9º GB']);
    fireEvent.change(seletor, { target: { value: 'u-gb9' } });
    await waitFor(() => expect(f.mock.calls.map(([e]) => String(e)).filter((e) => e.includes('estrutura'))).toContain('/api/estrutura?raiz=u-gb9'));
  });
});
