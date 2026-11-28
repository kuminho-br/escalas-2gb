import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar } from '../src/banco/migrar.ts';
import { cargaExemplo, motivoParaRecusarExemplo } from '../src/carga/exemplo.ts';
import { cargaDoEspelho, ESPELHO_PAPEL, perfisDeTeste } from '../src/laboratorio/espelho.ts';

// 6.58: o papel de banco do espelho e a carga de teste (os 53 militares fictícios e um usuário por nível de acesso).
let banco: Banco;
const MES = '2026-12-01';

beforeEach(async () => {
  banco = await bancoPglite();
  await migrar(banco); // real e espelho
});
afterEach(async () => {
  await banco.fechar();
});

const n = async (sql: string, params: unknown[] = []) => (await banco.query<{ n: number }>(sql, params)).rows[0]!.n;
const pode = async (tabela: string, privilegio = 'select') =>
  (await banco.query<{ ok: boolean }>('select has_table_privilege($1, $2, $3) as ok', [ESPELHO_PAPEL, tabela, privilegio])).rows[0]!.ok;

describe('a carga de teste do espelho', () => {
  it('põe os 53 militares 990… e os 5 perfis no espelho e nenhum registro novo no real', async () => {
    const realAntes = {
      militares: await n('select count(*)::int as n from public.militar'),
      usuarios: await n('select count(*)::int as n from public.usuario'),
      papeis: await n('select count(*)::int as n from public.papel_usuario'),
      rastreios: await n('select count(*)::int as n from public.rastreio'),
      servicos: await n('select count(*)::int as n from public.servico'),
      auditoria: await n('select count(*)::int as n from public.auditoria'),
    };
    expect(await cargaDoEspelho(banco, MES)).toEqual({ militares: 53, perfis: 5 });

    expect(await n("select count(*)::int as n from laboratorio.militar where matricula like '100%'")).toBe(58);
    expect(await n('select count(*)::int as n from laboratorio.usuario')).toBe(5);
    expect(await n('select count(*)::int as n from laboratorio.servico')).toBeGreaterThan(5);
    // as seis padrão da corporação (6.64): as quatro do Pronto, a ADM e a Externa
    expect(await n('select count(*)::int as n from laboratorio.equipe')).toBe(6);
    // o real não ganhou nada, nem na auditoria
    expect({
      militares: await n('select count(*)::int as n from public.militar'),
      usuarios: await n('select count(*)::int as n from public.usuario'),
      papeis: await n('select count(*)::int as n from public.papel_usuario'),
      rastreios: await n('select count(*)::int as n from public.rastreio'),
      servicos: await n('select count(*)::int as n from public.servico'),
      auditoria: await n('select count(*)::int as n from public.auditoria'),
    }).toEqual(realAntes);
    expect(await n("select count(*)::int as n from public.militar where matricula like '100%'")).toBe(0);
  });

  it('a carga do espelho marca como teste os 53 militares e os 5 perfis; a carga de exemplo comum não marca ninguém', async () => {
    await cargaDoEspelho(banco, MES);
    expect(await n('select count(*)::int as n from laboratorio.militar where de_teste')).toBe(58);
    expect(await n('select count(*)::int as n from laboratorio.militar where not de_teste')).toBe(0);
    const solto = await bancoPglite();
    try {
      await migrar(solto, undefined, { espelho: false });
      await cargaExemplo(solto, undefined, MES);
      expect((await solto.query<{ n: number }>('select count(*)::int as n from public.militar where de_teste')).rows[0]!.n).toBe(0);
      expect((await solto.query<{ n: number }>('select count(*)::int as n from public.militar')).rows[0]!.n).toBe(53);
    } finally {
      await solto.fechar();
    }
  });

  it('um espelho carregado antes da marca existir (ou com militar sem ela) é marcado inteiro na próxima carga: no espelho tudo é de teste', async () => {
    await cargaDoEspelho(banco, MES);
    await banco.exec('update laboratorio.militar set de_teste = false');
    expect(await cargaDoEspelho(banco, MES)).toEqual({ militares: 53, perfis: 5 });
    expect(await n('select count(*)::int as n from laboratorio.militar where de_teste')).toBe(58);
    expect(await n('select count(*)::int as n from laboratorio.militar where not de_teste')).toBe(0);
  });

  it('a carga roda como o papel do espelho: se ela escrevesse no real, o banco negaria', async () => {
    await banco.exec(`
      create table laboratorio.zz_quem (quem text);
      create function laboratorio.zz_registra() returns trigger language plpgsql as $$ begin insert into laboratorio.zz_quem values (current_user); return null; end $$;
      create trigger zz_quem after insert on laboratorio.militar for each row execute function laboratorio.zz_registra();`);
    await banco.exec(`grant all on laboratorio.zz_quem to ${ESPELHO_PAPEL}`);
    await cargaDoEspelho(banco, MES);
    const { rows } = await banco.query<{ quem: string; n: number }>('select quem, count(*)::int as n from laboratorio.zz_quem group by quem');
    expect(rows).toEqual([{ quem: ESPELHO_PAPEL, n: 58 }]);
  });

  it('um usuário por nível de acesso, lotado e sem senha; o administrador de teste é administrador na raiz do espelho', async () => {
    await cargaDoEspelho(banco, MES);
    const perfis = await perfisDeTeste(banco);
    expect(perfis.map((p) => [p.nome, p.nivel])).toEqual([
      ['Administrador de teste', 'administrador'],
      ['Gestor de teste', 'gestor'],
      ['Quinto nível de teste', 'gestor_lateral'],
      ['Auxiliar administrativo de teste', 'escalante'],
      ['Militar de teste', 'militar'],
    ]);
    const admin = perfis[0]!;
    const naRaiz = await n(
      `select count(*)::int as n from laboratorio.papel_usuario p join laboratorio.unidade u on u.id = p.unidade_id
        where p.usuario_id = $1 and p.papel = 'administrador' and u.mae_id is null`,
      [admin.usuarioId],
    );
    expect(naRaiz).toBe(1);
    // todos lotados (um rastreio vigente), com matrícula fictícia, e ninguém entra por senha
    for (const p of perfis) {
      expect(await n('select count(*)::int as n from laboratorio.rastreio r join laboratorio.usuario u on u.militar_id = r.militar_id where u.id = $1', [p.usuarioId])).toBe(1);
    }
    expect(await n("select count(*)::int as n from laboratorio.usuario u join laboratorio.militar m on m.id = u.militar_id where m.matricula !~ '^100[0-9]{3}-[0-9]$'")).toBe(0);
    expect(await n('select count(*)::int as n from laboratorio.conta')).toBe(0);
    // o militar comum não tem nível nenhum; os outros têm exatamente um
    expect(await n('select count(*)::int as n from laboratorio.papel_usuario')).toBe(4);
    // os perfis não existem no real
    expect(await n('select count(*)::int as n from public.usuario')).toBe(0);
  });

  it('recusa rodar quando o espelho não existe: nada vai para o real', async () => {
    const sem = await bancoPglite();
    try {
      await migrar(sem, undefined, { espelho: false });
      await expect(cargaDoEspelho(sem, MES)).rejects.toThrow(/só roda no espelho/);
      expect((await sem.query<{ n: number }>("select count(*)::int as n from public.militar where matricula like '100%'")).rows[0]!.n).toBe(0);
      expect((await sem.query<{ n: number }>('select count(*)::int as n from public.usuario')).rows[0]!.n).toBe(0);
    } finally {
      await sem.fechar();
    }
  });

  it('a carga é repetível: a segunda vez não duplica, e um espelho novo dá o mesmo resultado', async () => {
    const primeira = await cargaDoEspelho(banco, MES);
    const segunda = await cargaDoEspelho(banco, MES);
    expect(segunda).toEqual(primeira);
    expect(await n('select count(*)::int as n from laboratorio.militar where matricula like $1', ['100%'])).toBe(58);
    expect(await n('select count(*)::int as n from laboratorio.usuario')).toBe(5);
    expect(await n('select count(*)::int as n from laboratorio.papel_usuario')).toBe(4);
  });
});

describe('quando a carga de teste pode rodar', () => {
  it('no ambiente de teste só no espelho; no real continua recusada', () => {
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'teste' })).toMatch(/recusada/);
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'teste' }, 'public')).toMatch(/recusada/);
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'teste' }, 'laboratorio')).toBeNull();
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x', AMBIENTE: 'desenvolvimento' }, 'laboratorio')).toBeNull();
    // banco remoto sem declarar o ambiente: recusada, mesmo no espelho
    expect(motivoParaRecusarExemplo({ DATABASE_URL: 'postgres://x' }, 'laboratorio')).toMatch(/recusada/);
    expect(motivoParaRecusarExemplo({}, 'laboratorio')).toBeNull();
  });
});

describe('o papel de banco do espelho', () => {
  it('não tem privilégio algum nas tabelas do real e tem todos nas do espelho (definição)', async () => {
    await cargaDoEspelho(banco, MES);
    for (const t of ['militar', 'usuario', 'papel_usuario', 'rastreio', 'auditoria', 'unidade']) {
      for (const priv of ['select', 'insert', 'update', 'delete']) {
        expect(await pode(`public.${t}`, priv), `public.${t} ${priv}`).toBe(false);
        expect(await pode(`laboratorio.${t}`, priv), `laboratorio.${t} ${priv}`).toBe(true);
      }
    }
    // o registro de migrações do espelho não é dele: apagar uma linha ali faria o próximo migrar reaplicar o arquivo
    for (const priv of ['select', 'insert', 'update', 'delete']) expect(await pode('laboratorio.migracao_aplicada', priv), `migracao_aplicada ${priv}`).toBe(false);
    // só usa o public para os tipos e operadores das extensões
    expect((await banco.query<{ ok: boolean }>("select has_schema_privilege($1, 'public', 'usage') as ok", [ESPELHO_PAPEL])).rows[0]!.ok).toBe(true);
  });

  it('com o papel assumido, ler uma tabela do real é negado e ler uma do espelho funciona', async () => {
    await cargaDoEspelho(banco, MES);
    await banco.transacao(async (tx) => {
      await tx.exec(`set local role ${ESPELHO_PAPEL}`);
      expect((await tx.query<{ n: number }>('select count(*)::int as n from laboratorio.militar')).rows[0]!.n).toBeGreaterThan(50);
      // sem schema escrito, com o caminho do espelho: as tabelas do espelho, e o ltree das extensões segue valendo
      await tx.exec('set local search_path to laboratorio, public');
      expect((await tx.query<{ n: number }>("select count(*)::int as n from unidade where caminho <@ (select caminho from unidade where mae_id is null)")).rows[0]!.n).toBeGreaterThan(5);
    });
    await expect(
      banco.transacao(async (tx) => {
        await tx.exec(`set local role ${ESPELHO_PAPEL}`);
        await tx.query('select count(*) from public.militar');
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(
      banco.transacao(async (tx) => {
        await tx.exec(`set local role ${ESPELHO_PAPEL}`);
        await tx.exec("insert into public.unidade (tipo, sigla, nome, desde) values ('secao', 'ZZ', 'Intruso', '2026-12-01')");
      }),
    ).rejects.toThrow(/permission denied/);
    // gravar no espelho como o papel funciona (e a auditoria do espelho também, pelo gatilho)
    await banco.transacao(async (tx) => {
      await tx.exec(`set local role ${ESPELHO_PAPEL}`);
      await tx.exec('set local search_path to laboratorio, public');
      await tx.exec("insert into unidade (tipo, sigla, nome, mae_id, desde) select 'secao', 'ZZ', 'Seção de prova', id, '2026-12-01' from unidade where sigla = '1ª SB'");
    });
    expect(await n("select count(*)::int as n from laboratorio.unidade where sigla = 'ZZ'")).toBe(1);
    expect(await n("select count(*)::int as n from public.unidade where sigla = 'ZZ'")).toBe(0);
  });

  it('a tabela que uma migração nova criar no espelho já nasce acessível ao papel (privilégio padrão)', async () => {
    await banco.exec('create table laboratorio.zz_nova (id int primary key)'); // sem passar pelo preparo do papel
    expect(await pode('laboratorio.zz_nova', 'select')).toBe(true);
    expect(await pode('laboratorio.zz_nova', 'insert')).toBe(true);
    // e uma migração de verdade: a tabela nasce nos dois e o papel só enxerga a do espelho
    const pasta = mkdtempSync(join(tmpdir(), 'migracoes-papel-'));
    writeFileSync(join(pasta, '0100_zz.sql'), 'create table zz_dupla (id int primary key);');
    await migrar(banco, pasta);
    expect(await pode('laboratorio.zz_dupla', 'select')).toBe(true);
    expect(await pode('public.zz_dupla', 'select')).toBe(false);
  });

  it('as funções do espelho fixam o caminho dele: gravar no espelho numa sessão sem o caminho não vaza para o real', async () => {
    // sessão com o caminho padrão (public), escrevendo em laboratorio.unidade pelo nome completo
    const audRealAntes = await n('select count(*)::int as n from public.auditoria');
    const audEspelhoAntes = await n('select count(*)::int as n from laboratorio.auditoria');
    await banco.exec("insert into laboratorio.unidade (tipo, sigla, nome, mae_id, desde) select 'secao', 'ZZ', 'Seção de prova', id, '2026-12-01' from laboratorio.unidade where mae_id is null");
    expect(await n('select count(*)::int as n from laboratorio.auditoria')).toBe(audEspelhoAntes + 1);
    expect(await n('select count(*)::int as n from public.auditoria')).toBe(audRealAntes);
    expect(await n("select count(*)::int as n from public.unidade where sigla = 'ZZ'")).toBe(0);
    // uma função que um arquivo novo recriar também fica com o caminho fixo depois do preparo
    const pasta = mkdtempSync(join(tmpdir(), 'migracoes-funcao-'));
    writeFileSync(join(pasta, '0100_funcao.sql'), 'create or replace function registrar_auditoria() returns trigger language plpgsql as $$ begin insert into auditoria (tabela, registro_id, acao) values (tg_table_name, gen_random_uuid(), lower(tg_op)); return null; end $$;');
    await migrar(banco, pasta);
    await banco.exec("insert into laboratorio.unidade (tipo, sigla, nome, mae_id, desde) select 'secao', 'ZY', 'Outra seção', id, '2026-12-01' from laboratorio.unidade where mae_id is null");
    expect(await n("select count(*)::int as n from laboratorio.auditoria where tabela = 'unidade' and registro_id is not null and depois is null")).toBe(1);
    expect(await n('select count(*)::int as n from public.auditoria')).toBeGreaterThanOrEqual(audRealAntes); // o real recriou a dele também
  });

  it('preparar o papel de novo não faz mal', async () => {
    await migrar(banco);
    await migrar(banco);
    expect((await banco.query<{ n: number }>('select count(*)::int as n from pg_roles where rolname = $1', [ESPELHO_PAPEL])).rows[0]!.n).toBe(1);
    expect(await pode('laboratorio.militar', 'select')).toBe(true);
    expect(await pode('public.militar', 'select')).toBe(false);
  });
});
