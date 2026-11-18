import type { Hono } from 'hono';
import { somarMeses, type Posto } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';

// O escalante da 1ª SB não pode ler nem mexer em nada da 2ª SB, em nenhuma rota. Os registros da 2ª SB são criados pelo
// administrador (papel na raiz); a varredura troca :u e :id pelos da 2ª SB e exige 403.
let api: ApiDeTeste;
let hono: Hono;
let outra: string;
const ids: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);

async function pelaRaiz(metodo: string, caminho: string, corpo: unknown): Promise<any> {
  const r = await api.pedir('admin', metodo, caminho, corpo);
  expect([200, 201]).toContain(r.status);
  return r.json();
}

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => (hono = criarApp({ banco, auth })));
  outra = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '2ª SB', nome: '2ª Seção de Bombeiros', mae_id: api.ids.gb, desde: '2026-11-01' });
  const u = `/api/unidades/${outra}`;
  const servico = await pelaRaiz('POST', `${u}/servicos`, { nome: 'Alheio', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' });
  ids.servicos = servico.id;
  ids.turnos = (await pelaRaiz('POST', `/api/servicos/${servico.id}/turnos`, { letra: 'A', inicio: '08:00', fim: '16:00' })).turnos[0].id;
  ids.cotas = (await pelaRaiz('POST', `${u}/cotas`, { mes: somarMeses(atual, 1), servicoId: servico.id, quantidade: 2, origem: 'interna', prioridade: 1, contaMeta: true })).id;
  ids.escalas = (await pelaRaiz('POST', `${u}/escalas`, { nome: 'Alheia' })).id;
  ids.guarnicoes = (await pelaRaiz('POST', `${u}/guarnicoes`, { nome: 'Alheia', vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] } })).id;
  ids.funcoes = (await pelaRaiz('POST', `${u}/funcoes`, { nome: 'Alheia' })).id;
  ids.feriados = (await pelaRaiz('POST', `${u}/feriados`, { data: `${somarMeses(atual, 1)}-15`, descricao: 'Alheio', fixo: false })).id;
  const postos: Posto[] = await (await api.pedir('admin', 'GET', '/api/postos')).json();
  const equipe = await inserir(api.banco, 'equipe', { unidade_id: outra, nome: 'Alfa', ordem_ciclo: 1 });
  const militar = await pelaRaiz('POST', `${u}/militares`, {
    matricula: '990980-1', postoGradId: postos[0]!.id, nomeGuerra: 'ALHEIO', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
    lotacao: { equipeId: equipe, jornada: 'pronto', desde: atual },
  });
  ids.militares = militar.id;
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento where ativo limit 1')).rows[0]!.id;
  const afastamento = await pelaRaiz('POST', `/api/militares/${militar.id}/afastamentos`, { tipoAfastamentoId: tipo, inicio: `${atual}-03`, fim: `${atual}-05` });
  ids.afastamentos = afastamento.id;
});
afterAll(async () => {
  await api.fechar();
});

describe('isolamento entre unidades', () => {
  it('toda rota com :u ou :id da 2ª SB responde 403 ao escalante da 1ª SB', async () => {
    const rotas: string[] = [];
    for (const r of hono.routes) {
      if (r.method === 'ALL' || !r.path.startsWith('/api/')) continue;
      // os catálogos do sistema (/api/sistema) não são de uma unidade: têm regra própria (administrador na raiz)
      if (!(r.path.includes(':u') || r.path.includes(':id')) || r.path.startsWith('/api/sistema')) continue;
      const recurso = /^\/api\/([a-z]+)\/:id/.exec(r.path)?.[1];
      if (r.path.includes(':id') && !(recurso && ids[recurso])) throw new Error(`recurso sem registro de teste: ${r.path}`);
      const caminho = r.path
        .replace(':u', outra)
        .replace(':id', recurso ? ids[recurso]! : 'x')
        .replace(':mes', somarMeses(atual, 1))
        .replace(':cadastro', 'militares');
      rotas.push(`${r.method} ${caminho}`);
    }
    expect(new Set(rotas).size).toBeGreaterThan(30);
    const diferentes: string[] = [];
    for (const rota of new Set(rotas)) {
      const [metodo, caminho] = rota.split(' ') as [string, string];
      const r = await api.pedir('escalante', metodo, caminho, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      if (r.status !== 403) diferentes.push(`${rota} → ${r.status}`);
    }
    expect(diferentes).toEqual([]);
  });
});
