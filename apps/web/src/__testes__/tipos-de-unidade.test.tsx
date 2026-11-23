import type { TipoDeUnidadeComUso } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.25, Task 4: o cadastro "Tipos de unidade" (só o administrador). Dados fictícios.
const ADMIN = { ...EU_EXEMPLO, papeis: [{ papel: 'administrador' as const, unidadeId: 'raiz', unidadeSigla: 'CBMPE' }], unidades: [{ id: 'raiz', sigla: 'CBMPE', caminho: ['CBMPE'], nivel: 0, tipo: 'corporacao' }] };
const GESTOR = { ...EU_EXEMPLO, papeis: [{ papel: 'gestor' as const, unidadeId: 'u-1sb', unidadeSigla: '1ª SB' }] };
const TIPOS: TipoDeUnidadeComUso[] = [
  { id: 't-div', codigo: 'divisao', nome: 'Divisão', ordem: 4, unidades: 2 },
  { id: 't-sec', codigo: 'secao', nome: 'Seção', ordem: 5, unidades: 1 },
  { id: 't-pel', codigo: 'pelotao', nome: 'Pelotão', ordem: 6, unidades: 0 },
];
const TIPOS_ROTA = 'GET /api/tipos-de-unidade';
function api(extra: Parameters<typeof simularApi>[0] = {}, eu: typeof ADMIN = ADMIN) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    [TIPOS_ROTA]: { status: 200, corpo: TIPOS },
    'GET /api/estrutura': { status: 200, corpo: { id: 'raiz', sigla: 'CBMPE', nome: 'Corpo', tipo: { codigo: 'divisao', nome: 'Divisão', ordem: 4 }, desde: '2026-01-01', ate: null, filhas: [], podeEditar: true, podeReorganizar: false, ligados: { unidades: 0, militaresHoje: 0, historico: [] } } },
    ...extra,
  });
}

describe('configurações: tipos de unidade (6.25)', () => {
  it('a aba só aparece para o administrador', async () => {
    for (const [eu, aparece] of [[EU_EXEMPLO, false], [GESTOR, false], [ADMIN, true]] as const) {
      api({}, eu as typeof ADMIN);
      abrir('/configuracoes');
      await screen.findByRole('tab', { name: 'Minhas preferências' });
      expect(screen.queryAllByRole('tab', { name: 'Tipos de unidade' })).toHaveLength(aparece ? 1 : 0);
      cleanup();
    }
  });

  it('lista os tipos na ordem, com quantas unidades usam cada um', async () => {
    api();
    abrir('/configuracoes?aba=tipos-de-unidade');
    expect(await screen.findByText('2 unidades · ordem 4')).toBeInTheDocument();
    expect(screen.getByText('1 unidade · ordem 5')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma unidade · ordem 6')).toBeInTheDocument();
    // na ordem do cadastro
    const nomes = ['Divisão', 'Seção', 'Pelotão'].map((n) => screen.getByText(n).closest('li')!);
    expect(nomes[0]!.nextElementSibling).toBe(nomes[1]);
    expect(nomes[1]!.nextElementSibling).toBe(nomes[2]);
  });

  it('cria um tipo, com ou sem ordem', async () => {
    const f = api({ 'POST /api/tipos-de-unidade': { status: 201, corpo: { id: 't-x', codigo: 'brigada', nome: 'Brigada', ordem: 7, unidades: 0 } } });
    abrir('/configuracoes?aba=tipos-de-unidade');
    await userEvent.type(await screen.findByLabelText('Novo tipo de unidade'), 'Brigada');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/tipos-de-unidade')).toEqual({ nome: 'Brigada' }));
    await waitFor(() => expect(screen.getByLabelText('Novo tipo de unidade')).toHaveValue(''));
    await userEvent.type(screen.getByLabelText('Novo tipo de unidade'), 'Destacamento');
    await userEvent.type(screen.getByLabelText('Ordem (opcional)'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/tipos-de-unidade')).toBe(2));
    expect(corpoEnviado(f, 'POST /api/tipos-de-unidade')).toEqual({ nome: 'Destacamento', ordem: 2 });
  });

  it('o nome repetido aparece no campo', async () => {
    const aviso = 'Já existe um tipo com este nome.';
    api({ 'POST /api/tipos-de-unidade': { status: 409, corpo: { erro: aviso, campos: { nome: aviso } } } });
    abrir('/configuracoes?aba=tipos-de-unidade');
    await userEvent.type(await screen.findByLabelText('Novo tipo de unidade'), 'Seção');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(screen.getByLabelText('Novo tipo de unidade')).toHaveAccessibleDescription(aviso));
  });

  it('renomeia e muda a ordem, mandando só o que mudou', async () => {
    const f = api({ 'PATCH /api/tipos-de-unidade/t-pel': { status: 200, corpo: { ...TIPOS[2]!, nome: 'Pelotão de Serviço', ordem: 3 } } });
    abrir('/configuracoes?aba=tipos-de-unidade');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Renomear' }))[2]!);
    const nome = screen.getByLabelText('Novo nome de Pelotão');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Pelotão de Serviço');
    const ordem = screen.getByLabelText('Ordem de Pelotão');
    await userEvent.clear(ordem);
    await userEvent.type(ordem, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/tipos-de-unidade/t-pel')).toEqual({ nome: 'Pelotão de Serviço', ordem: 3 }));
  });

  it('exclui o tipo que nenhuma unidade usa; o que está em uso fica com o botão desligado e diz por quê', async () => {
    const f = api({ 'DELETE /api/tipos-de-unidade/t-pel': { status: 204 } });
    abrir('/configuracoes?aba=tipos-de-unidade');
    const emUso = await screen.findByRole('button', { name: 'Excluir Divisão' });
    expect(emUso).toBeDisabled();
    expect(emUso).toHaveAttribute('title', 'Há unidades deste tipo.');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Pelotão' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/tipos-de-unidade/t-pel')).toBe(1));
    // a lista é buscada de novo
    await waitFor(() => expect(chamadasA(f, TIPOS_ROTA)).toBeGreaterThan(1));
  });

  it('o erro do servidor ao excluir aparece, e a lista continua', async () => {
    api({ 'DELETE /api/tipos-de-unidade/t-pel': { status: 409, corpo: { erro: 'Há unidades deste tipo.' } } });
    abrir('/configuracoes?aba=tipos-de-unidade');
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Pelotão' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Há unidades deste tipo.');
    expect(within(screen.getByText('Pelotão').closest('ul')!).getAllByRole('listitem')).toHaveLength(3);
  });
});
