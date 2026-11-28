import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

let banco: Banco;
let raiz: string;
let secao: string;
let posto: string;

beforeAll(async () => {
  banco = await bancoDeTeste();
  raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]?.id
    ?? (await inserir(banco, 'unidade', { tipo: 'corporacao', sigla: 'RAIZ-T', nome: 'Raiz de teste', desde: '2026-11-01' }));
  secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-T', nome: 'Seção de teste', mae_id: raiz, desde: '2026-11-01' });
  posto = await inserir(banco, 'posto_grad', { sigla: 'SD-T', nome: 'Soldado teste', ordem: 901 });
});
afterAll(async () => {
  await banco.fechar();
});

let seq = 0;
function militar(extra: Record<string, unknown> = {}) {
  seq++;
  return inserir(banco, 'militar', {
    matricula: `99${String(8000 + seq).padStart(4, '0')}-${seq % 10}`,
    posto_grad_id: posto,
    nome_guerra: `TESTE${seq}`,
    ...extra,
  });
}

describe('estrutura e pessoas', () => {
  it('matricula fora do formato', async () => {
    await expect(militar({ matricula: '99001-1' })).rejects.toThrow();
  });

  // a CNH é do militar: sai a regra que a apagava de quem não está no quadro de motoristas (0023)
  it('cnh sem motorista grava', async () => {
    const m = await militar({ motorista: false, cnh: ['D'] });
    const { rows } = await banco.query<{ motorista: boolean; cnh: string[] }>('select motorista, cnh from militar where id = $1', [m]);
    expect(rows[0]).toEqual({ motorista: false, cnh: ['D'] });
  });

  it('cnh invalida', async () => {
    await expect(militar({ motorista: true, cnh: ['F'] })).rejects.toThrow();
  });

  it('rastreio sobreposto', async () => {
    const m = await militar();
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-11-01' });
    await expect(
      inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'adm', desde: '2026-12-01' }),
    ).rejects.toThrow();
  });

  it('o rastreio aceita começar em qualquer dia, e o período sobreposto continua barrado', async () => {
    const m = await militar();
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-11-15', ate: '2026-12-09' });
    await inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'adm', desde: '2026-12-10' });
    await expect(inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-12-09' })).rejects.toThrow();
  });

  it('a lotação virou rastreio, com as mesmas regras', async () => {
    const { rows } = await banco.query<{ tabela: string }>("select tablename as tabela from pg_tables where schemaname = current_schema() and tablename in ('lotacao', 'rastreio')");
    expect(rows.map((r) => r.tabela)).toEqual(['rastreio']);
    // equipe de outra unidade (que não é a da lotação nem de cima dela) continua barrada
    const outra = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-T2', nome: 'Outra seção de teste', mae_id: raiz, desde: '2026-11-01' });
    const equipeDeOutra = await inserir(banco, 'equipe', { unidade_id: outra, nome: 'Alfa', tipo: 'pronto', posicao_ciclo: 1 });
    const m = await militar();
    await expect(inserir(banco, 'rastreio', { militar_id: m, unidade_id: secao, equipe_id: equipeDeOutra, jornada: 'pronto', desde: '2026-11-01' })).rejects.toThrow(/da unidade da lotação ou de uma acima/);
    // a auditoria continua ligada à tabela nova
    const { rows: gatilhos } = await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'rastreio'::regclass and tgname in ('auditoria_registro', 'rastreio_equipe')");
    expect(gatilhos[0]!.n).toBe(2);
  });

  it('as sete seções existem abaixo do 2º GB e a migração rodada de novo não duplica nada', async () => {
    const siglas = async () => (await banco.query<{ sigla: string }>("select sigla from unidade where mae_id = (select id from unidade where sigla = '2º GB') and tipo = 'secao' order by sigla")).rows.map((r) => r.sigla);
    const esperadas = ['1ª SB', '2ª SB', '3ª SB', '4ª SB', '5ª SB', '6ª SB', '7ª SB'];
    expect(await siglas()).toEqual(esperadas);
    // ambiente já migrado à mão: o mesmo arquivo roda de novo sem erro e sem repetir seção
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0023_rastreio_e_cnh.sql'), 'utf8'));
    expect(await siglas()).toEqual(esperadas);
    const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from unidade where sigla = '4ª SB'");
    expect(rows[0]!.n).toBe(1);
  });

  describe('ficha do Pecúlio (0024)', () => {
    it('e-mail só do domínio institucional e único sem distinção de maiúsculas (Review Focus 3)', async () => {
      await expect(militar({ email: 'fulano@gmail.com' })).rejects.toThrow();
      await expect(militar({ email: 'fulano@bombeiros.pe.gov.br.mal' })).rejects.toThrow();
      await militar({ email: 'Fulano@bombeiros.pe.gov.br' });
      await expect(militar({ email: 'fulano@bombeiros.pe.gov.br' })).rejects.toThrow(/militar_email/);
      // vazio pode repetir (nenhum e-mail não é o mesmo e-mail)
      await militar();
      await militar();
    });

    it('sexo só M ou F; comportamento só da lista', async () => {
      await expect(militar({ sexo: 'X' })).rejects.toThrow();
      await militar({ sexo: 'F', comportamento: 'Excepcional', comportamento_boletim: 'BG 12/2026' });
      await expect(militar({ comportamento: 'Péssimo' })).rejects.toThrow();
    });

    it('nascimento é dia e mês juntos, com dia que existe no mês; 29/02 passa (Review Focus 4)', async () => {
      await expect(militar({ nascimento_dia: 10 })).rejects.toThrow();
      await expect(militar({ nascimento_mes: 10 })).rejects.toThrow();
      await expect(militar({ nascimento_dia: 31, nascimento_mes: 2 })).rejects.toThrow();
      await expect(militar({ nascimento_dia: 31, nascimento_mes: 4 })).rejects.toThrow();
      await expect(militar({ nascimento_dia: 1, nascimento_mes: 13 })).rejects.toThrow();
      await expect(militar({ nascimento_dia: 0, nascimento_mes: 1 })).rejects.toThrow();
      await militar({ nascimento_dia: 29, nascimento_mes: 2 });
      await militar({ nascimento_dia: 30, nascimento_mes: 4 });
      await militar({ nascimento_dia: 31, nascimento_mes: 12 });
    });

    it('afastamento: motivo até 200 e boletim até 60 caracteres (Review Focus 5)', async () => {
      const m = await militar();
      const tipo = (await banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'LTS'")).rows[0]!.id;
      const base = { militar_id: m, tipo_afastamento_id: tipo };
      await expect(inserir(banco, 'afastamento', { ...base, inicio: '2026-03-01', fim: '2026-03-02', motivo: 'a'.repeat(201) })).rejects.toThrow();
      await expect(inserir(banco, 'afastamento', { ...base, inicio: '2026-03-01', fim: '2026-03-02', boletim: 'b'.repeat(61) })).rejects.toThrow();
      await inserir(banco, 'afastamento', { ...base, inicio: '2026-03-01', fim: '2026-03-02', motivo: 'a'.repeat(200), boletim: 'b'.repeat(60) });
    });

    it('os tipos Adido, Agregado, L.E e DTS existem uma vez só, mesmo rodando a migração de novo', async () => {
      const contar = async () => (await banco.query<{ nome: string; n: number }>("select nome, count(*)::int as n from tipo_afastamento where nome in ('Adido', 'Agregado', 'L.E', 'DTS', 'LTS') group by nome order by nome")).rows;
      const esperado = [{ nome: 'Adido', n: 1 }, { nome: 'Agregado', n: 1 }, { nome: 'DTS', n: 1 }, { nome: 'L.E', n: 1 }, { nome: 'LTS', n: 1 }];
      expect(await contar()).toEqual(esperado);
      await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0024_ficha_do_peculio.sql'), 'utf8'));
      expect(await contar()).toEqual(esperado);
    });
  });

  describe('contas e papéis (0025)', () => {
    it('o convite saiu e o usuário tem o prazo da senha provisória', async () => {
      const convite = await banco.query<{ t: string | null }>("select to_regclass('convite')::text as t");
      expect(convite.rows[0]!.t).toBeNull();
      const coluna = await banco.query<{ data_type: string; is_nullable: string }>(
        "select data_type, is_nullable from information_schema.columns where table_name = 'usuario' and column_name = 'senha_provisoria_ate'",
      );
      expect(coluna.rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
    });

    it('a migração rodada de novo não quebra e deixa um gatilho só', async () => {
      await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0025_contas_e_papeis.sql'), 'utf8'));
      const { rows } = await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = 'militar'::regclass and tgname = 'militar_email_para_usuario'");
      expect(rows[0]!.n).toBe(1);
    });
  });

  it('afastamento com fim antes do inicio', async () => {
    const m = await militar();
    await expect(
      inserir(banco, 'afastamento', { militar_id: m, tipo_afastamento_id: (await banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'Férias'")).rows[0]!.id, inicio: '2026-11-10', fim: '2026-11-09' }),
    ).rejects.toThrow();
  });

  // 6.25: o tipo é só um nome, então qualquer tipo fica abaixo de qualquer tipo
  it('a mae pode ser de qualquer tipo', async () => {
    const id = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'X-T', nome: 'X', mae_id: secao, desde: '2026-11-01' });
    expect(id).toBeTruthy();
  });

  it('caminho da unidade', async () => {
    const { rows } = await banco.query<{ ok: boolean; filho: boolean }>(
      `select f.caminho <@ r.caminho as ok, nlevel(f.caminho) = nlevel(r.caminho) + 1 as filho
         from unidade f, unidade r where f.id = $1 and r.id = $2`,
      [secao, raiz],
    );
    expect(rows[0]).toEqual({ ok: true, filho: true });
  });

  it('mover unidade move os descendentes', async () => {
    const d1 = await inserir(banco, 'unidade', { tipo: 'diretoria_integrada', sigla: 'D1-T', nome: 'D1', mae_id: raiz, desde: '2026-11-01' });
    const d2 = await inserir(banco, 'unidade', { tipo: 'diretoria_integrada', sigla: 'D2-T', nome: 'D2', mae_id: raiz, desde: '2026-11-01' });
    const gb = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-T', nome: 'GB', mae_id: d1, desde: '2026-11-01' });
    const sb = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SB-T', nome: 'SB', mae_id: gb, desde: '2026-11-01' });
    await banco.query('update unidade set mae_id = $1 where id = $2', [d2, gb]);
    const { rows } = await banco.query<{ ok: boolean }>(
      'select s.caminho <@ d.caminho as ok from unidade s, unidade d where s.id = $1 and d.id = $2',
      [sb, d2],
    );
    expect(rows[0]!.ok).toBe(true);
  });
});
