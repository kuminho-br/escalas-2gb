import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { entrarNoModo, sairDoModo } from '@/laboratorio/modo';
import { abrir, corpoEnviado, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// 6.60, Task 2: a lista das ferramentas em teste, o retorno e a tela do administrador. Dados fictícios (D7).
const FERRAMENTAS = [
  { id: 'f1', nome: 'Grade nova', oQueTestar: 'Abra a grade e marque um serviço.', caminho: '/grade', situacao: 'em_teste', inicio: '2026-11-27', fim: null },
  { id: 'f2', nome: 'Voluntariado em lista', oQueTestar: 'Marque os dias em que quer servir.', caminho: null, situacao: 'em_teste', inicio: '2026-11-20', fim: null },
  { id: 'f3', nome: 'Painel antigo', oQueTestar: 'Já acabou.', caminho: null, situacao: 'encerrada', inicio: '2026-10-01', fim: '2026-11-01' },
  { id: 'f4', nome: 'Aniversários', oQueTestar: 'Virou módulo.', caminho: null, situacao: 'virou_modulo', inicio: '2026-09-01', fim: '2026-10-15' },
];
const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador', unidadeId: 'u-raiz', unidadeSigla: 'CBMPE' }] };
const RETORNOS = [
  { id: 'r1', ferramentaId: 'f1', ferramenta: 'Grade nova', conta: { nome: 'SD ANDRADE', matricula: '100201-1' }, perfilDeTeste: 'Gestor de teste', tela: '/grade', texto: 'Ficou claro.\nGostei do painel.', nota: 5, criadoEm: '2026-11-27T15:30:00Z' },
  { id: 'r2', ferramentaId: 'f2', ferramenta: 'Voluntariado em lista', conta: { nome: 'CB LIMA', matricula: '100202-2' }, perfilDeTeste: 'Militar de teste', tela: '/meu-voluntariado', texto: 'Confuso.', nota: 2, criadoEm: '2026-11-26T12:00:00Z' },
];
const PERFIL = { perfilId: 'p-gestor', nome: 'Gestor de teste', nivel: 'gestor' };
const base = {
  '/api/eu': { status: 200, corpo: EU_EXEMPLO },
  '/api/lab/eu': { status: 200, corpo: EU_EXEMPLO },
  'GET /api/laboratorio/eu': { status: 200, corpo: PERFIL },
  '/api/laboratorio/ferramentas': { status: 200, corpo: FERRAMENTAS },
};

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  sairDoModo();
  sessionStorage.clear();
});

describe('as ferramentas em teste, no Laboratório', () => {
  it('a tela inicial do Laboratório lista as ferramentas com "O que testar" e a situação; as que acabaram ficam abaixo, sem botões', async () => {
    simularApi(base);
    entrarNoModo();
    abrir('/');
    const secao = await screen.findByRole('region', { name: 'Ferramentas em teste' });
    const itens = await within(secao).findAllByRole('listitem');
    expect(itens.map((li) => li.querySelector('b')?.textContent)).toEqual(['Grade nova', 'Voluntariado em lista', 'Painel antigo', 'Aniversários']);
    expect(itens[0]).toHaveTextContent('O que testar: Abra a grade e marque um serviço.');
    expect(itens.map((li) => li.getAttribute('data-situacao'))).toEqual(['em_teste', 'em_teste', 'encerrada', 'virou_modulo']);
    expect(within(itens[2]!).queryByRole('button')).not.toBeInTheDocument();
    expect(within(itens[3]!).queryByRole('button', { name: 'Deixar retorno' })).not.toBeInTheDocument();
  });

  it('a ferramenta com caminho tem um atalho que leva até ela; a sem caminho não tem', async () => {
    simularApi(base);
    entrarNoModo();
    abrir('/');
    const secao = await screen.findByRole('region', { name: 'Ferramentas em teste' });
    expect(await within(secao).findByRole('link', { name: 'Abrir Grade nova' })).toHaveAttribute('href', '/grade');
    expect(within(secao).queryByRole('link', { name: /Abrir Voluntariado/ })).not.toBeInTheDocument();
  });

  it('sem ferramenta em teste, a frase fixa', async () => {
    simularApi({ ...base, '/api/laboratorio/ferramentas': { status: 200, corpo: [] } });
    entrarNoModo();
    abrir('/');
    expect(await screen.findByText('Nenhuma ferramenta em teste agora.')).toBeInTheDocument();
  });

  it('fora do Laboratório, a lista e o botão não aparecem', async () => {
    simularApi(base);
    abrir('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Ferramentas em teste' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deixar retorno' })).not.toBeInTheDocument();
  });
});

describe('deixar retorno', () => {
  async function abrirJanela(rotas: Record<string, unknown> = {}) {
    const f = simularApi({ ...base, ...rotas } as never);
    entrarNoModo();
    abrir('/');
    const secao = await screen.findByRole('region', { name: 'Ferramentas em teste' });
    await userEvent.click((await within(secao).findAllByRole('button', { name: 'Deixar retorno' }))[0]!);
    return { f, janela: await screen.findByRole('dialog') };
  }

  it('abre com "O que você achou?" e "Nota" de 1 a 5, grava a tela de onde a pessoa estava e confirma', async () => {
    const { f, janela } = await abrirJanela({ 'POST /api/laboratorio/retornos': { status: 201, corpo: { ok: true } } });
    expect(within(janela).getByLabelText('O que você achou?')).toBeInTheDocument();
    const nota = within(janela).getByRole('group', { name: 'Nota' });
    expect(within(nota).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
    await userEvent.type(within(janela).getByLabelText('O que você achou?'), 'Gostei muito.');
    await userEvent.click(within(nota).getByLabelText('4'));
    await userEvent.click(within(janela).getByRole('button', { name: 'Enviar retorno' }));
    expect(await screen.findByText('Retorno enviado. Obrigado.')).toBeInTheDocument();
    expect(corpoEnviado(f, 'POST /api/laboratorio/retornos')).toEqual({ ferramentaId: 'f1', tela: '/', texto: 'Gostei muito.', nota: 4 });
    // o retorno vai para a rota do real: nunca para /api/lab
    expect(chamadasA(f, 'POST /api/lab/laboratorio/retornos')).toBe(0);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem nota, a janela pede a nota e não envia', async () => {
    const { f, janela } = await abrirJanela({ 'POST /api/laboratorio/retornos': { status: 201, corpo: { ok: true } } });
    await userEvent.type(within(janela).getByLabelText('O que você achou?'), 'Sem nota.');
    await userEvent.click(within(janela).getByRole('button', { name: 'Enviar retorno' }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Escolha uma nota de 1 a 5.');
    expect(chamadasA(f, 'POST /api/laboratorio/retornos')).toBe(0);
  });

  it('o erro da API aparece na janela, que continua aberta com o texto escrito', async () => {
    const { janela } = await abrirJanela({ 'POST /api/laboratorio/retornos': { status: 400, corpo: { erro: 'Esta ferramenta não está mais em teste.' } } });
    await userEvent.type(within(janela).getByLabelText('O que você achou?'), 'Tarde demais.');
    await userEvent.click(within(janela).getByLabelText('3'));
    await userEvent.click(within(janela).getByRole('button', { name: 'Enviar retorno' }));
    expect(await within(janela).findByRole('alert')).toHaveTextContent('Esta ferramenta não está mais em teste.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(janela).getByLabelText('O que você achou?')).toHaveValue('Tarde demais.');
  });

  it('o botão da faixa também abre a janela, com a ferramenta para escolher', async () => {
    simularApi(base);
    entrarNoModo();
    abrir('/');
    const faixa = await screen.findByRole('region', { name: 'Laboratório' });
    await userEvent.click(await within(faixa).findByRole('button', { name: 'Deixar retorno' }));
    const janela = await screen.findByRole('dialog');
    expect(within(janela).getByLabelText('Ferramenta')).toHaveTextContent('Grade nova');
  });
});

describe('os retornos e o cadastro, para o administrador', () => {
  const rotasDoAdmin = { ...base, '/api/eu': { status: 200, corpo: ADMIN }, '/api/laboratorio/retornos': { status: 200, corpo: RETORNOS } };

  it('só o administrador real vê o cartão "Retornos do Laboratório"; ele leva à tela', async () => {
    simularApi(rotasDoAdmin);
    const router = abrir('/');
    await userEvent.click(await screen.findByRole('link', { name: /Retornos do Laboratório/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/laboratorio/retornos'));
  });

  it('quem não é administrador não vê o cartão e, se abrir o endereço, volta ao início', async () => {
    simularApi({ ...base, '/api/laboratorio/retornos': { status: 200, corpo: RETORNOS } });
    const router = abrir('/laboratorio/retornos');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(screen.queryByRole('link', { name: /Retornos do Laboratório/ })).not.toBeInTheDocument();
  });

  it('dentro do Laboratório, nem o perfil de administrador abre a tela (ela é da conta real)', async () => {
    simularApi({ ...rotasDoAdmin, '/api/lab/eu': { status: 200, corpo: ADMIN } });
    entrarNoModo();
    const router = abrir('/laboratorio/retornos');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('a lista traz quem deixou (nome e matrícula), o perfil usado, a tela, a nota e o texto; filtra por ferramenta e por período', async () => {
    const f = simularApi(rotasDoAdmin);
    abrir('/laboratorio/retornos');
    const primeiro = (await screen.findByText(/Ficou claro./)).closest('li')!;
    expect(primeiro).toHaveTextContent('SD ANDRADE');
    expect(primeiro).toHaveTextContent('100201-1');
    expect(primeiro).toHaveTextContent('testando como Gestor de teste');
    expect(primeiro).toHaveTextContent('na tela /grade');
    expect(within(primeiro).getByLabelText('Nota 5 de 5')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Ferramenta'), 'f2');
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).includes('/api/laboratorio/retornos?ferramenta=f2'))).toBe(true));
    await userEvent.type(screen.getByLabelText('De'), '2026-11-01');
    await userEvent.type(screen.getByLabelText('Até'), '2026-11-30');
    await waitFor(() => expect(f.mock.calls.some(([e]) => /ferramenta=f2&de=2026-11-01&ate=2026-11-30/.test(String(e)))).toBe(true));
  });

  it('sem retorno, a tela diz isso', async () => {
    simularApi({ ...rotasDoAdmin, '/api/laboratorio/retornos': { status: 200, corpo: [] } });
    abrir('/laboratorio/retornos');
    expect(await screen.findByText('Nenhum retorno')).toBeInTheDocument();
  });

  it('a aba Ferramentas cadastra uma ferramenta (nome, o que testar, caminho) e muda a situação', async () => {
    const f = simularApi({ ...rotasDoAdmin, 'POST /api/laboratorio/ferramentas': { status: 201, corpo: FERRAMENTAS[0] }, 'PATCH /api/laboratorio/ferramentas/f1': { status: 200, corpo: { ...FERRAMENTAS[0], situacao: 'encerrada' } } });
    abrir('/laboratorio/retornos');
    await userEvent.click(await screen.findByRole('tab', { name: 'Ferramentas' }));
    await userEvent.type(await screen.findByLabelText('Nome'), 'Escala em lista');
    await userEvent.type(screen.getByLabelText('O que testar'), 'Monte uma escala.');
    await userEvent.type(screen.getByLabelText('Caminho no Laboratório (opcional)'), '/escalas');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar ferramenta' }));
    expect(await screen.findByText('Ferramenta cadastrada.')).toBeInTheDocument();
    expect(corpoEnviado(f, 'POST /api/laboratorio/ferramentas')).toEqual({ nome: 'Escala em lista', oQueTestar: 'Monte uma escala.', caminho: '/escalas' });
    await userEvent.selectOptions(screen.getByLabelText('Situação de Grade nova'), 'encerrada');
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/laboratorio/ferramentas/f1')).toEqual({ situacao: 'encerrada' }));
  });

  it('um erro do cadastro aparece no formulário', async () => {
    simularApi({ ...rotasDoAdmin, 'POST /api/laboratorio/ferramentas': { status: 400, corpo: { erro: 'Confira os campos destacados.', campos: { caminho: 'O caminho começa com /.' } } } });
    abrir('/laboratorio/retornos');
    await userEvent.click(await screen.findByRole('tab', { name: 'Ferramentas' }));
    await userEvent.type(await screen.findByLabelText('Nome'), 'X');
    await userEvent.type(screen.getByLabelText('O que testar'), 'Y');
    await userEvent.type(screen.getByLabelText('Caminho no Laboratório (opcional)'), 'grade');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar ferramenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('O caminho começa com /.');
  });
});
