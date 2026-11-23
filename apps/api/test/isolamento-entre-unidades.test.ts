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
  ids.cotas = (await pelaRaiz('POST', `${u}/cotas`, { mes: somarMeses(atual, 1), servicoId: servico.id, quantidade: 2, origem: 'interna', prioridade: 1 })).id;
  ids.escalas = (await pelaRaiz('POST', `${u}/escalas`, { nome: 'Alheia' })).id;
  ids.guarnicoes = (await pelaRaiz('POST', `${u}/guarnicoes`, { nome: 'Alheia', vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] } })).id;
  ids.funcoes = (await pelaRaiz('POST', `${u}/funcoes`, { nome: 'Alheia' })).id;
  ids.feriados = (await pelaRaiz('POST', `${u}/feriados`, { data: `${somarMeses(atual, 1)}-15`, descricao: 'Alheio', fixo: false })).id;
  const postos: Posto[] = await (await api.pedir('admin', 'GET', '/api/postos')).json();
  const equipe = await inserir(api.banco, 'equipe', { unidade_id: outra, nome: 'Alfa', ordem_ciclo: 1 });
  const militar = await pelaRaiz('POST', `${u}/militares`, {
    matricula: '990980-1', postoGradId: postos[0]!.id, nomeCompleto: 'Fulano de Tal Alheio', nomeGuerra: 'ALHEIO', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
    lotacao: { equipeId: equipe, jornada: 'pronto', desde: `${atual}-01` },
  });
  ids.militares = militar.id;
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento where ativo limit 1')).rows[0]!.id;
  const afastamento = await pelaRaiz('POST', `/api/militares/${militar.id}/afastamentos`, { tipoAfastamentoId: tipo, inicio: `${atual}-03`, fim: `${atual}-05` });
  ids.afastamentos = afastamento.id;
  // alocação e remoção da escala da 2ª SB (Fase 4)
  await inserir(api.banco, 'escala_servico', { escala_id: ids.escalas, servico_id: ids.servicos, ordem: 1 }, 'escala_id');
  const chave = { militar_id: militar.id, escala_id: ids.escalas, servico_id: ids.servicos, turno_id: ids.turnos };
  ids.alocacoes = await inserir(api.banco, 'alocacao', { ...chave, data: `${atual}-05`, origem: 'manual' });
  ids.remocoes = await inserir(api.banco, 'remocao', { ...chave, data: `${atual}-06` });
  // papel dado na 2ª SB (fase 6)
  ids.papeis = await inserir(api.banco, 'papel_usuario', { usuario_id: api.usuarios.semPapel, unidade_id: outra, papel: 'escalante', desde: '2026-11-01' });
  // a estrutura do grupamento (6.10): a 2ª SB e uma divisão do 2º GB, em que o escalante da 1ª SB não manda
  ids.secoes = outra;
  ids.divisoes = (await api.banco.query<{ id: string }>("select id from unidade where sigla = 'DA' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  // acúmulo da alocação alheia (Fase 4.1.1)
  ids.acumulos = await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: ids.alocacoes, guarnicao_id: ids.guarnicoes, funcao_id: ids.funcoes });
});
afterAll(async () => {
  await api.fechar();
});

describe('isolamento entre unidades', () => {
  it('toda rota com :u ou :id da 2ª SB responde 403 ao escalante da 1ª SB', async () => {
    const rotas: string[] = [];
    for (const r of hono.routes) {
      if (r.method === 'ALL' || !r.path.startsWith('/api/')) continue;
      // os catálogos do sistema (/api/sistema, as situações do militar, os postos e os quadros) não são de uma unidade: têm regra própria (administrador na raiz).
      // A consulta (/api/consulta) é aberta a toda pessoa com conta, só lê e só traz a Identificação e os blocos que a borda das camadas libera (testes em
      // consulta.test.ts); a borda (/api/visao) é do administrador. Nenhuma das duas grava dado de uma unidade.
      if (!(r.path.includes(':u') || r.path.includes(':id')) || r.path.startsWith('/api/sistema') || r.path.startsWith('/api/situacoes-do-militar') || r.path.startsWith('/api/funcoes-do-militar') || r.path.startsWith('/api/postos') || r.path.startsWith('/api/quadros') || r.path.startsWith('/api/consulta')) continue;
      const recurso = /^\/api\/([a-z]+)\/:id/.exec(r.path)?.[1];
      if (r.path.includes(':id') && !(recurso && ids[recurso])) throw new Error(`recurso sem registro de teste: ${r.path}`);
      const caminho = r.path
        .replace(':u', outra)
        .replace(':id', recurso ? ids[recurso]! : 'x')
        .replace(':mes', somarMeses(atual, 1))
        .replace(':cadastro', 'feriados');
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
