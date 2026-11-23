import type { FichaMilitar, OficialNoSaldo } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// Entrega 6.16, Task 4: rastreio, quadro e situação. Dados fictícios (D7): matrículas 990xxx-x.
let api: ApiDeTeste;
let seq = 0;
const hoje = hojeRecife();
const mais = (dias: number) => new Date(Date.parse(`${hoje}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
const quadro: Record<string, string> = {};
const brasil = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const postoDe = async (siglas: string[]) => (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = any($1)', [siglas])).rows[0]!.id;

beforeAll(async () => {
  api = await montarApi();
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
});
afterAll(async () => {
  await api.fechar();
});

/** Um militar fictício; `periodos` é o rastreio dele (a unidade é a 1ª SB). */
async function militar(extra: { posto?: string[]; antiguidade?: number | null; nascimento?: { dia: number; mes: number; ano: number | null } } = {}, periodos: { desde: string; ate?: string; quadro?: string | null; jornada?: 'pronto' | 'adm' }[] = []) {
  seq++;
  const id = await inserir(api.banco, 'militar', {
    matricula: `990${String(700 + seq).padStart(3, '0')}-${seq % 10}`, posto_grad_id: await postoDe(extra.posto ?? ['SD', 'SD BM']), nome_guerra: `RAST${seq}`, antiguidade: extra.antiguidade ?? null,
    ...(extra.nascimento ? { nascimento_dia: extra.nascimento.dia, nascimento_mes: extra.nascimento.mes, nascimento_ano: extra.nascimento.ano } : {}),
  });
  for (const p of periodos) {
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: api.ids.secao, jornada: p.jornada ?? 'adm', desde: p.desde, ate: p.ate ?? null, quadro_id: p.quadro ? quadro[p.quadro] : null });
  }
  return id;
}
const ficha = async (id: string): Promise<FichaMilitar> => (await api.pedir('gestorGb', 'GET', `/api/militares/${id}`)).json();
const alterar = (id: string, corpo: Record<string, unknown>) => api.pedir('gestorGb', 'POST', `/api/militares/${id}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', ...corpo });

describe('alterar a situação e a ficha (6.16, Task 4)', () => {
  it('item 1: "Alterar situação" de quem tem todos os períodos fechados abre o período com o quadro do posto (quando só um serve) e a situação padrão', async () => {
    const id = await militar({}, [{ desde: mais(-60), ate: mais(-30), quadro: 'QBMG' }]);
    const r = await alterar(id, { desde: hoje });
    expect(r.status).toBe(201);
    const aberto = (await api.banco.query<{ quadro: string | null; situacao: string }>(
      `select q.sigla as quadro, s.nome as situacao from rastreio r left join quadro q on q.id = r.quadro_id join situacao_militar s on s.id = r.situacao_id where r.militar_id = $1 and r.ate is null`, [id],
    )).rows;
    expect(aberto).toEqual([{ quadro: 'QBMG', situacao: 'Ativa' }]);
  });

  it('item 4: a antiguidade repetida com um colega que tem dois períodos no mês cita o colega uma vez só', async () => {
    const a = await militar({ antiguidade: 8801 }, [{ desde: primeiroDoMes, quadro: 'QBMG' }]);
    const b = await militar({ antiguidade: 8801 }, [{ desde: mais(-90), ate: mais(-1), quadro: 'QBMG', jornada: 'pronto' }, { desde: hoje, quadro: 'QBMG', jornada: 'adm' }]);
    const nomeB = (await api.banco.query<{ nome_guerra: string }>('select nome_guerra from militar where id = $1', [b])).rows[0]!.nome_guerra;
    expect((await ficha(a)).antiguidadeRepetidaCom).toEqual([nomeB]);
  });

  it('item 5: PATCH do nascimento sem o ano mantém o ano gravado; com "ano: null" limpa', async () => {
    const id = await militar({ nascimento: { dia: 15, mes: 3, ano: 1985 } }, [{ desde: primeiroDoMes, quadro: 'QBMG' }]);
    const anoGravado = async () => (await api.banco.query<{ nascimento_ano: number | null }>('select nascimento_ano from militar where id = $1', [id])).rows[0]!.nascimento_ano;
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, { nascimento: { dia: 16, mes: 3 } })).status).toBe(200);
    expect(await anoGravado()).toBe(1985);
    expect((await api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, { nascimento: { dia: 16, mes: 3, ano: null } })).status).toBe(200);
    expect(await anoGravado()).toBeNull();
  });

  it('item 6: chave desconhecida no PATCH da ficha é 400 "Campo desconhecido: {nome}."', async () => {
    const id = await militar({}, [{ desde: primeiroDoMes, quadro: 'QBMG' }]);
    const r = await api.pedir('gestorGb', 'PATCH', `/api/militares/${id}`, { telefoneCelular: '(81) 90000-0000' });
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('Campo desconhecido: telefoneCelular.');
  });

  it('item 10: "Alterar situação" antes do período aberto diz a data: "Use uma data a partir de dd/mm/aaaa."', async () => {
    const id = await militar({}, [{ desde: mais(-10), quadro: 'QBMG' }]);
    const r = await alterar(id, { desde: mais(-20) });
    expect(r.status).toBe(400);
    const corpo = await r.json();
    expect(corpo.erro).toBe(`Use uma data a partir de ${brasil(mais(-10))}.`);
    expect(corpo.campos.desde).toBe(`Use uma data a partir de ${brasil(mais(-10))}.`);
  });
});

describe('oficiais: o quadro é o do período do mês (6.16, Task 4, item 2)', () => {
  it('no saldo, o oficial com QOC neste mês e QOA marcado para o mês que vem aparece como QOC', async () => {
    const id = await militar({ posto: ['CAP', 'CAP BM'] }, [
      { desde: mais(-120), ate: `${hoje.slice(0, 7)}-28`, quadro: 'QOC' },
    ]);
    await api.banco.query("insert into rastreio (militar_id, unidade_id, jornada, desde, quadro_id) values ($1, $2, 'adm', $3::date + interval '40 days', $4)", [id, api.ids.secao, `${hoje.slice(0, 7)}-28`, quadro.QOA]);
    // entra no painel de saldo por um lançamento de ajuste (o painel mostra quem tem lançamento)
    await api.banco.query("insert into oficiais_saldo (unidade_id, militar_id, tipo, valor, motivo) values ($1, $2, 'ajuste', 1, 'teste do quadro do mês')", [api.ids.gb, id]);
    const saldo: OficialNoSaldo[] = await (await api.pedir('gestorGb', 'GET', `/api/unidades/${api.ids.gb}/oficiais-saldo`)).json();
    const nome = (await api.banco.query<{ nome_guerra: string }>('select nome_guerra from militar where id = $1', [id])).rows[0]!.nome_guerra;
    expect(saldo.find((o) => o.nomeGuerra === nome)?.quadro).toBe('QOC');
  });
});
