import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import type { Banco } from '../src/banco/banco.ts';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 7.3.1, achado da revisão: quem altera a escala lê o estado com a trava COMPARTILHADA da mesma chave que a passagem de estado usa (exclusiva), então publicar e uma alteração em curso
// esperam uma pela outra em vez de a alteração gravar contra o estado antigo. O PGlite dos testes tem uma conexão só e serializa as transações: o teste confere a chave e a ordem das consultas.
let api: ApiDeTeste;
let gestor: Pessoa;
const consultas: { sql: string; params: unknown[] }[] = [];
const futuro = somarDias(hojeRecife(), 40);
const mes = futuro.slice(0, 7);

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => {
    const registrando: Banco = { ...banco, transacao: (fn) => banco.transacao((tx) => fn({ ...tx, query: ((sql: string, params?: unknown[]) => { consultas.push({ sql, params: params ?? [] }); return tx.query(sql, params); }) as typeof tx.query })) };
    return criarApp({ banco: registrando, auth, limiteDeBuscas: Infinity });
  });
  gestor = await entrarComo(api, { matricula: '997101-1', nome: 'TRAVAG', nivel: { papel: 'gestor', unidadeId: api.ids.gb } });
});
afterAll(async () => {
  await api.fechar();
});

describe('a trava do estado', () => {
  it('a passagem de estado e a alteração usam a mesma chave, a passagem exclusiva e a alteração compartilhada, antes de ler o estado', async () => {
    const escala = (await (await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/escalas`, { nome: 'Trava' })).json()).id as string;
    consultas.length = 0;
    expect((await gestor.pedir('POST', `/api/escalas/${escala}/mes/${mes}/publicar`)).status).toBe(200);
    const exclusiva = consultas.find((c) => /pg_advisory_xact_lock\(hashtext/.test(c.sql) && String(c.params[0]).startsWith('estado|'));
    expect(exclusiva).toBeDefined();

    // uma alteração numa escala publicada (turno futuro): sem a trava, o estado seria lido solto
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const militar = await inserir(api.banco, 'militar', { matricula: '997102-2', posto_grad_id: posto, nome_guerra: 'TRAVA', nome_completo: 'Fulano Trava', antiguidade: 800 });
    await inserir(api.banco, 'rastreio', { militar_id: militar, unidade_id: api.ids.secao, jornada: 'pronto', desde: `${mes}-01` });
    const servico = await inserir(api.banco, 'servico', { unidade_id: api.ids.secao, nome: 'Plantão trava', tipo: 'ordinario', cor: '#3C5F9C' });
    const turno = await inserir(api.banco, 'turno', { servico_id: servico, letra: 'A', inicio: '08:00', fim: '20:00' });
    await api.banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [escala, servico]);
    consultas.length = 0;
    const r = await api.pedir('escalante', 'POST', `/api/escalas/${escala}/alocacoes`, { militarId: militar, data: futuro, turnoId: turno, guarnicaoId: null, funcaoId: null });
    expect(r.status, JSON.stringify(await r.clone().json())).toBe(201);
    const compartilhada = consultas.findIndex((c) => /pg_advisory_xact_lock_shared\(hashtext/.test(c.sql));
    const leituraDoEstado = consultas.findIndex((c) => /from escala_estado k/.test(c.sql));
    expect(compartilhada).toBeGreaterThanOrEqual(0);
    // a mesma chave da passagem de estado (escala e mês)
    expect(consultas[compartilhada]!.params[0]).toBe(exclusiva!.params[0]);
    expect(exclusiva!.params[0]).toBe(`estado|${escala}|${mes}-01`);
    expect(leituraDoEstado).toBeGreaterThan(compartilhada);
  });
});
