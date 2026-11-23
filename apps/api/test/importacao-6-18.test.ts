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
