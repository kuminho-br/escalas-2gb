import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir, migrarReal, situacaoDoMilitar } from './banco-teste.ts';

// Dados fictícios (D7). A migração 0054 faz das equipes um cadastro: tipo, posição do ciclo e herança. O que ela mexe é dado real (equipes e rastreio de militares reais): o teste prova
// que nenhuma referência se perde.
async function bancoAte0053(): Promise<Banco> {
  const banco = await bancoPglite();
  const ate = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < '0054')) copyFileSync(join(PASTA_MIGRACOES, f), join(ate, f));
  await migrarReal(banco, ate);
  return banco;
}
const unidade = async (banco: Banco, sigla: string) => (await banco.query<{ id: string }>('select id from unidade where sigla = $1', [sigla])).rows[0]!.id;
const raiz = async (banco: Banco) => (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;

let seq = 0;
async function militar(banco: Banco, nome: string): Promise<string> {
  seq++;
  const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  return inserir(banco, 'militar', { matricula: `100${String(500 + seq).padStart(3, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, de_teste: true });
}
const periodo = async (banco: Banco, militarId: string, unidadeId: string, equipeId: string | null, desde: string, ate: string | null) =>
  inserir(banco, 'rastreio', { militar_id: militarId, unidade_id: unidadeId, equipe_id: equipeId, jornada: 'pronto', desde, ate, situacao_id: await situacaoDoMilitar(banco, 'Ativa') });
const equipesDe = async (banco: Banco) =>
  (await banco.query<{ unidade: string; nome: string; tipo: string; posicao: number | null; ativa: boolean }>(
    `select u.sigla as unidade, e.nome, e.tipo, e.posicao_ciclo as posicao, e.ativa from public.equipe e join unidade u on u.id = e.unidade_id order by u.sigla, e.tipo, e.posicao_ciclo, e.nome`,
  )).rows;

/** Duas unidades com ALFA a DELTA (em cada uma), rastreio em meses diferentes, "TURMA X" (posição 5) em uso e "SOBRA" (posição 6) sem uso. */
async function semear(banco: Banco) {
  const sb1 = await unidade(banco, '1ª SB');
  const sb2 = await unidade(banco, '2ª SB');
  const equipe = (u: string, nome: string, posicao: number) => inserir(banco, 'equipe', { unidade_id: u, nome, ordem_ciclo: posicao });
  const a1 = await equipe(sb1, 'ALFA', 1);
  const b1 = await equipe(sb1, 'BRAVO', 2);
  await equipe(sb1, 'CHARLIE', 3);
  await equipe(sb1, 'DELTA', 4);
  const turma = await equipe(sb1, 'TURMA X', 5);
  await equipe(sb1, 'SOBRA', 6);
  const a2 = await equipe(sb2, 'Alfa', 1);
  await equipe(sb2, 'Bravo', 2);
  const c2 = await equipe(sb2, 'Charlie', 3);
  await equipe(sb2, 'Delta', 4);
  const m1 = await militar(banco, 'UM');
  const m2 = await militar(banco, 'DOIS');
  const m3 = await militar(banco, 'TRES');
  const m4 = await militar(banco, 'QUATRO');
  // o UM mudou de equipe de um mês para outro (o histórico não pode se perder); o DOIS está na TURMA X; os da 2ª SB, em Alfa e Charlie; o QUATRO não tem equipe
  const linhas = [
    await periodo(banco, m1, sb1, a1, '2026-09-01', '2026-09-30'),
    await periodo(banco, m1, sb1, b1, '2026-10-01', null),
    await periodo(banco, m2, sb1, turma, '2026-09-01', null),
    await periodo(banco, m3, sb2, a2, '2026-09-01', '2026-10-31'),
    await periodo(banco, m3, sb2, c2, '2026-11-01', null),
    await periodo(banco, m4, sb1, null, '2026-09-01', null),
  ];
  return { linhas, sb1, sb2, turma };
}
const equipeDoRastreio = async (banco: Banco) =>
  (await banco.query<{ id: string; equipe_id: string | null; nome: string | null; unidade: string | null; tipo: string | null; ativa: boolean | null }>(
    `select r.id, r.equipe_id, e.nome, u.sigla as unidade, e.tipo, e.ativa from public.rastreio r left join public.equipe e on e.id = r.equipe_id left join unidade u on u.id = e.unidade_id order by r.desde, r.id`,
  )).rows;

describe('migração 0054', () => {
  it('cria as seis padrão na raiz; o rastreio das duas unidades vai para a padrão da mesma posição; "TURMA X" fica desativada com o rastreio dela; ninguém perde a equipe (Review Focus 1)', async () => {
    const banco = await bancoAte0053();
    try {
      const { linhas, turma } = await semear(banco);
      const comEquipeAntes = (await banco.query<{ n: number }>('select count(*)::int as n from public.rastreio where equipe_id is not null')).rows[0]!.n;
      expect(comEquipeAntes).toBe(5);

      expect(await migrar(banco)).toContain('0054_equipes_como_cadastro.sql');

      const padrao = (await equipesDe(banco)).filter((e) => e.unidade === 'CBMPE');
      expect(padrao).toEqual([
        { unidade: 'CBMPE', nome: 'ADM', tipo: 'adm', posicao: null, ativa: true },
        { unidade: 'CBMPE', nome: 'Externa', tipo: 'externa', posicao: null, ativa: true },
        { unidade: 'CBMPE', nome: 'Alfa', tipo: 'pronto', posicao: 1, ativa: true },
        { unidade: 'CBMPE', nome: 'Bravo', tipo: 'pronto', posicao: 2, ativa: true },
        { unidade: 'CBMPE', nome: 'Charlie', tipo: 'pronto', posicao: 3, ativa: true },
        { unidade: 'CBMPE', nome: 'Delta', tipo: 'pronto', posicao: 4, ativa: true },
      ]);
      // o rastreio: UM Alfa e depois Bravo; os da 2ª SB, Alfa e Charlie; DOIS continua na TURMA X (desativada); QUATRO sem equipe
      const depois = await equipeDoRastreio(banco);
      const resumo = (l: typeof depois) => l.map((r) => `${r.nome ?? 'sem equipe'} (${r.unidade ?? '-'}, ${r.ativa === null ? '-' : r.ativa ? 'ativa' : 'desativada'})`).sort();
      expect(resumo(depois)).toEqual([
        'Alfa (CBMPE, ativa)', 'Alfa (CBMPE, ativa)', 'Bravo (CBMPE, ativa)', 'Charlie (CBMPE, ativa)', 'TURMA X (1ª SB, desativada)', 'sem equipe (-, -)',
      ].sort());
      expect(depois.filter((r) => r.equipe_id).length).toBe(comEquipeAntes);
      expect(depois.find((r) => r.nome === 'TURMA X')!.equipe_id).toBe(turma);
      expect(new Set(linhas).size).toBe(linhas.length);

      // as equipes antigas das unidades que casaram saíram; sobraram só as que não casaram, desativadas, não apagadas
      const naUnidade = (await equipesDe(banco)).filter((e) => e.unidade !== 'CBMPE');
      expect(naUnidade).toEqual([
        { unidade: '1ª SB', nome: 'SOBRA', tipo: 'adm', posicao: null, ativa: false },
        { unidade: '1ª SB', nome: 'TURMA X', tipo: 'adm', posicao: null, ativa: false },
      ]);
    } finally {
      await banco.fechar();
    }
  });

  it('nenhuma coluna de outra tabela fica apontando para uma equipe que sumiu: só o rastreio aponta para equipe (e o teste avisa se aparecer outra tabela)', async () => {
    const banco = await bancoAte0053();
    try {
      const fks = async () =>
        (await banco.query<{ tabela: string; coluna: string }>(
          `select c.conrelid::regclass::text as tabela, a.attname as coluna from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
            where c.contype = 'f' and c.confrelid = to_regclass(current_schema() || '.equipe') order by 1, 2`,
        )).rows;
      expect(await fks()).toEqual([{ tabela: 'rastreio', coluna: 'equipe_id' }]);
      await semear(banco);
      await migrar(banco);
      expect(await fks()).toEqual([{ tabela: 'rastreio', coluna: 'equipe_id' }]);
      // e todas as colunas "equipe" de qualquer tabela continuam apontando para uma linha que existe
      const solta = await banco.query('select 1 from public.rastreio r where r.equipe_id is not null and not exists (select 1 from public.equipe e where e.id = r.equipe_id)');
      expect(solta.rows).toHaveLength(0);
    } finally {
      await banco.fechar();
    }
  });

  it('rodar de novo não muda nada: o mesmo conjunto de equipes e o mesmo rastreio', async () => {
    const banco = await bancoAte0053();
    try {
      await semear(banco);
      await migrar(banco);
      const equipes = await equipesDe(banco);
      const rastreio = await equipeDoRastreio(banco);
      await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0054_equipes_como_cadastro.sql'), 'utf8'));
      expect(await equipesDe(banco)).toEqual(equipes);
      expect(await equipeDoRastreio(banco)).toEqual(rastreio);
    } finally {
      await banco.fechar();
    }
  });

  it('a equipe antiga com nome diferente do padrão casa pela posição (o nome vai no relatório de quem migra) e o histórico fica', async () => {
    const banco = await bancoAte0053();
    try {
      const u = await unidade(banco, '1ª SB');
      const turmaA = await inserir(banco, 'equipe', { unidade_id: u, nome: 'TURMA A', ordem_ciclo: 1 });
      const m = await militar(banco, 'CINCO');
      await periodo(banco, m, u, turmaA, '2026-09-01', null);
      await migrar(banco);
      const [r] = await equipeDoRastreio(banco);
      expect(r).toMatchObject({ nome: 'Alfa', unidade: 'CBMPE', tipo: 'pronto' });
      expect((await equipesDe(banco)).some((e) => e.nome === 'TURMA A')).toBe(false);
    } finally {
      await banco.fechar();
    }
  });
});

describe('o rastreio e a herança da equipe (0054)', () => {
  async function cenario() {
    const banco = await bancoDeTeste();
    const sb1 = await unidade(banco, '1ª SB');
    const sb2 = await unidade(banco, '2ª SB');
    const mae = (await banco.query<{ mae_id: string }>('select mae_id from unidade where id = $1', [sb1])).rows[0]!.mae_id;
    const r = await raiz(banco);
    const padrao = async (tipo: string, posicao: number | null) =>
      (await banco.query<{ id: string }>('select id from equipe where unidade_id = $1 and tipo = $2 and posicao_ciclo is not distinct from $3', [r, tipo, posicao])).rows[0]?.id;
    return { banco, sb1, sb2, mae, r, padrao };
  }
  const gravar = (banco: Banco, militarId: string, unidadeId: string, equipeId: string | null, desde: string) => periodo(banco, militarId, unidadeId, equipeId, desde, null);

  it('a equipe da raiz e a de um ancestral valem; a de uma unidade irmã é recusada (Review Focus 3)', async () => {
    const { banco, sb1, sb2, mae, padrao } = await cenario();
    try {
      const alfa = (await padrao('pronto', 1))!;
      expect(alfa).toBeDefined();
      const deAncestral = await inserir(banco, 'equipe', { unidade_id: mae, nome: 'Operações', tipo: 'adm', ativa: true });
      const deIrma = await inserir(banco, 'equipe', { unidade_id: sb2, nome: 'Da irmã', tipo: 'adm' });
      const m = await militar(banco, 'SEIS');
      await gravar(banco, m, sb1, alfa, '2026-09-01');
      const m2 = await militar(banco, 'SETE');
      await gravar(banco, m2, sb1, deAncestral, '2026-09-01');
      const m3 = await militar(banco, 'OITO');
      await expect(gravar(banco, m3, sb1, deIrma, '2026-09-01')).rejects.toThrow(/da unidade da lotação ou de uma acima/);
    } finally {
      await banco.fechar();
    }
  });

  it('a Externa não entra no rastreio, e a equipe desativada não entra num rastreio novo (mas o histórico dela continua)', async () => {
    const { banco, sb1, padrao } = await cenario();
    try {
      const externa = (await padrao('externa', null))!;
      const m = await militar(banco, 'NOVE');
      await expect(gravar(banco, m, sb1, externa, '2026-09-01')).rejects.toThrow(/Externa/);
      const velha = await inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Velha', tipo: 'adm', ativa: false });
      await expect(gravar(banco, m, sb1, velha, '2026-09-01')).rejects.toThrow(/desativada/);
    } finally {
      await banco.fechar();
    }
  });

  it('quem já esteve numa equipe que ficou desativada abre outro período com ela (a importação e o lote não travam); quem nunca esteve, não entra', async () => {
    const { banco, sb1 } = await cenario();
    try {
      const velha = await inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Velha 2', tipo: 'adm', ativa: true });
      const m = await militar(banco, 'DEZ');
      await periodo(banco, m, sb1, velha, '2026-09-01', '2026-09-30');
      await banco.query('update equipe set ativa = false where id = $1', [velha]);
      // um período novo, com a mesma equipe agora desativada, é o que a importação e o lote fazem ao mudar só a situação ou o quadro
      await expect(gravar(banco, m, sb1, velha, '2026-10-01')).resolves.toBeDefined();
      const outro = await militar(banco, 'ONZE');
      await expect(gravar(banco, outro, sb1, velha, '2026-10-01')).rejects.toThrow(/desativada/);
    } finally {
      await banco.fechar();
    }
  });

  it('as regras da tabela: Pronto precisa de posição de 1 a 4; ADM e Externa não têm posição; a Externa é uma só', async () => {
    const { banco, sb1 } = await cenario();
    try {
      await expect(inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Sem posição', tipo: 'pronto' })).rejects.toThrow();
      await expect(inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Quinta', tipo: 'pronto', posicao_ciclo: 5 })).rejects.toThrow();
      await expect(inserir(banco, 'equipe', { unidade_id: sb1, nome: 'ADM com posição', tipo: 'adm', posicao_ciclo: 1 })).rejects.toThrow();
      await expect(inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Outra', tipo: 'externa' })).rejects.toThrow();
      await expect(inserir(banco, 'equipe', { unidade_id: sb1, nome: 'Tipo ruim', tipo: 'qualquer' })).rejects.toThrow();
    } finally {
      await banco.fechar();
    }
  });
});
