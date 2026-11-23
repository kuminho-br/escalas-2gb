import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoPglite } from '../src/banco/pglite.ts';
import { migrar, PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

// Dados fictícios (D7). Migra até a 0029, grava dois meses da escala dos oficiais à moda antiga (todo elegível participava) e aplica a 0030.
async function migrarAte(banco: Banco, limite: string) {
  const pasta = mkdtempSync(join(tmpdir(), 'migracoes-'));
  for (const f of readdirSync(PASTA_MIGRACOES).filter((f) => f.endsWith('.sql') && f < limite)) copyFileSync(join(PASTA_MIGRACOES, f), join(pasta, f));
  await migrar(banco, pasta);
}

let banco: Banco;
const id: Record<string, string> = {};
let mesComCotas: string;
let mesSemCotas: string;
const marcados = async (mesId: string) =>
  (await banco.query<{ nome: string }>(
    'select m.nome_guerra as nome from oficiais_participante p join militar m on m.id = p.militar_id where p.mes_id = $1 order by m.nome_guerra', [mesId])).rows.map((r) => r.nome);

beforeAll(async () => {
  banco = await bancoPglite();
  await migrarAte(banco, '0030');
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]!.id;
  const gb = await inserir(banco, 'unidade', { tipo: 'grupamento', sigla: 'GB-M30', nome: 'Grupamento M30', mae_id: raiz, desde: '2026-11-01' });
  const secao = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-M30', nome: 'Seção M30', mae_id: gb, desde: '2026-11-01' });
  const posto = async (sigla: string) => (await banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [sigla])).rows[0]!.id;
  const quadro = async (sigla: string) => (await banco.query<{ id: string }>('select id from quadro where sigla = $1', [sigla])).rows[0]!.id;
  const situacao = async (nome: string) => (await banco.query<{ id: string }>('select id from situacao_militar where nome = $1', [nome])).rows[0]!.id;
  let n = 0;
  const oficial = async (nome: string, q: string, unidade: string, sit = 'Ativa') => {
    n++;
    id[nome] = await inserir(banco, 'militar', { matricula: `99071${n}-${n}`, posto_grad_id: await posto(q === 'QBMG' ? 'SD BM' : 'CAP BM'), nome_guerra: nome });
    await inserir(banco, 'rastreio', { militar_id: id[nome], unidade_id: unidade, jornada: 'adm', desde: '2026-11-01', quadro_id: await quadro(q), situacao_id: await situacao(sit) });
  };
  await oficial('COM_COTA', 'QOC', gb);
  await oficial('ABAIXO', 'QOA', secao);
  await oficial('PRACA', 'QBMG', gb);
  await oficial('DESATIVADO', 'QOC', gb, 'Desativado');
  // dezembro com cotas calculadas só para COM_COTA (ABAIXO chegou depois do cálculo); janeiro gravado, ainda sem cotas
  const servico = await inserir(banco, 'servico', { unidade_id: gb, nome: 'Oficial de operações', tipo: 'ordinario', cor: '#2F8F5B' });
  mesComCotas = await inserir(banco, 'oficiais_mes', { unidade_id: gb, mes: '2026-12-01', servico_id: servico, cotas_em: '2026-12-01T10:00:00Z' });
  await inserir(banco, 'oficiais_cota', { mes_id: mesComCotas, militar_id: id.COM_COTA, ordem: 1, dias: 31, devido: 62, cota: 62, sobra: false }, 'mes_id');
  mesSemCotas = await inserir(banco, 'oficiais_mes', { unidade_id: gb, mes: '2027-01-01' });
  await migrarAte(banco, '9999');
});
afterAll(async () => {
  await banco.fechar();
});

describe('migração 0030: quem participa da rodada', () => {
  it('no mês com cotas, participa quem tem cota', async () => {
    expect(await marcados(mesComCotas)).toEqual(['COM_COTA']);
  });

  it('no mês ainda sem cotas, participa todo elegível da unidade e de baixo dela (a regra de antes), sem a praça nem o desativado', async () => {
    expect(await marcados(mesSemCotas)).toEqual(['ABAIXO', 'COM_COTA']);
  });

  it('pode rodar de novo sem duplicar nem mexer nas marcas', async () => {
    await banco.query('delete from oficiais_participante where mes_id = $1 and militar_id = $2', [mesSemCotas, id.ABAIXO]);
    await banco.exec(readFileSync(join(PASTA_MIGRACOES, '0030_oficiais_participantes.sql'), 'utf8'));
    // o mês que já tem alguma marca não é recarregado: o gestor pode ter desmarcado
    expect(await marcados(mesSemCotas)).toEqual(['COM_COTA']);
    expect(await marcados(mesComCotas)).toEqual(['COM_COTA']);
  });

  it('apagar o mês apaga as marcas dele', async () => {
    await banco.query('delete from oficiais_mes where id = $1', [mesSemCotas]);
    expect((await banco.query('select 1 from oficiais_participante where mes_id = $1', [mesSemCotas])).rows).toHaveLength(0);
  });
});
