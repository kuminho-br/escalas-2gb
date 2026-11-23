import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.18, Task 8: acabamento da importação. Dados fictícios (D7): matrículas 9959xx-x.
let api: ApiDeTeste;
const CAB = ['MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'ANTIGUIDADE', 'NASCIMENTO', 'LOTAÇÃO', 'EQUIPE', 'CNH', 'MOTORISTA'];
type Celula = string | number | Date | null;
const linha = (o: Record<string, Celula>) => CAB.map((c) => o[c] ?? null);
const NOVO = (mat: string, guerra: string, extra: Record<string, Celula> = {}) => linha({ 'MATRÍCULA': mat, 'POSTO/GRAD': 'SD', 'NOME COMPLETO': `${guerra} de Tal`, 'NOME DE GUERRA': guerra, 'LOTAÇÃO': '1ª SB', ...extra });
const caminho = (confirmar = false) => `/api/unidades/${api.ids.gb}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`;
async function enviar(linhas: Celula[][], { confirmar = false, aba = 'PECÚLIO' }: { confirmar?: boolean; aba?: string } = {}) {
  return api.pedir('gestorGb', 'POST', caminho(confirmar), formulario(await planilha({ [aba]: [CAB, ...linhas] })));
}
async function previa(linhas: Celula[][], aba = 'PECÚLIO') {
  const r = await enviar(linhas, { aba });
  expect(r.status).toBe(200);
  return r.json();
}
type Ignorada = { linha: number; chave: string; coluna: string; motivo: string };

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('item 3: CNH com categoria repetida', () => {
  it('"AAD" vale como "AD", e a prévia avisa', async () => {
    const p = await previa([NOVO('995901-1', 'REPETIDA', { 'CNH': 'AAD', 'MOTORISTA': 'SIM' })]);
    expect(p.problemas).toEqual([]);
    expect(p.avisos.join('\n')).toContain('A CNH "AAD" da linha 2 tem categoria repetida e vale como AD.');
    await enviar([NOVO('995901-1', 'REPETIDA', { 'CNH': 'AAD', 'MOTORISTA': 'SIM' })], { confirmar: true });
    expect((await api.banco.query<{ cnh: string[] }>("select cnh from militar where matricula = '995901-1'")).rows[0]!.cnh).toEqual(['A', 'D']);
  });
});

describe('item 4: o nome da aba', () => {
  it('vale sem diferenciar maiúsculas, acentos e espaços nas pontas', async () => {
    for (const aba of ['peculio', 'Peculio ', ' PECÚLIO']) {
      const r = await enviar([NOVO('995902-2', 'ABA')], { aba });
      expect(r.status, aba).toBe(200);
    }
  });
});

describe('item 8: linha recusada não cria equipe nova na prévia', () => {
  it('o militar novo sem posto não vira "Equipes novas" na prévia', async () => {
    const p = await previa([linha({ 'MATRÍCULA': '995903-3', 'NOME DE GUERRA': 'SEMPOSTO', 'LOTAÇÃO': '1ª SB', 'EQUIPE': 'XPTO' })]);
    expect(p.problemas.length).toBeGreaterThan(0);
    expect(p.avisos.join('\n')).not.toContain('XPTO');
  });
});

describe('item 9: antiguidade repetida', () => {
  it('a prévia avisa, sem recusar, quando duas linhas (ou uma linha e um militar já cadastrado) têm a mesma antiguidade', async () => {
    await enviar([NOVO('995904-4', 'UM', { 'ANTIGUIDADE': 777 })], { confirmar: true });
    const p = await previa([NOVO('995905-5', 'DOIS', { 'ANTIGUIDADE': 777 }), NOVO('995906-6', 'TRES', { 'ANTIGUIDADE': 778 }), NOVO('995907-7', 'QUATRO', { 'ANTIGUIDADE': 778 })]);
    expect(p.problemas).toEqual([]);
    expect(p.novos.map((n: { chave: string }) => n.chave)).toEqual(['995905-5', '995906-6', '995907-7']);
    const avisos = p.avisos.join('\n');
    expect(avisos).toContain('Antiguidade 777 repetida: 995904-4 e 995905-5.');
    expect(avisos).toContain('Antiguidade 778 repetida: 995906-6 e 995907-7.');
  });
});

describe('item 10: NASCIMENTO que chega como data da planilha', () => {
  it('é aceito quando o ano não é o ano corrente; com o ano corrente continua ignorado, com o motivo de hoje', async () => {
    const anoCorrente = Number(hojeRecife().slice(0, 4));
    const p = await previa([
      NOVO('995908-8', 'ANTIGO', { 'NASCIMENTO': new Date(Date.UTC(1985, 2, 15)) }),
      NOVO('995909-9', 'DEESTEANO', { 'NASCIMENTO': new Date(Date.UTC(anoCorrente, 2, 15)) }),
    ]);
    const ignoradas: Ignorada[] = p.ignoradas;
    expect(ignoradas.filter((i) => i.coluna === 'NASCIMENTO').map((i) => i.chave)).toEqual(['995909-9']);
    await enviar([NOVO('995908-8', 'ANTIGO', { 'NASCIMENTO': new Date(Date.UTC(1985, 2, 15)) })], { confirmar: true });
    expect((await api.banco.query('select nascimento_dia, nascimento_mes, nascimento_ano from militar where matricula = $1', ['995908-8'])).rows[0]).toEqual({ nascimento_dia: 15, nascimento_mes: 3, nascimento_ano: 1985 });
  });
});

describe('item 7 (Review Focus 5): consultas em lote', () => {
  it('uma prévia com 2.000 linhas faz menos de 20 consultas dentro da transação', async () => {
    const linhas = Array.from({ length: 2000 }, (_, i) => NOVO(`9${String(10000 + i).slice(1)}-${i % 10}`, `LOTE${i}`));
    const comandos: string[] = [];
    const original = api.banco.transacao.bind(api.banco);
    api.banco.transacao = (fn) => original((tx) => fn({ ...tx, query: ((sql: string, p?: unknown[]) => (comandos.push(sql), tx.query(sql, p))) as typeof tx.query }));
    try {
      const r = await enviar(linhas);
      expect(r.status).toBe(200);
    } finally {
      api.banco.transacao = original;
    }
    expect(comandos.length).toBeLessThan(20);
  });
});

describe('revisão final: a coluna E-MAIL não lê a E-MAIL PESSOAL', () => {
  it('uma planilha só com MATRÍCULA e E-MAIL PESSOAL não ganha e-mail institucional nem aviso falso', async () => {
    const arquivo = await planilha({ 'PECÚLIO': [['MATRÍCULA', 'POSTO/GRAD', 'NOME DE GUERRA', 'LOTAÇÃO', 'E-MAIL PESSOAL'], ['995910-0', 'SD', 'PESSOAL', '1ª SB', 'x@bombeiros.pe.gov.br']] });
    const r = await api.pedir('gestorGb', 'POST', caminho(true), formulario(arquivo));
    expect(r.status).toBe(200);
    const m = (await api.banco.query<{ email: string | null; email_pessoal: string | null }>("select email, email_pessoal from militar where matricula = '995910-0'")).rows[0]!;
    // a coluna E-MAIL (institucional) não existe na planilha: o institucional fica como estava (vazio) e o e-mail da coluna E-MAIL PESSOAL vai para o pessoal
    expect(m).toEqual({ email: null, email_pessoal: 'x@bombeiros.pe.gov.br' });
    const previa = await (await api.pedir('gestorGb', 'POST', caminho(), formulario(await planilha({ 'PECÚLIO': [['MATRÍCULA', 'E-MAIL PESSOAL'], ['995911-1', 'joao@gmail.com']] })))).json();
    expect(previa.ignoradas.filter((i: Ignorada) => i.coluna === 'E-MAIL')).toEqual([]);
  });
});

describe('revisão final: a antiguidade repetida só conta quem está no alcance da importação e o que a planilha muda', () => {
  it('quem é de fora do alcance (outra unidade) não entra no aviso, e a troca de A de 15 para 20 com B no 15 não avisa', async () => {
    const outra = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const alheio = (await api.banco.query<{ id: string }>("insert into militar (matricula, posto_grad_id, nome_guerra, antiguidade) values ('995920-0', $1, 'ALHEIO', 15) returning id", [posto])).rows[0]!.id;
    await api.banco.query("insert into rastreio (militar_id, unidade_id, jornada, desde) values ($1, $2, 'adm', '2026-01-01')", [alheio, outra]);
    // a importação é da 1ª SB (a 2ª SB não está no alcance dela)
    const sb1 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '1ª SB'")).rows[0]!.id;
    const enviarSb = async (linhas: Celula[][], confirmar = false) => api.pedir('gestorGb', 'POST', `/api/unidades/${sb1}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`, formulario(await planilha({ 'PECÚLIO': [CAB, ...linhas] })));
    const p1 = await (await enviarSb([NOVO('995921-1', 'DAPRIMEIRA', { 'ANTIGUIDADE': 15 })])).json();
    expect(p1.avisos.join('\n')).not.toContain('Antiguidade 15 repetida');
    // A (15) e B (sem antiguidade) entram; depois a planilha põe A no 20 e B no 15
    await enviarSb([NOVO('995922-2', 'AA', { 'ANTIGUIDADE': 15 }), NOVO('995923-3', 'BB')], true);
    const p2 = await (await enviarSb([linha({ 'MATRÍCULA': '995922-2', 'ANTIGUIDADE': 20 }), linha({ 'MATRÍCULA': '995923-3', 'ANTIGUIDADE': 15 })])).json();
    expect(p2.avisos.join('\n')).not.toContain('Antiguidade 15 repetida');
  });
});
