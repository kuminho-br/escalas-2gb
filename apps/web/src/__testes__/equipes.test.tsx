import type { Equipe } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { esquecerUnidadeDaAba, guardarUnidade } from '@/lib/unidade-de-trabalho';
import { abrir, chamadasA, corpoEnviado, EU_EXEMPLO, simularApi } from './apoio';

// 6.64, Task 5: a aba "Equipes" das Configurações (as equipes herdadas e as da unidade). Dados fictícios.
const GESTOR: EuDaApi = {
  ...EU_EXEMPLO,
  papeis: [{ papel: 'gestor', unidadeId: 'u-gb', unidadeSigla: '2º GB' }],
  unidades: [{ id: 'u-gb', sigla: '2º GB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB'], nivel: 3, tipo: 'grupamento', maeId: null }, ...EU_EXEMPLO.unidades],
};
const ADMIN: EuDaApi = { ...GESTOR, papeis: [{ papel: 'administrador', unidadeId: 'u-cbmpe', unidadeSigla: 'CBMPE' }] };
const AUXILIAR: EuDaApi = { ...GESTOR, papeis: [{ papel: 'escalante', unidadeId: 'u-gb', unidadeSigla: '2º GB' }] };

const padrao = (id: string, nome: string, tipo: Equipe['tipo'], posicaoCiclo: number | null): Equipe => ({ id, nome, tipo, posicaoCiclo, ativa: true, unidadeId: 'u-cbmpe', unidadeSigla: 'CBMPE', daCorporacao: true, herdada: true });
const PADRAO: Equipe[] = [
  padrao('e1', 'Alfa', 'pronto', 1), padrao('e2', 'Bravo', 'pronto', 2), padrao('e3', 'Charlie', 'pronto', 3), padrao('e4', 'Delta', 'pronto', 4), padrao('e5', 'ADM', 'adm', null), padrao('e6', 'Externa', 'externa', null),
];
const DO_GB: Equipe = { id: 'e7', nome: 'Plantão do GB', tipo: 'adm', posicaoCiclo: null, ativa: true, unidadeId: 'u-gb', unidadeSigla: '2º GB', daCorporacao: false, herdada: false };
const ROTA = 'GET /api/unidades/u-gb/equipes';

function api(eu: EuDaApi, equipes: Equipe[], extra: Parameters<typeof simularApi>[0] = {}) {
  return simularApi({ '/api/eu': { status: 200, corpo: eu }, [ROTA]: { status: 200, corpo: equipes }, ...extra });
}
const abrirAba = async () => {
  abrir('/configuracoes?aba=equipes');
  await screen.findByRole('region', { name: 'Pronto' });
};
const grupo = (nome: string) => within(screen.getByRole('region', { name: nome }));
const linha = (grupoNome: string, nome: string) => grupo(grupoNome).getAllByRole('listitem').find((li) => within(li).queryByText(nome) !== null)!;

beforeEach(() => guardarUnidade('u-gb'));
afterAll(() => esquecerUnidadeDaAba());

describe('a aba Equipes das Configurações (6.64)', () => {
  it('lista as equipes que a unidade vê por tipo (Pronto, ADM e Externa), com a posição do ciclo e a marca "da corporação" nas herdadas', async () => {
    api(GESTOR, [...PADRAO, DO_GB]);
    await abrirAba();
    expect(grupo('Pronto').getAllByRole('listitem').map((l) => within(l).getByText(/^(Alfa|Bravo|Charlie|Delta)$/).textContent)).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta']);
    expect(within(linha('Pronto', 'Alfa')).getByText('1ª no ciclo')).toBeInTheDocument();
    expect(within(linha('Pronto', 'Delta')).getByText('4ª no ciclo')).toBeInTheDocument();
    expect(within(linha('Pronto', 'Alfa')).getByText('da corporação')).toBeInTheDocument();
    expect(grupo('ADM').getAllByRole('listitem')).toHaveLength(2);
    expect(within(linha('ADM', 'Plantão do GB')).queryByText('da corporação')).toBeNull();
    expect(grupo('Externa').getAllByRole('listitem')).toHaveLength(1);
  });

  it('o gestor não tem botão de mudar nas herdadas, só nas da própria unidade', async () => {
    api(GESTOR, [...PADRAO, DO_GB]);
    await abrirAba();
    expect(within(linha('Pronto', 'Alfa')).queryByRole('button')).toBeNull();
    expect(within(linha('ADM', 'ADM')).queryByRole('button')).toBeNull();
    expect(within(linha('ADM', 'Plantão do GB')).getByRole('button', { name: 'Renomear Plantão do GB' })).toBeInTheDocument();
    expect(within(linha('ADM', 'Plantão do GB')).getByRole('button', { name: 'Excluir Plantão do GB' })).toBeInTheDocument();
  });

  it('o administrador renomeia as padrão (mas só exclui a ADM); o PATCH leva só o nome', async () => {
    const f = api(ADMIN, PADRAO, { 'PATCH /api/equipes/e1': { status: 200, corpo: { ...PADRAO[0], nome: 'Equipe 1' } } });
    await abrirAba();
    expect(within(linha('Pronto', 'Alfa')).queryByRole('button', { name: /^Excluir/ })).toBeNull();
    expect(within(linha('ADM', 'ADM')).getByRole('button', { name: 'Excluir ADM' })).toBeInTheDocument();
    await userEvent.click(within(linha('Pronto', 'Alfa')).getByRole('button', { name: 'Renomear Alfa' }));
    const campo = screen.getByLabelText('Novo nome de Alfa');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Equipe 1');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/equipes/e1')).toEqual({ nome: 'Equipe 1' }));
  });

  it('o gestor cria uma equipe do ADM (campo de nome, sem escolha de tipo); o POST leva tipo adm', async () => {
    const f = api(GESTOR, [...PADRAO], { 'POST /api/unidades/u-gb/equipes': { status: 201, corpo: DO_GB } });
    await abrirAba();
    expect(screen.queryByRole('combobox', { name: /tipo/i })).toBeNull();
    await userEvent.type(screen.getByLabelText('Nova equipe do ADM'), 'Plantão do GB');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    await waitFor(() => expect(corpoEnviado(f, 'POST /api/unidades/u-gb/equipes')).toEqual({ nome: 'Plantão do GB', tipo: 'adm' }));
    await waitFor(() => expect(chamadasA(f, ROTA)).toBe(2));
    expect(screen.getByLabelText('Nova equipe do ADM')).toHaveValue('');
  });

  it('o nome repetido aparece junto do campo, com a frase fixa e o que foi digitado', async () => {
    api(GESTOR, [...PADRAO], { 'POST /api/unidades/u-gb/equipes': { status: 409, corpo: { erro: 'Já existe uma equipe com esse nome.', campos: { nome: 'Já existe uma equipe com esse nome.' } } } });
    await abrirAba();
    await userEvent.type(screen.getByLabelText('Nova equipe do ADM'), 'alfa');
    await userEvent.click(screen.getByRole('button', { name: 'Incluir' }));
    const erro = await screen.findByRole('alert');
    expect(erro).toHaveTextContent('Já existe uma equipe com esse nome.');
    expect(screen.getByLabelText('Nova equipe do ADM')).toHaveAccessibleDescription('Já existe uma equipe com esse nome.');
    expect(screen.getByLabelText('Nova equipe do ADM')).toHaveValue('alfa');
  });

  it('excluir uma sem uso a tira; uma já usada fica desativada, e a tela diz "A equipe já foi usada; ela foi desativada em vez de apagada."', async () => {
    const f = api(GESTOR, [...PADRAO, DO_GB], { 'DELETE /api/equipes/e7': { status: 200, corpo: { desativada: true, aviso: 'A equipe já foi usada; ela foi desativada em vez de apagada.' } } });
    await abrirAba();
    await userEvent.click(within(linha('ADM', 'Plantão do GB')).getByRole('button', { name: 'Excluir Plantão do GB' }));
    // pede a confirmação antes
    expect(chamadasA(f, 'DELETE /api/equipes/e7')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar a exclusão de Plantão do GB' }));
    await waitFor(() => expect(chamadasA(f, 'DELETE /api/equipes/e7')).toBe(1));
    expect(await screen.findByText('A equipe já foi usada; ela foi desativada em vez de apagada.')).toBeInTheDocument();
  });

  it('a desativada aparece marcada, e quem pode mudar a reativa', async () => {
    const f = api(GESTOR, [...PADRAO, { ...DO_GB, ativa: false }], { 'PATCH /api/equipes/e7': { status: 200, corpo: DO_GB } });
    await abrirAba();
    expect(within(linha('ADM', 'Plantão do GB')).getByText('desativada')).toBeInTheDocument();
    await userEvent.click(within(linha('ADM', 'Plantão do GB')).getByRole('button', { name: 'Reativar Plantão do GB' }));
    await waitFor(() => expect(corpoEnviado(f, 'PATCH /api/equipes/e7')).toEqual({ ativa: true }));
  });

  it('sem equipe além das padrão, o estado vazio diz "Esta unidade só usa as equipes da corporação."', async () => {
    api(GESTOR, PADRAO);
    await abrirAba();
    expect(screen.getByText('Esta unidade só usa as equipes da corporação.')).toBeInTheDocument();
  });

  it('o auxiliar vê a lista e não tem como criar nem mudar', async () => {
    api(AUXILIAR, [...PADRAO, DO_GB]);
    await abrirAba();
    expect(screen.queryByLabelText('Nova equipe do ADM')).toBeNull();
    expect(within(linha('ADM', 'Plantão do GB')).queryByRole('button')).toBeNull();
  });
});

describe('nenhuma tela escreve o nome de uma equipe (6.64)', () => {
  const RAIZ = join(process.cwd(), 'src');
  const arquivos = (pasta: string): string[] =>
    readdirSync(pasta).flatMap((n) => {
      const p = join(pasta, n);
      if (statSync(p).isDirectory()) return n === '__testes__' ? [] : arquivos(p);
      return /\.tsx?$/.test(n) ? [p] : [];
    });

  it('Alfa, Bravo, Charlie, Delta e Externa vêm do cadastro: não há esses nomes em texto de tela nem em exemplo', () => {
    const achados = arquivos(RAIZ)
      .flatMap((p) => readFileSync(p, 'utf8').split('\n').map((l, i) => ({ p, i: i + 1, l })))
      // comentários, a etiqueta "Externo · {unidade}" (o militar de fora, e não a equipe) e o título do tipo "Externa" (os tipos são fixos no código) não contam
      .filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/Externo · /.test(l) && !/titulo: '/.test(l))
      .filter(({ l }) => /['"`>](Alfa|Bravo|Charlie|Delta|Externa|Externo)['"`<]|Ex\.: Alfa/.test(l));
    expect(achados.map(({ p, i }) => `${p.slice(RAIZ.length + 1)}:${i}`)).toEqual([]);
  });
});
