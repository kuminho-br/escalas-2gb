import type { PreviaDoLote, ResultadoDoLote } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.52, Task 2: a prévia e o aplicar da atualização em lote. Dados fictícios (D7): matrículas 996xxx-x.
let api: ApiDeTeste;
let gestorGb: Pessoa;
let escalanteSb: Pessoa;
let sb1: string;
let sb2: string;
let sb3: string;
let alfa1: string;
let alfa2: string;
let quadros: Record<string, string> = {};
const hoje = hojeRecife();
const amanha = somarDias(hoje, 1);
const dia1 = `${hoje.slice(0, 7)}-01`;
const m: Record<string, string> = {};
let n = 0;
const dataBr = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const MSG_SEM_NIVEL = 'Você não tem nível de acesso sobre este militar.';

async function militar(chave: string, unidadeId: string | null, e: { desde?: string; equipe?: string | null; ate?: string | null; jornada?: string; mil?: Record<string, unknown> } = {}) {
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
  const matricula = `9960${String(n).padStart(2, '0')}-${n % 10}`;
  n++;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: posto, nome_guerra: chave, nome_completo: `Fulano ${chave}`, antiguidade: 100 + n, ...e.mil });
  if (unidadeId) {
    await inserir(api.banco, 'rastreio', {
      militar_id: id, unidade_id: unidadeId, jornada: e.jornada ?? 'adm', desde: e.desde ?? dia1, quadro_id: quadros.QBMG, ...(e.ate ? { ate: e.ate } : {}), ...(e.equipe ? { equipe_id: e.equipe } : {}),
    });
  }
  m[chave] = id;
  return id;
}
type Quem = Pessoa;
const previa = (quem: Quem, corpo: unknown) => quem.pedir('POST', '/api/peculio/lote/previa', corpo);
const aplicar = (quem: Quem, corpo: unknown) => quem.pedir('POST', '/api/peculio/lote/aplicar', corpo);
const lote = (chaves: string[], campos: Record<string, unknown>, desde?: string) => ({ militarIds: chaves.map((c) => m[c]), ...(desde ? { desde } : {}), campos });
const verPrevia = async (quem: Quem, corpo: unknown): Promise<PreviaDoLote> => {
  const r = await previa(quem, corpo);
  expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
  return r.json();
};
const periodos = async (chave: string) =>
  (await api.banco.query<{ desde: string; ate: string | null; jornada: string; unidade: string; equipe: string | null }>(
    "select to_char(r.desde,'YYYY-MM-DD') as desde, to_char(r.ate,'YYYY-MM-DD') as ate, r.jornada, u.sigla as unidade, e.nome as equipe from rastreio r join unidade u on u.id = r.unidade_id left join equipe e on e.id = r.equipe_id where r.militar_id = $1 order by r.desde",
    [m[chave]],
  )).rows;
const motivoDe = (p: PreviaDoLote, chave: string) => p.ficamDeFora.find((x) => x.id === m[chave])?.motivo;

beforeAll(async () => {
  api = await montarApi();
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadros[q.sigla] = q.id;
  alfa1 = await inserir(api.banco, 'equipe', { unidade_id: sb1, nome: 'Alfa', ordem_ciclo: 1 });
  alfa2 = await inserir(api.banco, 'equipe', { unidade_id: sb2, nome: 'Alfa', ordem_ciclo: 1 });
  gestorGb = await entrarComo(api, { matricula: '996901-1', nome: 'LGESTOR', nivel: { papel: 'gestor', unidadeId: api.ids.gb } });
  escalanteSb = await entrarComo(api, { matricula: '996902-2', nome: 'LESCAL', nivel: { papel: 'escalante', unidadeId: sb1 } });
});
afterAll(async () => {
  await api.fechar();
});

describe('a prévia', () => {
  it('lista quem muda (de → para), não grava nada e devolve a assinatura', async () => {
    await militar('P1', sb1);
    await militar('P2', sb1);
    const p = await verPrevia(gestorGb, lote(['P1', 'P2'], { jornada: 'pronto' }, hoje));
    expect(p.mudam.map((x) => x.id).sort()).toEqual([m.P1, m.P2].sort());
    expect(p.mudam[0]).toMatchObject({ posto: 'SD', matricula: expect.any(String), de: expect.stringContaining('ADM'), para: expect.stringContaining('Pronto') });
    expect(p.ficamDeFora).toEqual([]);
    expect(p.chegamSemEquipe).toBe(0);
    expect(p.assinatura).toEqual(expect.any(String));
    expect((await periodos('P1'))[0]!.jornada).toBe('adm');
  });

  it('cada motivo de ficar de fora, com o texto fixo', async () => {
    await militar('SEMNIVEL', sb1);
    await militar('SEMABERTO', sb1, { ate: somarDias(hoje, -1) });
    await militar('SEMALFA', sb3);
    await militar('DEPOIS', sb1, { desde: amanha });
    await militar('JAESTA', sb1, { jornada: 'pronto' });
    // o escalante da 1ª SB não é dono do Pecúlio: tudo que é da seção dele fica de fora para ele
    const doEscalante = await verPrevia(escalanteSb, lote(['SEMNIVEL'], { jornada: 'pronto' }, hoje));
    expect(doEscalante.mudam).toEqual([]);
    expect(motivoDe(doEscalante, 'SEMNIVEL')).toBe(MSG_SEM_NIVEL);

    const p = await verPrevia(gestorGb, lote(['SEMABERTO', 'DEPOIS', 'JAESTA'], { jornada: 'pronto' }, hoje));
    expect(motivoDe(p, 'SEMABERTO')).toBe('Sem lotação em aberto.');
    expect(motivoDe(p, 'DEPOIS')).toBe(`A data é anterior à lotação atual dele (${dataBr(amanha)}).`);
    expect(motivoDe(p, 'JAESTA')).toBe('Nada muda para este militar.');

    const q = await verPrevia(gestorGb, lote(['SEMALFA'], { equipe: 'Alfa' }, hoje));
    expect(motivoDe(q, 'SEMALFA')).toBe('A equipe Alfa não existe em 3ª SB.');

    const k = await verPrevia(gestorGb, lote(['P1'], { quadroId: quadros.QOC }, hoje));
    expect(motivoDe(k, 'P1')).toBe('O quadro QOC não serve ao posto dele.');
  });

  it('Review Focus 3: a equipe por nome vale em cada unidade (quem está numa unidade sem ela fica de fora, com o motivo)', async () => {
    await militar('E1', sb1);
    await militar('E2', sb2);
    await militar('E3', sb3);
    const p = await verPrevia(gestorGb, lote(['E1', 'E2', 'E3'], { equipe: 'alfa' }, hoje));
    expect(p.mudam.map((x) => x.id).sort()).toEqual([m.E1, m.E2].sort());
    expect(motivoDe(p, 'E3')).toBe('A equipe alfa não existe em 3ª SB.');
  });

  it('6.53 (b): a equipe aparece como está cadastrada ("Alfa"), mesmo digitada "alfa"', async () => {
    await militar('EQ1', sb1);
    const p = await verPrevia(gestorGb, lote(['EQ1'], { equipe: 'alfa' }, hoje));
    expect(p.mudam[0]!.para).toBe('Equipe: Alfa');
  });

  it('lotação marcada sem equipe marcada: todos chegam sem equipe, e a prévia conta quantos', async () => {
    await militar('L1', sb1, { equipe: alfa1 });
    await militar('L2', sb1);
    const p = await verPrevia(gestorGb, lote(['L1', 'L2'], { unidadeId: sb2 }, hoje));
    expect(p.mudam).toHaveLength(2);
    expect(p.chegamSemEquipe).toBe(2);
    expect((await verPrevia(gestorGb, lote(['L1', 'L2'], { unidadeId: sb2, equipe: 'Alfa' }, hoje))).chegamSemEquipe).toBe(0);
  });

  it('só campos simples, sem "desde": a prévia sai; com campo do rastreio e sem "desde": 400', async () => {
    await militar('S1', sb1);
    const p = await verPrevia(gestorGb, lote(['S1'], { voluntarioJes: true }));
    expect(p.mudam).toHaveLength(1);
    expect(p.mudam[0]!.para).toContain('Voluntário JES');
    const r = await previa(gestorGb, lote(['S1'], { jornada: 'pronto' }));
    expect(r.status).toBe(400);
  });

  it('destino sem permissão: o lote inteiro é recusado (403); 501 militares ou nenhum campo: 400', async () => {
    const r = await previa(escalanteSb, lote(['P1'], { unidadeId: sb2 }, hoje));
    expect(r.status).toBe(403);
    const ids = Array.from({ length: 501 }, () => '00000000-0000-4000-8000-000000000000');
    expect((await previa(gestorGb, { militarIds: ids, desde: hoje, campos: { jornada: 'pronto' } })).status).toBe(400);
    expect((await previa(gestorGb, lote(['P1'], {}, hoje))).status).toBe(400);
  });
});

describe('aplicar', () => {
  it('muda todos os que podem, devolve quantos mudaram e quem ficou de fora; a auditoria traz quem aplicou', async () => {
    await militar('A1', sb1);
    await militar('A2', sb1);
    await militar('A3', sb1, { jornada: 'pronto' });
    const corpo = lote(['A1', 'A2', 'A3'], { jornada: 'pronto' }, hoje);
    const p = await verPrevia(gestorGb, corpo);
    const r = await aplicar(gestorGb, { ...corpo, assinatura: p.assinatura });
    expect(r.status).toBe(200);
    const res: ResultadoDoLote = await r.json();
    expect(res.mudaram).toBe(2);
    expect(res.ficaramDeFora.map((x) => x.motivo)).toEqual(['Nada muda para este militar.']);
    expect((await periodos('A1')).at(-1)!.jornada).toBe('pronto');
    const aud = (await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'rastreio' and registro_id in (select id::text from rastreio where militar_id = $1)", [m.A1])).rows;
    // a carga do teste (sem usuário) não conta; as gravações do lote levam quem aplicou
    const doLote = aud.filter((x) => x.usuario_id !== null);
    expect(doLote.length).toBeGreaterThan(0);
    expect(doLote.every((x) => x.usuario_id === gestorGb.usuarioId)).toBe(true);
  });

  it('Review Focus 1: para um militar só, o lote e o "Alterar situação" deixam o rastreio igual (no mesmo dia e em dia posterior)', async () => {
    for (const chave of ['F1', 'F2', 'F3', 'F4']) await militar(chave, sb1, { desde: chave === 'F2' || chave === 'F3' ? dia1 : hoje });
    // no mesmo dia do período aberto (substitui): F1 pela ficha, F4 pelo lote; em dia posterior (fecha e abre): F2 pela ficha, F3 pelo lote
    const ficha = (chave: string, desde: string) => gestorGb.pedir('POST', `/api/militares/${m[chave]}/situacao`, { unidadeId: sb2, equipeId: alfa2, jornada: 'pronto', desde });
    expect((await ficha('F1', hoje)).status).toBeLessThan(300);
    expect((await ficha('F2', hoje)).status).toBeLessThan(300);
    for (const [chave, desde] of [['F4', hoje], ['F3', hoje]] as const) {
      const corpo = lote([chave], { unidadeId: sb2, equipe: 'Alfa', jornada: 'pronto' }, desde);
      const p = await verPrevia(gestorGb, corpo);
      expect((await aplicar(gestorGb, { ...corpo, assinatura: p.assinatura })).status).toBe(200);
    }
    expect(await periodos('F4')).toEqual(await periodos('F1'));
    expect(await periodos('F3')).toEqual(await periodos('F2'));
  });

  it('Review Focus 2: erro no meio (o 37º falha no banco) e nenhum dos anteriores fica alterado', async () => {
    const chaves = Array.from({ length: 40 }, (_, i) => `T${i}`);
    for (const c of chaves) await militar(c, sb1);
    const corpo = lote(chaves, { jornada: 'pronto' }, hoje);
    const p = await verPrevia(gestorGb, corpo);
    expect(p.mudam).toHaveLength(40);
    const alvo = p.mudam[36]!.id;
    await api.banco.query(`create function falha_do_lote() returns trigger language plpgsql as $$ begin if new.militar_id = '${alvo}' then raise exception 'falha de teste'; end if; return new; end $$`);
    await api.banco.query('create trigger falha_do_lote before insert or update on rastreio for each row execute function falha_do_lote()');
    try {
      const r = await aplicar(gestorGb, { ...corpo, assinatura: p.assinatura });
      expect(r.status).toBeGreaterThanOrEqual(400);
    } finally {
      await api.banco.query('drop trigger falha_do_lote on rastreio');
      await api.banco.query('drop function falha_do_lote()');
    }
    for (const c of chaves) expect((await periodos(c)).at(-1)!.jornada, c).toBe('adm');
  });

  it('Review Focus 4: dois "Aplicar" ao mesmo tempo (clique duplo): um grava, o outro recebe o 409 da lista que mudou', async () => {
    await militar('D1', sb1);
    await militar('D2', sb1);
    const corpo = lote(['D1', 'D2'], { jornada: 'pronto' }, amanha);
    const p = await verPrevia(gestorGb, corpo);
    const [a, b] = await Promise.all([aplicar(gestorGb, { ...corpo, assinatura: p.assinatura }), aplicar(gestorGb, { ...corpo, assinatura: p.assinatura })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const perdeu = a.status === 409 ? a : b;
    expect((await perdeu.json()).erro).toBe('A lista mudou desde a prévia. Refaça a prévia.');
    // gravou uma vez só: o período de antes + o novo
    expect(await periodos('D1')).toHaveLength(2);
  });

  it('uma assinatura que não é a da prévia atual: 409, e nada muda', async () => {
    await militar('G1', sb1);
    const corpo = lote(['G1'], { jornada: 'pronto' }, hoje);
    const r = await aplicar(gestorGb, { ...corpo, assinatura: 'qualquer-outra' });
    expect(r.status).toBe(409);
    expect((await periodos('G1'))[0]!.jornada).toBe('adm');
  });

  it('6.53 (c): a assinatura guarda o "de" e o "para": se o militar mudou entre a prévia e o aplicar, o aplicar recusa (409) mesmo com o "para" igual', async () => {
    await militar('AS1', sb1);
    const antiga = await inserir(api.banco, 'funcao_militar', { nome: 'Função antiga da assinatura' });
    const outra = await inserir(api.banco, 'funcao_militar', { nome: 'Outra função da assinatura' });
    const alvo = await inserir(api.banco, 'funcao_militar', { nome: 'Função nova da assinatura' });
    await api.banco.query('update militar set funcao_militar_id = $2 where id = $1', [m.AS1, antiga]);
    const corpo = lote(['AS1'], { funcaoMilitarId: alvo });
    const p = await verPrevia(gestorGb, corpo);
    // alguém mudou a função dele pela ficha: o "para" da prévia continua o mesmo, o "de" não
    await api.banco.query('update militar set funcao_militar_id = $2 where id = $1', [m.AS1, outra]);
    const r = await aplicar(gestorGb, { ...corpo, assinatura: p.assinatura });
    expect(r.status).toBe(409);
    expect((await api.banco.query<{ funcao_militar_id: string }>('select funcao_militar_id from militar where id = $1', [m.AS1])).rows[0]!.funcao_militar_id).toBe(outra);
  });

  it('campos simples (voluntário JES, abono, comportamento, função) mudam pelo mesmo caminho da ficha', async () => {
    await militar('H1', sb1);
    const funcao = await inserir(api.banco, 'funcao_militar', { nome: 'Chefe de seção do lote' });
    const corpo = lote(['H1'], { voluntarioJes: true, abonoPermanencia: true, comportamento: 'Bom', funcaoMilitarId: funcao });
    const p = await verPrevia(gestorGb, corpo);
    expect((await aplicar(gestorGb, { ...corpo, assinatura: p.assinatura })).status).toBe(200);
    const mil = (await api.banco.query<{ voluntario_jes: boolean; abono_permanencia: boolean; comportamento: string; funcao_militar_id: string }>('select voluntario_jes, abono_permanencia, comportamento, funcao_militar_id from militar where id = $1', [m.H1])).rows[0]!;
    expect(mil).toEqual({ voluntario_jes: true, abono_permanencia: true, comportamento: 'Bom', funcao_militar_id: funcao });
    const aud = (await api.banco.query<{ usuario_id: string }>("select usuario_id from auditoria where tabela = 'militar' and registro_id = $1 and acao = 'update' order by id desc limit 1", [m.H1])).rows[0]!;
    expect(aud.usuario_id).toBe(gestorGb.usuarioId);
  });
});
