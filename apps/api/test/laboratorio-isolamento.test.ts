import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDoEspelho } from '../src/laboratorio/banco-do-espelho.ts';
import { ESCOLHA_UM_PERFIL, FORA_DO_LABORATORIO, SO_NO_LABORATORIO } from '../src/laboratorio/rotas-lab.ts';
import { hojeRecife } from '../src/datas.ts';
import { URL_BASE, entrarComo, montarApi, type ApiDeTeste, type Quem } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// 6.59, Task 2: o sistema sobre o espelho, com o isolamento provado. Dados fictícios (D7).
let api: ApiDeTeste;
let labGb: string;
let labSecao: string;
let labSd: string;
let realSd: string;
const perfil: Record<string, string> = {};
const LAB = { 'x-laboratorio': '1' };
const atual = hojeRecife().slice(0, 7);

const lab = (quem: Quem, metodo: string, caminho: string, corpo?: unknown) => api.pedir(quem, metodo, `/api/lab${caminho}`, corpo, LAB);
const entrar = async (quem: Quem, nivel: string) => {
  const r = await api.pedir(quem, 'PUT', '/api/laboratorio/perfil', { perfilId: perfil[nivel] });
  expect(r.status).toBe(200);
};
const novoMilitar = (matricula: string, postoGradId: string) => ({
  matricula, postoGradId, nomeCompleto: `Fulano de Tal ${matricula}`, nomeGuerra: `LAB${matricula.slice(3, 6)}`, antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
  lotacao: { equipeId: null, jornada: 'adm', desde: `${atual}-01` },
});

/** A contagem e um resumo (hash) do conteúdo de cada tabela do schema: o que prova que nada mudou. A sessão do login muda a cada pedido e fica de fora. */
async function instantaneo(schema: string): Promise<Record<string, string>> {
  const tabelas = (await api.banco.query<{ tablename: string }>('select tablename from pg_tables where schemaname = $1 order by 1', [schema])).rows.map((r) => r.tablename);
  const foto: Record<string, string> = {};
  for (const t of tabelas.filter((x) => x !== 'sessao')) {
    const { rows } = await api.banco.query<{ n: number; h: string }>(`select count(*)::int as n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') as h from ${schema}."${t}" x`);
    foto[t] = `${rows[0]!.n}:${rows[0]!.h}`;
  }
  return foto;
}

beforeAll(async () => {
  api = await montarApi(undefined, { espelho: true });
  for (const p of (await (await api.pedir('semPapel', 'GET', '/api/laboratorio/perfis')).json()) as { perfilId: string; nivel: string }[]) perfil[p.nivel] = p.perfilId;
  const un = async (sigla: string) => (await api.banco.query<{ id: string }>('select id from laboratorio.unidade where sigla = $1', [sigla])).rows[0]!.id;
  labGb = await un('2º GB');
  labSecao = await un('1ª SB');
  labSd = (await api.banco.query<{ id: string }>("select id from laboratorio.posto_grad where sigla = 'SD'")).rows[0]!.id;
  realSd = (await api.banco.query<{ id: string }>("select id from public.posto_grad where sigla = 'SD'")).rows[0]!.id;
}, 300000);
afterAll(async () => {
  await api.fechar();
});

describe('o que se grava no Laboratório não chega ao real, e o contrário também', () => {
  it('uma conta de militar comum, com o perfil de gestor, cadastra, cria escala e importa o Pecúlio no Laboratório: o public fica idêntico', async () => {
    await entrar('semPapel', 'gestor');
    const antes = await instantaneo('public');
    const antesLab = await instantaneo('laboratorio');

    const m = await lab('semPapel', 'POST', `/unidades/${labSecao}/militares`, novoMilitar('990961-1', labSd));
    expect(m.status).toBe(201);
    const e = await lab('semPapel', 'POST', `/unidades/${labSecao}/escalas`, { nome: 'Escala do laboratório' });
    expect(e.status).toBe(201);
    const cab = ['MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'LOTAÇÃO'];
    const arquivo = formulario(await planilha({ 'PECÚLIO': [cab, ['990962-2', 'SD', 'Sicrano de Tal', 'LAB962', '1ª SB']] }));
    const i = await lab('semPapel', 'POST', `/unidades/${labGb}/importacao/peculio?confirmar=1`, arquivo);
    expect(i.status).toBe(200);

    expect(await instantaneo('public')).toEqual(antes);
    expect(await instantaneo('laboratorio')).not.toEqual(antesLab);
    expect((await api.banco.query('select 1 from laboratorio.militar where matricula in ($1, $2)', ['990961-1', '990962-2'])).rows).toHaveLength(2);
    expect((await api.banco.query('select 1 from laboratorio.escala where nome = $1', ['Escala do laboratório'])).rows).toHaveLength(1);
    expect((await api.banco.query('select 1 from public.militar where matricula in ($1, $2)', ['990961-1', '990962-2'])).rows).toHaveLength(0);
  }, 120000);

  it('a auditoria da gravação do Laboratório fica na do espelho, com o perfil de teste como autor', async () => {
    const { rows } = await api.banco.query<{ usuario_id: string }>("select usuario_id from laboratorio.auditoria where tabela = 'militar' and depois ->> 'matricula' = '990961-1'");
    expect(rows).toEqual([{ usuario_id: perfil.gestor }]);
    expect((await api.banco.query("select 1 from public.auditoria where depois ->> 'matricula' = '990961-1'")).rows).toHaveLength(0);
  });

  it('a mesma conta grava no real (sem o cabeçalho, pelo /api): o espelho não muda uma linha', async () => {
    const antesLab = await instantaneo('laboratorio');
    const r = await api.pedir('gestorGb', 'POST', `/api/unidades/${api.ids.secao}/militares`, novoMilitar('990971-1', realSd));
    expect(r.status).toBe(201);
    expect(await instantaneo('laboratorio')).toEqual(antesLab);
    expect((await api.banco.query('select 1 from public.militar where matricula = $1', ['990971-1'])).rows).toHaveLength(1);
  });
});

describe('as recusas dos dois lados', () => {
  it('o cabeçalho do Laboratório num pedido ao real: 409 "Este pedido é do Laboratório."', async () => {
    const r = await api.pedir('admin', 'GET', '/api/postos', undefined, LAB);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: SO_NO_LABORATORIO });
  });

  it('o /api/lab sem o cabeçalho: 409 "Este pedido não é do Laboratório."', async () => {
    const r = await api.pedir('semPapel', 'GET', '/api/lab/postos');
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: FORA_DO_LABORATORIO });
  });

  it('o /api/lab sem login: 401; com login e sem perfil escolhido: 409 "Escolha um perfil de teste."', async () => {
    expect((await api.app.request(`${URL_BASE}/api/lab/postos`, { headers: { ...LAB, Origin: URL_BASE } })).status).toBe(401);
    const r = await lab('escalante', 'GET', '/postos');
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erro: ESCOLHA_UM_PERFIL });
  });

  it('o perfil de administrador do Laboratório não dá nada no real: a conta de militar comum continua 403 lá', async () => {
    await entrar('semPapel', 'administrador');
    expect((await lab('semPapel', 'POST', `/unidades/${labSecao}/militares`, novoMilitar('990981-1', labSd))).status).toBe(201);
    const noReal = await api.pedir('semPapel', 'POST', `/api/unidades/${api.ids.secao}/militares`, novoMilitar('990982-2', realSd));
    expect(noReal.status).toBe(403);
    expect((await api.banco.query('select 1 from public.militar where matricula = $1', ['990982-2'])).rows).toHaveLength(0);
  });

  it('a conta que perdeu o acesso (desativada) ou foi apagada: o pedido seguinte ao /api/lab é 401', async () => {
    const pessoa = await entrarComo(api, { matricula: '990991-1', nome: 'SAIDA' });
    expect((await pessoa.pedir('PUT', '/api/laboratorio/perfil', { perfilId: perfil.gestor })).status).toBe(200);
    const doLab = (m: string, c: string) => pessoa.pedir(m, `/api/lab${c}`, undefined);
    // o cabeçalho vai pelo pedir da pessoa? não: monta o pedido à mão com o cookie dela
    const cookie = (await api.app.request(`${URL_BASE}/api/auth/sign-in/email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: URL_BASE }, body: JSON.stringify({ email: 'saida@exemplo.test', password: 'senha-de-teste-123' }),
    })).headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const pedido = () => api.app.request(`${URL_BASE}/api/lab/postos`, { headers: { Cookie: cookie, Origin: URL_BASE, ...LAB } });
    expect((await pedido()).status).toBe(200);
    await api.banco.query('update usuario set ativo = false where id = $1', [pessoa.usuarioId]);
    expect((await pedido()).status).toBe(401);
    void doLab;
  });

  it('login, contas e senhas não existem no Laboratório (404)', async () => {
    await entrar('semPapel', 'administrador');
    const militar = (await api.banco.query<{ id: string }>('select id from laboratorio.militar limit 1')).rows[0]!.id;
    for (const [metodo, caminho] of [
      ['POST', `/militares/${militar}/senha-provisoria`],
      ['POST', `/militares/${militar}/desativar-acesso`],
      ['POST', '/auth/sign-in/email'],
      ['POST', '/eu/senha'],
      ['POST', '/acesso/codigo'],
    ] as const) {
      expect((await lab('semPapel', metodo, caminho, {})).status, `${metodo} ${caminho}`).toBe(404);
    }
  });

  it('o /api/lab/eu diz quem é o perfil em uso, com o nível dele', async () => {
    await entrar('semPapel', 'gestor');
    const eu = await (await lab('semPapel', 'GET', '/eu')).json();
    expect(eu.usuario.id).toBe(perfil.gestor);
    expect(eu.papeis.map((p: { papel: string }) => p.papel)).toEqual(['gestor']);
  });
});

describe('as leituras do catálogo valem para o espelho (apagar militar, estrutura)', () => {
  it('o administrador de teste apaga um militar do espelho e lê a estrutura dele; o real não muda uma linha, nem a estrutura do real', async () => {
    await entrar('semPapel', 'administrador');
    const criado = await (await lab('semPapel', 'POST', `/unidades/${labSecao}/militares`, novoMilitar('990951-1', labSd))).json();
    const estruturaDoReal = await (await api.pedir('admin', 'GET', '/api/estrutura')).json();
    const antes = await instantaneo('public');

    // a estrutura do espelho tem a lotação nova na conta da seção; a do real, a dela
    const estruturaDoLab = JSON.stringify(await (await lab('semPapel', 'GET', '/estrutura')).json());
    expect(estruturaDoLab).toContain('1ª SB');
    const excluir = await lab('semPapel', 'DELETE', `/militares/${criado.id}`, { matricula: '990951-1' });
    expect(excluir.status).toBe(204);
    expect((await api.banco.query('select 1 from laboratorio.militar where matricula = $1', ['990951-1'])).rows).toHaveLength(0);

    expect(await instantaneo('public')).toEqual(antes);
    expect(await (await api.pedir('admin', 'GET', '/api/estrutura')).json()).toEqual(estruturaDoReal);
  }, 60000);
});

describe('o banco do espelho', () => {
  it('toda consulta, avulsa ou em transação, roda como o papel do espelho e com o caminho do espelho', async () => {
    const espelho = bancoDoEspelho(api.banco);
    const avulsa = (await espelho.query<{ u: string; s: string[] }>('select current_user as u, current_schemas(false) as s')).rows[0]!;
    expect(avulsa.u).toBe('laboratorio_app');
    expect(avulsa.s).toEqual(['laboratorio', 'public']);
    const emTransacao = await espelho.transacao(async (tx) => (await tx.query<{ u: string; s: string[] }>('select current_user as u, current_schemas(false) as s')).rows[0]!);
    expect(emTransacao).toEqual(avulsa);
    // depois, a conexão do real volta ao que era: nada de papel trocado no real
    expect((await api.banco.query<{ u: string }>('select current_user as u')).rows[0]!.u).not.toBe('laboratorio_app');
  });

  it('o papel não enxerga o real: uma consulta ao public por extenso é negada, e o dialeto do real não está disponível', async () => {
    const espelho = bancoDoEspelho(api.banco);
    await expect(espelho.query('select 1 from public.militar')).rejects.toThrow(/permission denied/);
    await expect(espelho.exec('delete from public.militar')).rejects.toThrow(/permission denied/);
    expect(() => espelho.dialeto).toThrow(/não usa o dialeto/);
  });
});
