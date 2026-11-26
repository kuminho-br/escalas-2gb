import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar } from '../src/banco/migrar.ts';
import { oQueVaiJunto } from '../src/cadastros/apagar-militar.ts';
import { cargaExemplo } from '../src/carga/exemplo.ts';
import { cargaDoEspelho } from '../src/laboratorio/espelho.ts';
import { listarRegistrosDeTeste, referenciasQueSoPerdemAutoria, removerRegistrosDeTeste, separarTeste } from '../src/laboratorio/separar.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

// 6.58: tirar os registros de teste (matrículas 990…) do banco real, sem mexer em nenhum militar real nem na auditoria.
const MES = '2026-12-01';
let banco: Banco;

const n = async (sql: string, params: unknown[] = []) => (await banco.query<{ n: number }>(sql, params)).rows[0]!.n;
const um = async (sql: string, params: unknown[] = []) => (await banco.query<{ id: string }>(sql, params)).rows[0]!.id;

/** Três militares "reais" (matrícula fictícia 880xxx-x, para parecer real) com lotação, escala, afastamento e voluntariado, ao lado dos 53 de teste. */
async function montar(b: Banco) {
  await cargaExemplo(b, undefined, MES); // 53 militares 990001-0 a 990053-3, a 1ª SB, os serviços e as equipes
  const secao = await um("select id from unidade where sigla = '1ª SB'");
  const sd = await um("select id from posto_grad where sigla = 'SD'");
  const reais: string[] = [];
  for (const [i, guerra] of ['REAL UM', 'REAL DOIS', 'REAL TRES'].entries()) {
    const m = await inserir(b, 'militar', { matricula: `88000${i + 1}-${i + 1}`, posto_grad_id: sd, nome_guerra: guerra });
    await inserir(b, 'rastreio', { militar_id: m, unidade_id: secao, jornada: 'pronto', desde: '2026-12-01' });
    reais.push(m);
  }
  const tipo = await um('select id from tipo_afastamento limit 1');
  await inserir(b, 'afastamento', { militar_id: reais[0], tipo_afastamento_id: tipo, inicio: '2026-12-02', fim: '2026-12-04' });
  await inserir(b, 'voluntariado_lancamento', { militar_id: reais[1], mes: MES });
  const servico = await um("select id from servico where nome = 'Pronto'");
  const turno = await um('select id from turno where servico_id = $1 and letra = $2', [servico, 'A']);
  const escala = await inserir(b, 'escala', { unidade_id: secao, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(b, 'escala_servico', { escala_id: escala, servico_id: servico, ordem: 1 }, 'escala_id');
  const alocReal = await inserir(b, 'alocacao', { militar_id: reais[0], escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-05', origem: 'manual' });
  const alocRealNaPermuta = await inserir(b, 'alocacao', { militar_id: reais[1], escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-06', origem: 'permuta' });

  // os de teste: alocações na mesma escala, afastamento, voluntariado, uma conta com nível e senha, e uma permuta com um militar real
  const t1 = await um("select id from militar where matricula = '990001-1'");
  const t2 = await um("select id from militar where matricula = '990002-2'");
  const aloc1 = await inserir(b, 'alocacao', { militar_id: t1, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-05', origem: 'manual' });
  await inserir(b, 'alocacao', { militar_id: t2, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-05', origem: 'manual' });
  await inserir(b, 'afastamento', { militar_id: t2, tipo_afastamento_id: tipo, inicio: '2026-12-10', fim: '2026-12-12' });
  await inserir(b, 'voluntariado_lancamento', { militar_id: t1, mes: MES });
  const usuarioTeste = await inserir(b, 'usuario', { nome: 'SD ANDRADE', email: 'andrade@exemplo.test', militar_id: t1 });
  await inserir(b, 'conta', { usuario_id: usuarioTeste, conta_id: usuarioTeste, provedor_id: 'credential', senha: 'x' });
  await inserir(b, 'papel_usuario', { usuario_id: usuarioTeste, unidade_id: secao, papel: 'escalante', desde: '2020-01-01' });
  await b.transacao(async (tx) => {
    const permuta = (await tx.query<{ id: string }>("insert into permuta (mes) values ('2026-12-01') returning id")).rows[0]!.id;
    await tx.query('insert into permuta_item (permuta_id, alocacao_id, militar_original_id) values ($1, $2, $3), ($1, $4, $5)', [permuta, aloc1, t1, alocRealNaPermuta, reais[1]]);
  });
  // uma permuta já feita: a alocação X, que era do real, está com o de teste; a Y, que era do de teste, está com o real. Cada item aponta para o outro lado
  const t3 = await um("select id from militar where matricula = '990003-3'");
  const alocX = await inserir(b, 'alocacao', { militar_id: t3, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-08', origem: 'permuta' });
  const alocY = await inserir(b, 'alocacao', { militar_id: reais[0], escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-09', origem: 'permuta' });
  await b.transacao(async (tx) => {
    const permuta = (await tx.query<{ id: string }>("insert into permuta (mes) values ('2026-12-01') returning id")).rows[0]!.id;
    await tx.query('insert into permuta_item (permuta_id, alocacao_id, militar_original_id) values ($1, $2, $3), ($1, $4, $5)', [permuta, alocX, reais[0], alocY, t3]);
  });
  // uma alocação REAL marcada (presença) por uma conta de teste: a linha fica, só perde o "quem marcou"; e uma de teste marcada pela mesma conta, que sai
  const alocPresenca = await inserir(b, 'alocacao', { militar_id: reais[2], escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-07', origem: 'manual', presenca_por: usuarioTeste });
  await inserir(b, 'alocacao', { militar_id: t3, escala_id: escala, servico_id: servico, turno_id: turno, data: '2026-12-07', origem: 'manual', presenca_por: usuarioTeste });
  // um usuário real, com nível de administrador, para provar que fica
  const admin = await inserir(b, 'usuario', { nome: 'CAP REAL', email: 'real@exemplo.test', militar_id: reais[2] });
  await inserir(b, 'papel_usuario', { usuario_id: admin, unidade_id: await um('select id from unidade where mae_id is null'), papel: 'administrador', desde: '2020-01-01' });
  // o escalante real corrigiu o voluntariado de um militar de teste: o registro tem o militar de teste e a regra "voluntariado_corrigido pede militar"
  await inserir(b, 'registro_de_alteracao', { usuario_id: admin, unidade_id: secao, tipo: 'voluntariado_corrigido', militar_id: t2, mes: MES, antes: '[]', depois: '[]' });
  return { reais, alocReal, alocRealNaPermuta, escala, alocY, alocPresenca, usuarioTeste, t2, secao, admin };
}

/** A contagem de todas as tabelas do real, para provar que nada mudou. */
async function fotografia(b: Banco) {
  const tabelas = (await b.query<{ tablename: string }>("select tablename from pg_tables where schemaname = 'public' order by 1")).rows.map((r) => r.tablename);
  const f: Record<string, number> = {};
  for (const t of tabelas) f[t] = (await b.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]!.n;
  return f;
}

beforeEach(async () => {
  banco = await bancoDeTeste();
});
afterEach(async () => {
  await banco.fechar();
});

describe('listar o que é de teste', () => {
  it('conta só os militares 990… e o que depende deles, dos filhos para os pais', async () => {
    await montar(banco);
    const lista = await listarRegistrosDeTeste(banco);
    const q = (t: string) => lista.find((l) => l.tabela === t)?.quantidade ?? 0;
    expect(q('militar')).toBe(53);
    expect(q('rastreio')).toBe(53);
    expect(q('alocacao')).toBe(4); // a do t1, a do t2, a X (com o de teste) e a do t3 marcada pela conta de teste
    expect(q('afastamento')).toBe(1);
    expect(q('voluntariado_lancamento')).toBe(1);
    expect(q('usuario')).toBe(1);
    expect(q('conta')).toBe(1);
    expect(q('papel_usuario')).toBe(1);
    // a permuta com um militar real sai inteira (a permuta precisa de dois itens); a alocação do real fica
    expect(q('registro_de_alteracao')).toBe(1);
    expect(q('permuta')).toBe(2);
    expect(q('permuta_item')).toBe(4);
    // nada que é só do real entra: os serviços, as equipes, as escalas e os militares 880… não são listados
    for (const t of ['servico', 'equipe', 'escala', 'unidade', 'posto_grad']) expect(q(t), t).toBe(0);
    // a ordem é a da exclusão: o que depende vem antes do que é dependido
    const ordem = lista.map((l) => l.tabela);
    expect(ordem.indexOf('papel_usuario')).toBeLessThan(ordem.indexOf('usuario'));
    expect(ordem.indexOf('usuario')).toBeLessThan(ordem.indexOf('militar'));
    expect(ordem.indexOf('alocacao')).toBeLessThan(ordem.indexOf('militar'));
    expect(ordem.indexOf('rastreio')).toBeLessThan(ordem.indexOf('militar'));
  });

  it('listar não muda uma linha', async () => {
    await montar(banco);
    const antes = await fotografia(banco);
    await listarRegistrosDeTeste(banco);
    expect(await fotografia(banco)).toEqual(antes);
  });

  it('banco sem registros de teste: lista vazia', async () => {
    expect(await listarRegistrosDeTeste(banco)).toEqual([]);
  });
});

describe('tirar o que é de teste', () => {
  it('deixa o real sem nenhuma 990… e os militares reais intactos, com tudo o que era deles', async () => {
    const { reais, alocReal, alocRealNaPermuta, alocY, alocPresenca } = await montar(banco);
    const foto = await fotografia(banco);
    const removidos = await removerRegistrosDeTeste(banco);

    expect(removidos.find((r) => r.tabela === 'militar')?.removidos).toBe(53);
    expect(await n("select count(*)::int as n from militar where matricula like '990%'")).toBe(0);
    // os três reais e tudo o que era deles
    expect(await n("select count(*)::int as n from militar where matricula like '880%'")).toBe(3);
    expect(await n('select count(*)::int as n from rastreio where militar_id = any($1)', [reais])).toBe(3);
    expect(await n('select count(*)::int as n from afastamento where militar_id = $1', [reais[0]])).toBe(1);
    expect(await n('select count(*)::int as n from voluntariado_lancamento where militar_id = $1', [reais[1]])).toBe(1);
    expect(await n('select count(*)::int as n from alocacao where id = any($1)', [[alocReal, alocRealNaPermuta]])).toBe(2);
    expect(await n('select count(*)::int as n from alocacao where id = any($1)', [[alocY, alocPresenca]])).toBe(2);
    expect(await n('select count(*)::int as n from registro_de_alteracao')).toBe(0);
    expect(await n("select count(*)::int as n from usuario where email = 'real@exemplo.test'")).toBe(1);
    expect(await n("select count(*)::int as n from papel_usuario where papel = 'administrador'")).toBe(1);
    // o que é do real e não depende de militar fica: serviços, equipes, escala
    const depois = await fotografia(banco);
    for (const t of ['servico', 'turno', 'equipe', 'escala', 'unidade', 'posto_grad', 'tipo_afastamento']) expect(depois[t], t).toBe(foto[t]);
    expect(depois.militar).toBe(3);
    expect(depois.usuario).toBe(1);
    expect(depois.permuta).toBe(0);
    expect(depois.permuta_item).toBe(0);
    expect(depois.conta).toBe(0);
    // e não resta nada a listar
    expect(await listarRegistrosDeTeste(banco)).toEqual([]);
  });

  it('a auditoria não é apagada nem faz a transação falhar: as linhas dela que citam os removidos ficam', async () => {
    await montar(banco);
    const antes = await n('select count(*)::int as n from auditoria');
    const doMilitarDeTeste = await n("select count(*)::int as n from auditoria where tabela = 'militar' and coalesce(depois, antes) ->> 'matricula' like '990%'");
    expect(doMilitarDeTeste).toBeGreaterThanOrEqual(53);
    await removerRegistrosDeTeste(banco);
    // nenhuma linha antiga sumiu (as exclusões ainda acrescentam as suas)
    expect(await n('select count(*)::int as n from auditoria')).toBeGreaterThanOrEqual(antes);
    expect(await n("select count(*)::int as n from auditoria where tabela = 'militar' and acao = 'insert' and depois ->> 'matricula' like '990%'")).toBe(53);
  });

  it('rodar de novo não faz mal e não acha mais nada', async () => {
    await montar(banco);
    await removerRegistrosDeTeste(banco);
    const foto = await fotografia(banco);
    expect(await removerRegistrosDeTeste(banco)).toEqual([]);
    expect(await fotografia(banco)).toEqual(foto);
  });

  it('se uma exclusão falha no meio, nada fica pela metade', async () => {
    await montar(banco);
    // a exclusão do militar, a última, é barrada
    await banco.exec(`
      create function zz_barra() returns trigger language plpgsql as $$ begin raise exception 'barrado de propósito'; end $$;
      create trigger zz_barra before delete on militar for each row execute function zz_barra();`);
    const antes = await fotografia(banco);
    await expect(removerRegistrosDeTeste(banco)).rejects.toThrow('barrado de propósito');
    expect(await fotografia(banco)).toEqual(antes);
  });

  it('a referência que só aponta para a conta de teste fica, sem o "quem marcou"; a lista diz quantas linhas reais mudam', async () => {
    const { alocPresenca } = await montar(banco);
    // só a alocação REAL entra: a de teste, marcada pela mesma conta, sai de qualquer jeito e não conta
    expect(await referenciasQueSoPerdemAutoria(banco)).toEqual([{ tabela: 'alocacao', coluna: 'presenca_por', quantidade: 1 }]);
    await removerRegistrosDeTeste(banco);
    const linha = (await banco.query<{ presenca_por: string | null }>('select presenca_por from alocacao where id = $1', [alocPresenca])).rows[0]!;
    expect(linha.presenca_por).toBeNull();
    expect(await referenciasQueSoPerdemAutoria(banco)).toEqual([]);
  });

  it('o registro de alteração do voluntariado de um militar de teste sai junto, e a limpeza não trava na regra "pede militar"', async () => {
    const { t2 } = await montar(banco);
    expect(await n('select count(*)::int as n from registro_de_alteracao where militar_id = $1', [t2])).toBe(1);
    await expect(removerRegistrosDeTeste(banco)).resolves.toBeDefined();
    expect(await n('select count(*)::int as n from registro_de_alteracao')).toBe(0);
  });

  it('a permuta já feita (com a alocação trocada de lado) sai inteira e a alocação do real fica', async () => {
    const { alocY } = await montar(banco);
    await removerRegistrosDeTeste(banco);
    expect(await n('select count(*)::int as n from permuta')).toBe(0);
    expect(await n('select count(*)::int as n from permuta_item')).toBe(0);
    expect(await n('select count(*)::int as n from alocacao where id = $1', [alocY])).toBe(1);
  });
});

describe('os cuidados antes de apagar', () => {
  it('a lista diz quais contas de teste têm nível de acesso e quais linhas reais só perdem a autoria', async () => {
    await montar(banco);
    const linhas: string[] = [];
    await separarTeste(banco, { aplicar: false, escrever: (l) => linhas.push(l) });
    const texto = linhas.join('\n');
    expect(texto).toMatch(/Contas de teste com nível de acesso:/);
    expect(texto).toMatch(/escalante: 1/);
    expect(texto).toMatch(/alocacao\.presenca_por: 1/);
  });

  it('recusa aplicar se a limpeza deixaria o sistema sem nenhum administrador', async () => {
    const { usuarioTeste, admin } = await montar(banco);
    // o único administrador é a conta de teste
    await banco.query('delete from papel_usuario where usuario_id = $1', [admin]);
    await inserir(banco, 'papel_usuario', { usuario_id: usuarioTeste, unidade_id: await um('select id from unidade where mae_id is null'), papel: 'administrador', desde: '2020-01-01' });
    const antes = await fotografia(banco);
    await expect(separarTeste(banco, { aplicar: true, confirmarMilitares: 53, escrever: () => {} })).rejects.toThrow(/nenhum administrador/);
    expect(await fotografia(banco)).toEqual(antes);
    // com um administrador real, passa
    await inserir(banco, 'papel_usuario', { usuario_id: admin, unidade_id: await um('select id from unidade where mae_id is null'), papel: 'administrador', desde: '2020-01-01' });
    await expect(separarTeste(banco, { aplicar: true, confirmarMilitares: 53, escrever: () => {} })).resolves.toMatchObject({ restantes: 0 });
  });

  it('o administrador real com o nível vencido não conta como quem fica', async () => {
    const { usuarioTeste, admin } = await montar(banco);
    const raiz = await um('select id from unidade where mae_id is null');
    await banco.query('delete from papel_usuario where usuario_id = $1', [admin]);
    await inserir(banco, 'papel_usuario', { usuario_id: admin, unidade_id: raiz, papel: 'administrador', desde: '2020-01-01', ate: '2020-12-31' });
    await inserir(banco, 'papel_usuario', { usuario_id: usuarioTeste, unidade_id: raiz, papel: 'administrador', desde: '2020-01-01' });
    await expect(separarTeste(banco, { aplicar: true, confirmarMilitares: 53, escrever: () => {} })).rejects.toThrow(/nenhum administrador/);
  });

  it('aplicar exige a quantidade de militares conferida na lista', async () => {
    await montar(banco);
    const antes = await fotografia(banco);
    await expect(separarTeste(banco, { aplicar: true, escrever: () => {} })).rejects.toThrow(/--aplicar=53/);
    await expect(separarTeste(banco, { aplicar: true, confirmarMilitares: 52, escrever: () => {} })).rejects.toThrow(/--aplicar=53/);
    expect(await fotografia(banco)).toEqual(antes);
    await expect(separarTeste(banco, { aplicar: true, confirmarMilitares: 53, escrever: () => {} })).resolves.toMatchObject({ aplicado: true, restantes: 0 });
  });
});

describe('a separação inteira (o que o script faz)', () => {
  it('sem aplicar só lista: não muda uma linha e diz que nada foi apagado', async () => {
    await montar(banco);
    const antes = await fotografia(banco);
    const linhas: string[] = [];
    const r = await separarTeste(banco, { aplicar: false, escrever: (l) => linhas.push(l) });
    expect(await fotografia(banco)).toEqual(antes);
    expect(r.aplicado).toBe(false);
    expect(r.matriculas).toHaveLength(53);
    expect(r.matriculas[0]).toBe('990001-1');
    const texto = linhas.join('\n');
    expect(texto).toContain('militar');
    expect(texto).toContain('990001-1');
    expect(texto).toMatch(/nada foi apagado/i);
    expect(texto).toMatch(/--aplicar/);
    // só tabela, contagem e matrículas fictícias: nenhum nome, e-mail ou matrícula real
    expect(texto).not.toContain('REAL UM');
    expect(texto).not.toContain('880001');
    expect(texto).not.toContain('@');
  });

  it('com aplicar tira, e a conferência final diz que não restou nenhuma 990…', async () => {
    await montar(banco);
    const linhas: string[] = [];
    const r = await separarTeste(banco, { aplicar: true, confirmarMilitares: 53, escrever: (l) => linhas.push(l) });
    expect(r.aplicado).toBe(true);
    expect(r.restantes).toBe(0);
    expect(await n("select count(*)::int as n from militar where matricula like '990%'")).toBe(0);
    expect(linhas.join('\n')).toMatch(/matrículas 990… no banco real: 0/);
    // repetir: nada a tirar
    const outra: string[] = [];
    const r2 = await separarTeste(banco, { aplicar: true, confirmarMilitares: 0, escrever: (l) => outra.push(l) });
    expect(r2.registros).toEqual([]);
    expect(outra.join('\n')).toMatch(/Nada de teste no banco real/);
  });

  it('o script recusa rodar sem DATABASE_URL', () => {
    const pasta = dirname(dirname(fileURLToPath(import.meta.url)));
    const env = { ...process.env };
    delete env.DATABASE_URL;
    let saida = '';
    let codigo = 0;
    try {
      execFileSync(process.execPath, ['--import', 'tsx', join(pasta, 'scripts', 'separar-teste.ts')], { cwd: pasta, env, stdio: 'pipe' });
    } catch (e) {
      const err = e as { status: number; stderr: Buffer };
      codigo = err.status;
      saida = err.stderr.toString();
    }
    expect(codigo).toBe(1);
    expect(saida).toContain('DATABASE_URL');
  }, 30000);
});

describe('com o espelho no mesmo banco', () => {
  it('apagar um militar no sistema segue funcionando (a leitura das chaves não olha para o espelho) e a separação não toca no espelho', async () => {
    const completo = await bancoPglite();
    try {
      await migrar(completo); // real e espelho
      await cargaExemplo(completo, undefined, MES);
      await cargaDoEspelho(completo, MES);
      const militar = (await completo.query<{ id: string }>("select id from militar where matricula = '990001-1'")).rows[0]!.id;
      const junto = await oQueVaiJunto(completo, militar);
      expect(junto.periodosDoRastreio).toBe(1);

      const espelhoAntes = (await completo.query<{ n: number }>('select count(*)::int as n from laboratorio.militar')).rows[0]!.n;
      expect(espelhoAntes).toBe(58);
      const removidos = await removerRegistrosDeTeste(completo);
      expect(removidos.find((r) => r.tabela === 'militar')?.removidos).toBe(53);
      expect((await completo.query<{ n: number }>("select count(*)::int as n from public.militar where matricula like '990%'")).rows[0]!.n).toBe(0);
      // o espelho segue com a carga dele, inclusive os usuários de teste
      expect((await completo.query<{ n: number }>('select count(*)::int as n from laboratorio.militar')).rows[0]!.n).toBe(58);
      expect((await completo.query<{ n: number }>('select count(*)::int as n from laboratorio.usuario')).rows[0]!.n).toBe(5);
    } finally {
      await completo.fechar();
    }
  }, 60000);
});
