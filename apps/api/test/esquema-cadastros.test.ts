import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

let banco: Banco;
let secao: string;
let raiz: string;
let usuario: string;
let militar: string;

const nomes = async (tabela: string) =>
  (await banco.query<{ nome: string }>(`select nome from ${tabela}`)).rows.map((r) => r.nome).sort();

beforeAll(async () => {
  banco = await bancoDeTeste();
  raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  secao = (await banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
  ({ usuarioId: usuario, militarId: militar } = await criarAdmin(banco, {
    matricula: '990950-0', postoSigla: 'SD', nomeGuerra: 'CADASTRO', email: 'cadastro@exemplo.test', senha: 'senha-de-teste-123', hoje: '2026-11-17',
  }));
});
afterAll(async () => {
  await banco.fechar();
});

describe('catálogos do sistema', () => {
  it('tipos de afastamento iniciais', async () => {
    // Férias, LTS, Curso e Outro (0009) e Adido, Agregado, L.E e DTS (0024)
    expect(await nomes('tipo_afastamento')).toEqual(['Adido', 'Agregado', 'Curso', 'DTS', 'Férias', 'L.E', 'LTS', 'Outro'].sort());
  });

  it('atividades iniciais', async () => {
    expect(await nomes('atividade')).toEqual(['APH', 'Apoio operacional', 'Incêndio', 'Salvamento'].sort());
  });

  it('nome repetido sem diferenciar maiúsculas', async () => {
    await expect(inserir(banco, 'tipo_afastamento', { nome: 'férias' })).rejects.toThrow();
    await expect(inserir(banco, 'atividade', { nome: 'aph' })).rejects.toThrow();
  });

  it('tabelas novas entram na auditoria', async () => {
    const id = await inserir(banco, 'atividade', { nome: 'Mergulho' });
    const { rows } = await banco.query<{ acao: string }>(
      "select acao from auditoria where tabela = 'atividade' and registro_id = $1",
      [id],
    );
    expect(rows.map((r) => r.acao)).toEqual(['insert']);
  });
});

describe('colunas novas', () => {
  it('afastamento exige tipo', async () => {
    await expect(inserir(banco, 'afastamento', { militar_id: militar, inicio: '2026-11-10', fim: '2026-11-12' })).rejects.toThrow();
    const ferias = (await banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id;
    await inserir(banco, 'afastamento', { militar_id: militar, tipo_afastamento_id: ferias, inicio: '2026-11-10', fim: '2026-11-12' });
  });

  it('feriado é fixo por padrão', async () => {
    const id = await inserir(banco, 'feriado', { unidade_id: secao, data: '2026-12-25', descricao: 'Natal' });
    const { rows } = await banco.query<{ fixo: boolean }>('select fixo from feriado where id = $1', [id]);
    expect(rows[0]!.fixo).toBe(true);
  });

  it('guarnição aceita atividade vazia', async () => {
    await inserir(banco, 'guarnicao', { unidade_id: secao, nome: 'UR-CAD' });
  });
});

describe('papéis', () => {
  it('papel gestor existe e chefe não', async () => {
    await inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: secao, papel: 'gestor', desde: '2026-11-01' });
    await expect(
      inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: secao, papel: 'chefe', desde: '2026-11-01' }),
    ).rejects.toThrow();
  });

  it('administrador só na raiz', async () => {
    await expect(
      inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: secao, papel: 'administrador', desde: '2026-11-01' }),
    ).rejects.toThrow('O papel de administrador só existe na unidade raiz');
    await inserir(banco, 'papel_usuario', { usuario_id: usuario, unidade_id: raiz, papel: 'administrador', desde: '2026-12-01' });
  });
});
