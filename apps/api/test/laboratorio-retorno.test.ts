import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { telaSemParametros } from '../src/laboratorio/retornos.ts';
import { montarApi, entrarComo, type ApiDeTeste } from './apoio-api.ts';

// 6.60, Task 1: as ferramentas em teste e o retorno (do REAL, ligados à conta real). Dados fictícios (D7).
let api: ApiDeTeste;
let adm: string;
const perfil: Record<string, string> = {};
const MES = `${hojeRecife().slice(0, 7)}-01`;
const n = async (sql: string, params: unknown[] = []) => (await api.banco.query<{ n: number }>(sql, params)).rows[0]!.n;
const entrar = async (quem: 'semPapel' | 'escalante' | 'gestorGb' | 'admin', nivel: string) => {
  expect((await api.pedir(quem, 'PUT', '/api/laboratorio/perfil', { perfilId: perfil[nivel] })).status).toBe(200);
};
const cadastrar = async (nome = 'Grade nova', extra: Record<string, unknown> = {}) => {
  const r = await api.pedir('admin', 'POST', '/api/laboratorio/ferramentas', { nome, oQueTestar: 'Abra a grade e marque um serviço.', ...extra });
  expect(r.status).toBe(201);
  return (await r.json()) as { id: string; situacao: string; fim: string | null };
};
const entrarNoLab = () => entrar('semPapel', 'administrador');
const retorno = (quem: 'semPapel' | 'escalante' | 'gestorGb' | 'admin', corpo: Record<string, unknown>) => api.pedir(quem, 'POST', '/api/laboratorio/retornos', corpo);

beforeAll(async () => {
  api = await montarApi(undefined, { espelho: true });
  for (const p of (await (await api.pedir('semPapel', 'GET', '/api/laboratorio/perfis')).json()) as { perfilId: string; nivel: string }[]) perfil[p.nivel] = p.perfilId;
  adm = api.usuarios.admin;
}, 600000);
afterAll(async () => {
  await api.fechar();
});

describe('as ferramentas em teste', () => {
  it('o ciclo: o administrador cadastra, todos leem, a situação muda (com a data do fim) e a lista mostra as que acabaram', async () => {
    const f = await cadastrar('Grade nova', { caminho: '/grade' });
    expect(f).toMatchObject({ situacao: 'em_teste', fim: null });
    const lista = await (await api.pedir('semPapel', 'GET', '/api/laboratorio/ferramentas')).json();
    expect(lista).toEqual([expect.objectContaining({ id: f.id, nome: 'Grade nova', oQueTestar: 'Abra a grade e marque um serviço.', caminho: '/grade', situacao: 'em_teste', inicio: hojeRecife() })]);
    const mudada = await api.pedir('admin', 'PATCH', `/api/laboratorio/ferramentas/${f.id}`, { situacao: 'encerrada' });
    expect(mudada.status).toBe(200);
    expect(await mudada.json()).toMatchObject({ situacao: 'encerrada', fim: hojeRecife() });
    const virou = await api.pedir('admin', 'PATCH', `/api/laboratorio/ferramentas/${f.id}`, { situacao: 'virou_modulo' });
    expect(await virou.json()).toMatchObject({ situacao: 'virou_modulo', fim: hojeRecife() });
    const volta = await api.pedir('admin', 'PATCH', `/api/laboratorio/ferramentas/${f.id}`, { situacao: 'em_teste' });
    expect(await volta.json()).toMatchObject({ situacao: 'em_teste', fim: null });
  });

  it('as em teste vêm antes das que acabaram na lista, e as que acabaram aparecem com a situação', async () => {
    const velha = await cadastrar('Velha');
    await api.pedir('admin', 'PATCH', `/api/laboratorio/ferramentas/${velha.id}`, { situacao: 'encerrada' });
    const nova = await cadastrar('Nova');
    const lista = (await (await api.pedir('semPapel', 'GET', '/api/laboratorio/ferramentas')).json()) as { id: string; situacao: string }[];
    expect(lista.findIndex((f) => f.id === nova.id)).toBeLessThan(lista.findIndex((f) => f.id === velha.id));
    expect(lista.find((f) => f.id === velha.id)?.situacao).toBe('encerrada');
  });

  it('Review Focus 3: o perfil de administrador de teste não administra; só o administrador real cadastra, muda e lê os retornos', async () => {
    await entrar('semPapel', 'administrador');
    const f = await cadastrar('Só do admin');
    for (const quem of ['semPapel', 'escalante', 'gestorGb'] as const) {
      expect((await api.pedir(quem, 'POST', '/api/laboratorio/ferramentas', { nome: 'x', oQueTestar: 'y' })).status, quem).toBe(403);
      expect((await api.pedir(quem, 'PATCH', `/api/laboratorio/ferramentas/${f.id}`, { situacao: 'encerrada' })).status, quem).toBe(403);
      expect((await api.pedir(quem, 'GET', '/api/laboratorio/retornos')).status, quem).toBe(403);
    }
    expect(await n('select count(*)::int as n from ferramenta_teste where nome = $1', ['x'])).toBe(0);
  });

  it('os dados do cadastro têm limite e frase amigável; ferramenta que não existe é 404', async () => {
    const ruim = await api.pedir('admin', 'POST', '/api/laboratorio/ferramentas', { nome: '', oQueTestar: '', caminho: 'grade' });
    expect(ruim.status).toBe(400);
    expect(await ruim.json()).toMatchObject({ campos: { nome: 'Dê um nome à ferramenta.', oQueTestar: 'Diga o que testar.', caminho: 'O caminho começa com / e fica dentro do site.' } });
    expect((await api.pedir('admin', 'PATCH', '/api/laboratorio/ferramentas/00000000-0000-4000-8000-000000000999', { situacao: 'encerrada' })).status).toBe(404);
    expect((await api.pedir('admin', 'PATCH', '/api/laboratorio/ferramentas/x', { situacao: 'encerrada' })).status).toBe(404);
  });
});

describe('o retorno', () => {
  it('Review Focus 2: sem sessão no Laboratório é 409; com ela, grava a conta REAL e o nome do perfil de teste, mesmo com o perfil de administrador', async () => {
    const f = await cadastrar('Retornável');
    await api.pedir('escalante', 'DELETE', '/api/laboratorio/perfil');
    const sem = await retorno('escalante', { ferramentaId: f.id, tela: '/grade', texto: 'Gostei.', nota: 4 });
    expect(sem.status).toBe(409);
    expect(await sem.json()).toEqual({ erro: 'Entre no Laboratório para deixar um retorno.' });
    expect(await n('select count(*)::int as n from retorno_laboratorio')).toBe(0);

    await entrar('semPapel', 'administrador');
    const ok = await retorno('semPapel', { ferramentaId: f.id, tela: '/grade?mes=2026-12&militar=abc', texto: '  Ficou claro.  ', nota: 5 });
    expect(ok.status).toBe(201);
    const [linha] = (await api.banco.query<{ usuario_id: string; perfil_de_teste: string; tela: string; texto: string; nota: number }>('select usuario_id, perfil_de_teste, tela, texto, nota::int as nota from retorno_laboratorio')).rows;
    expect(linha).toEqual({ usuario_id: api.usuarios.semPapel, perfil_de_teste: 'Administrador de teste', tela: '/grade', texto: 'Ficou claro.', nota: 5 });
  });

  it('Review Focus 4: em ferramenta encerrada ou que virou módulo, 400 "Esta ferramenta não está mais em teste."; ferramenta que não existe, 404', async () => {
    await entrar('escalante', 'escalante');
    for (const situacao of ['encerrada', 'virou_modulo']) {
      const f = await cadastrar(`Acabada ${situacao}`);
      await api.pedir('admin', 'PATCH', `/api/laboratorio/ferramentas/${f.id}`, { situacao });
      const r = await retorno('escalante', { ferramentaId: f.id, tela: '/grade', texto: 'Tarde demais.', nota: 3 });
      expect(r.status, situacao).toBe(400);
      expect(await r.json()).toEqual({ erro: 'Esta ferramenta não está mais em teste.' });
    }
    expect((await retorno('escalante', { ferramentaId: '00000000-0000-4000-8000-000000000999', tela: '/grade', texto: 'x', nota: 3 })).status).toBe(404);
  });

  it('Review Focus 5: nota 0 e 6, texto vazio e com 2001 caracteres são recusados com frase amigável; 1, 5 e 2000 passam', async () => {
    await entrar('escalante', 'escalante');
    const f = await cadastrar('Limites');
    const base = { ferramentaId: f.id, tela: '/grade' };
    const antes = await n('select count(*)::int as n from retorno_laboratorio');
    for (const nota of [0, 6, 2.5]) {
      const r = await retorno('escalante', { ...base, texto: 'ok', nota });
      expect(r.status, `nota ${nota}`).toBe(400);
      expect(await r.json()).toMatchObject({ campos: { nota: 'A nota vai de 1 a 5.' } });
    }
    expect(await (await retorno('escalante', { ...base, texto: '   ', nota: 3 })).json()).toMatchObject({ campos: { texto: 'Escreva o seu retorno.' } });
    expect(await (await retorno('escalante', { ...base, texto: 'a'.repeat(2001), nota: 3 })).json()).toMatchObject({ campos: { texto: 'O retorno tem até 2000 caracteres.' } });
    expect(await n('select count(*)::int as n from retorno_laboratorio')).toBe(antes);
    for (const [texto, nota] of [['a', 1], ['b'.repeat(2000), 5]] as const) expect((await retorno('escalante', { ...base, texto, nota })).status).toBe(201);
  });

  it('o corpo não escolhe o autor nem o perfil: campos a mais são recusados', async () => {
    await entrar('escalante', 'escalante');
    const f = await cadastrar('Sem trapaça');
    const r = await retorno('escalante', { ferramentaId: f.id, tela: '/grade', texto: 'x', nota: 3, usuarioId: adm, perfilDeTeste: 'Outro' });
    expect(r.status).toBe(400);
  });

  it('o banco recusa editar e apagar um retorno (e esvaziar a tabela)', async () => {
    await expect(api.banco.query("update retorno_laboratorio set texto = 'mudado'")).rejects.toThrow(/não se altera nem se apaga/);
    await expect(api.banco.query('delete from retorno_laboratorio')).rejects.toThrow(/não se altera nem se apaga/);
    await expect(api.banco.exec('truncate retorno_laboratorio')).rejects.toThrow(/não se altera nem se apaga/);
  });

  it('a lista do administrador traz o nome e a matrícula da conta real, o perfil usado, a tela e a nota; filtra por ferramenta e por período', async () => {
    const a = await cadastrar('Filtro A');
    const b = await cadastrar('Filtro B');
    await entrar('gestorGb', 'gestor');
    await retorno('gestorGb', { ferramentaId: a.id, tela: '/militares/00000000-0000-4000-8000-000000000001', texto: 'Texto A', nota: 2 });
    await retorno('gestorGb', { ferramentaId: b.id, tela: '/escalas', texto: 'Texto B', nota: 4 });
    const todos = (await (await api.pedir('admin', 'GET', '/api/laboratorio/retornos')).json()) as { ferramenta: string; conta: { nome: string; matricula: string }; perfilDeTeste: string; tela: string; texto: string; nota: number; criadoEm: string }[];
    const doA = todos.find((r) => r.texto === 'Texto A')!;
    expect(doA).toMatchObject({ ferramenta: 'Filtro A', perfilDeTeste: 'Gestor de teste', tela: '/militares/:id', nota: 2, conta: { matricula: '990908-8' } });
    expect(doA.conta.nome).toBeTruthy();
    expect(doA.criadoEm).toMatch(/^\d{4}-\d\d-\d\dT/);
    const filtrado = (await (await api.pedir('admin', 'GET', `/api/laboratorio/retornos?ferramenta=${b.id}`)).json()) as { texto: string }[];
    expect(filtrado.map((r) => r.texto)).toEqual(['Texto B']);
    const hoje = hojeRecife();
    const doDia = (await (await api.pedir('admin', 'GET', `/api/laboratorio/retornos?de=${hoje}&ate=${hoje}`)).json()) as unknown[];
    expect(doDia.length).toBeGreaterThanOrEqual(2);
    expect(await (await api.pedir('admin', 'GET', '/api/laboratorio/retornos?de=2020-01-01&ate=2020-01-31')).json()).toEqual([]);
    expect((await api.pedir('admin', 'GET', '/api/laboratorio/retornos?de=ontem')).status).toBe(400);
    expect((await api.pedir('admin', 'GET', '/api/laboratorio/retornos?ferramenta=x')).status).toBe(400);
  });

  it('apagar o militar de quem deixou um retorno funciona: o retorno fica, sem autoria, e a lista do administrador diz "conta apagada"', async () => {
    await entrarNoLab();
    const f = await cadastrar('Retorno de quem sai');
    const pessoa = await entrarComo(api, { matricula: '990971-9', nome: 'RETORNANTE' });
    expect((await pessoa.pedir('PUT', '/api/laboratorio/perfil', { perfilId: perfil.militar })).status).toBe(200);
    expect((await pessoa.pedir('POST', '/api/laboratorio/retornos', { ferramentaId: f.id, tela: '/grade', texto: 'Vou sair.', nota: 3 })).status).toBe(201);
    const apagar = await api.pedir('admin', 'DELETE', `/api/militares/${pessoa.militarId}`, { matricula: '990971-9' });
    expect(apagar.status).toBe(204);
    const [linha] = (await api.banco.query<{ usuario_id: string | null; texto: string }>("select usuario_id, texto from retorno_laboratorio where texto = 'Vou sair.'")).rows;
    expect(linha).toEqual({ usuario_id: null, texto: 'Vou sair.' });
    const lista = (await (await api.pedir('admin', 'GET', '/api/laboratorio/retornos')).json()) as { texto: string; conta: unknown }[];
    expect(lista.find((r) => r.texto === 'Vou sair.')?.conta).toBeNull();
  });

  it('a limpeza dos dados de teste (separar-teste) também não quebra com um retorno de conta de teste', async () => {
    const f = await cadastrar('Retorno de teste');
    const pessoa = await entrarComo(api, { matricula: '990972-9', nome: 'CONTADETESTE' });
    expect((await pessoa.pedir('PUT', '/api/laboratorio/perfil', { perfilId: perfil.militar })).status).toBe(200);
    expect((await pessoa.pedir('POST', '/api/laboratorio/retornos', { ferramentaId: f.id, tela: '/grade', texto: 'Conta de teste.', nota: 4 })).status).toBe(201);
    const { contagemParaVarios } = await import('../src/cadastros/apagar-militar.ts');
    await api.banco.transacao(async (tx) => {
      await contagemParaVarios(tx, [pessoa.militarId], true);
    });
    expect((await api.banco.query("select 1 from retorno_laboratorio where texto = 'Conta de teste.' and usuario_id is null")).rows).toHaveLength(1);
  });

  it('só a perda da conta passa pelo gatilho: apagar ou mudar outro campo do retorno continua recusado, mesmo junto com esvaziar a conta', async () => {
    await expect(api.banco.query("update retorno_laboratorio set usuario_id = null, texto = 'mudado' where usuario_id is not null")).rejects.toThrow(/não se altera nem se apaga/);
    await expect(api.banco.query('delete from retorno_laboratorio where usuario_id is null')).rejects.toThrow(/não se altera nem se apaga/);
  });

  it('o caminho da ferramenta fica dentro do site: // e : são recusados; datas do período invertidas, 400', async () => {
    for (const caminho of ['//evil.com', '/a:b', 'grade', 'https://x.com']) {
      expect((await api.pedir('admin', 'POST', '/api/laboratorio/ferramentas', { nome: 'x', oQueTestar: 'y', caminho })).status, caminho).toBe(400);
    }
    expect((await api.pedir('admin', 'GET', '/api/laboratorio/retornos?de=2026-12-31&ate=2026-12-01')).status).toBe(400);
  });

  it('a tela é gravada sem parâmetros: sem busca, sem âncora, sem barra final, e o identificador vira :id', () => {
    expect(telaSemParametros('/grade?mes=2026-12&militar=1#topo')).toBe('/grade');
    expect(telaSemParametros('/escalas/')).toBe('/escalas');
    expect(telaSemParametros('/militares/3f2b8c1e-0b7a-4c3e-9d1a-1234567890ab/acesso')).toBe('/militares/:id/acesso');
    expect(telaSemParametros('/militares/123456-7')).toBe('/militares/:id');
    expect(telaSemParametros('/')).toBe('/');
    expect(telaSemParametros('?x=1')).toBe('/');
  });
});

describe('Review Focus 1: o Laboratório não perde nada ao recomeçar', () => {
  it('depois de recomeçar o espelho, as ferramentas e os retornos continuam, e o espelho não ganhou nenhum', async () => {
    const antes = { ferramentas: await n('select count(*)::int as n from public.ferramenta_teste'), retornos: await n('select count(*)::int as n from public.retorno_laboratorio') };
    expect(antes.ferramentas).toBeGreaterThan(0);
    expect(antes.retornos).toBeGreaterThan(0);
    expect((await api.pedir('admin', 'POST', '/api/laboratorio/recomecar')).status).toBe(200);
    expect(await n('select count(*)::int as n from public.ferramenta_teste')).toBe(antes.ferramentas);
    expect(await n('select count(*)::int as n from public.retorno_laboratorio')).toBe(antes.retornos);
    // as tabelas existem no espelho (a estrutura é igual), vazias e sem uso
    expect(await n('select count(*)::int as n from laboratorio.ferramenta_teste')).toBe(0);
    expect(await n('select count(*)::int as n from laboratorio.retorno_laboratorio')).toBe(0);
    void MES;
  }, 300000);
});
