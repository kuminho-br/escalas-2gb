import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// Entrega 6.15: o abono de permanência (sim ou não) e a função do militar (de um catálogo das Configurações). Dados fictícios (D7).
let banco: Banco;
let posto: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
});
afterAll(async () => {
  await banco.fechar();
});

const militar = (n: number, extra: Record<string, unknown> = {}) => inserir(banco, 'militar', { matricula: `99033${n}-${n}`, posto_grad_id: posto, nome_guerra: `M33${n}`, ...extra });

describe('migração 0033: abono de permanência e função do militar', () => {
  it('todo militar nasce sem função e sem abono', async () => {
    const id = await militar(1);
    const { rows } = await banco.query<{ funcao_militar_id: string | null; abono_permanencia: boolean }>('select funcao_militar_id, abono_permanencia from militar where id = $1', [id]);
    expect(rows[0]).toEqual({ funcao_militar_id: null, abono_permanencia: false });
  });

  it('o catálogo tem o nome único sem diferenciar maiúsculas, e a função nasce ativa', async () => {
    const f = await inserir(banco, 'funcao_militar', { nome: 'Chefe de seção' });
    expect((await banco.query<{ ativo: boolean }>('select ativo from funcao_militar where id = $1', [f])).rows[0]!.ativo).toBe(true);
    await expect(inserir(banco, 'funcao_militar', { nome: 'CHEFE DE SEÇÃO' })).rejects.toThrow(/funcao_militar_nome/);
    await expect(inserir(banco, 'funcao_militar', { nome: 'chefe de seção' })).rejects.toThrow();
  });

  it('o militar aponta para uma função do catálogo, e a função que existe não se apaga enquanto alguém a tem', async () => {
    const f = await inserir(banco, 'funcao_militar', { nome: 'Auxiliar de pessoal' });
    const id = await militar(2, { funcao_militar_id: f, abono_permanencia: true });
    expect((await banco.query<{ abono_permanencia: boolean }>('select abono_permanencia from militar where id = $1', [id])).rows[0]!.abono_permanencia).toBe(true);
    await expect(militar(3, { funcao_militar_id: '00000000-0000-4000-8000-000000000000' })).rejects.toThrow();
    await expect(banco.query('delete from funcao_militar where id = $1', [f])).rejects.toThrow();
  });

  it('as mudanças do catálogo e do militar entram na auditoria', async () => {
    const antes = (await banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'funcao_militar'")).rows[0]!.n;
    const f = await inserir(banco, 'funcao_militar', { nome: 'Motorista do comandante' });
    await banco.query('update funcao_militar set ativo = false where id = $1', [f]);
    expect((await banco.query<{ n: number }>("select count(*)::int as n from auditoria where tabela = 'funcao_militar'")).rows[0]!.n).toBe(antes + 2);
  });

  it('pode rodar de novo sem perder o que já está gravado', async () => {
    const f = await inserir(banco, 'funcao_militar', { nome: 'Instrutor' });
    const id = await militar(4, { funcao_militar_id: f, abono_permanencia: true });
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0033_abono_e_funcao.sql'), 'utf8'));
    const { rows } = await banco.query<{ funcao_militar_id: string; abono_permanencia: boolean }>('select funcao_militar_id, abono_permanencia from militar where id = $1', [id]);
    expect(rows[0]).toEqual({ funcao_militar_id: f, abono_permanencia: true });
    expect((await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'funcao_militar'::regclass and tgname = 'auditoria_registro'")).rows[0]!.n).toBe(1);
  });
});
