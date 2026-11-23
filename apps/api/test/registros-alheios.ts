import type { Hono } from 'hono';
import { somarMeses, type Posto } from 'contratos';
import { expect } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import type { ApiDeTeste } from './apoio-api.ts';

// Os registros "alheios" e a varredura de rotas do teste de isolamento: um de cada tipo na unidade `outra`, criados pelo administrador (papel na raiz),
// e a lista de todas as rotas com :u ou :id, já com os ids trocados. Servem ao isolamento (o escalante de outra seção) e às escalas só para leitura
// (o chefe de uma divisão irmã). Dados fictícios (D7).
const atual = hojeRecife().slice(0, 7);

async function pelaRaiz(api: ApiDeTeste, metodo: string, caminho: string, corpo: unknown): Promise<any> {
  const r = await api.pedir('admin', metodo, caminho, corpo);
  expect([200, 201]).toContain(r.status);
  return r.json();
}

/** Um registro de cada tipo na unidade `outra`; devolve o id de cada um, pelo nome do recurso no endereço (`servicos`, `militares`…). */
export async function criarRegistrosAlheios(api: ApiDeTeste, outra: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  const u = `/api/unidades/${outra}`;
  const servico = await pelaRaiz(api, 'POST', `${u}/servicos`, { nome: 'Alheio', tipo: 'diaria', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' });
  ids.servicos = servico.id;
  ids.turnos = (await pelaRaiz(api, 'POST', `/api/servicos/${servico.id}/turnos`, { letra: 'A', inicio: '08:00', fim: '16:00' })).turnos[0].id;
  ids.cotas = (await pelaRaiz(api, 'POST', `${u}/cotas`, { mes: somarMeses(atual, 1), servicoId: servico.id, quantidade: 2, origem: 'interna', prioridade: 1 })).id;
  ids.escalas = (await pelaRaiz(api, 'POST', `${u}/escalas`, { nome: 'Alheia' })).id;
  ids.guarnicoes = (await pelaRaiz(api, 'POST', `${u}/guarnicoes`, { nome: 'Alheia', vigencia: atual, versao: { viatura: null, tipoViatura: null, prioridade: null, ativa: true, composicao: [] } })).id;
  ids.funcoes = (await pelaRaiz(api, 'POST', `${u}/funcoes`, { nome: 'Alheia' })).id;
  ids.feriados = (await pelaRaiz(api, 'POST', `${u}/feriados`, { data: `${somarMeses(atual, 1)}-15`, descricao: 'Alheio', fixo: false })).id;
  const postos: Posto[] = await (await api.pedir('admin', 'GET', '/api/postos')).json();
  const equipe = await inserir(api.banco, 'equipe', { unidade_id: outra, nome: 'Alfa', ordem_ciclo: 1 });
  const militar = await pelaRaiz(api, 'POST', `${u}/militares`, {
    matricula: '990980-1', postoGradId: postos[0]!.id, nomeCompleto: 'Fulano de Tal Alheio', nomeGuerra: 'ALHEIO', antiguidade: 1, motorista: false, cnh: [], voluntarioJes: false,
    lotacao: { equipeId: equipe, jornada: 'pronto', desde: `${atual}-01` },
  });
  ids.militares = militar.id;
  const tipo = (await api.banco.query<{ id: string }>('select id from tipo_afastamento where ativo limit 1')).rows[0]!.id;
  const afastamento = await pelaRaiz(api, 'POST', `/api/militares/${militar.id}/afastamentos`, { tipoAfastamentoId: tipo, inicio: `${atual}-03`, fim: `${atual}-05` });
  ids.afastamentos = afastamento.id;
  // alocação e remoção da escala da unidade (Fase 4)
  await inserir(api.banco, 'escala_servico', { escala_id: ids.escalas, servico_id: ids.servicos, ordem: 1 }, 'escala_id');
  const chave = { militar_id: militar.id, escala_id: ids.escalas, servico_id: ids.servicos, turno_id: ids.turnos };
  ids.alocacoes = await inserir(api.banco, 'alocacao', { ...chave, data: `${atual}-05`, origem: 'manual' });
  ids.remocoes = await inserir(api.banco, 'remocao', { ...chave, data: `${atual}-06` });
  // papel dado na unidade (fase 6)
  ids.papeis = await inserir(api.banco, 'papel_usuario', { usuario_id: api.usuarios.semPapel, unidade_id: outra, papel: 'escalante', desde: '2026-11-01' });
  // a estrutura do grupamento (6.10): a seção e uma divisão do 2º GB
  ids.secoes = outra;
  ids.divisoes = (await api.banco.query<{ id: string }>("select id from unidade where sigla = 'DA' and mae_id = $1", [api.ids.gb])).rows[0]!.id;
  // acúmulo da alocação alheia (Fase 4.1.1)
  ids.acumulos = await inserir(api.banco, 'alocacao_acumulo', { alocacao_id: ids.alocacoes, guarnicao_id: ids.guarnicoes, funcao_id: ids.funcoes });
  return ids;
}

export type RotaDaVarredura = { metodo: string; modelo: string; caminho: string };

/**
 * Toda rota com :u ou :id, com os ids dos registros alheios no lugar. Ficam de fora os catálogos do sistema (/api/sistema, as situações do militar, os
 * postos e os quadros: não são de uma unidade e têm regra própria, a do administrador na raiz), a consulta (/api/consulta: aberta a toda pessoa com conta,
 * só lê e só traz a Identificação e os blocos que a borda das camadas libera; testes em consulta.test.ts) e a borda (/api/visao: do administrador).
 */
export function rotasDaVarredura(hono: Hono, ids: Record<string, string>, outra: string): RotaDaVarredura[] {
  const rotas: RotaDaVarredura[] = [];
  const mes = somarMeses(atual, 1);
  for (const r of hono.routes) {
    if (r.method === 'ALL' || !r.path.startsWith('/api/')) continue;
    if (!(r.path.includes(':u') || r.path.includes(':id'))) continue;
    if (['/api/sistema', '/api/situacoes-do-militar', '/api/funcoes-do-militar', '/api/postos', '/api/quadros', '/api/consulta'].some((p) => r.path.startsWith(p))) continue;
    const recurso = /^\/api\/([a-z]+)\/:id/.exec(r.path)?.[1];
    if (r.path.includes(':id') && !(recurso && ids[recurso])) throw new Error(`recurso sem registro de teste: ${r.path}`);
    const caminho = r.path.replace(':u', outra).replace(':id', recurso ? ids[recurso]! : 'x').replace(':mes', mes).replace(':cadastro', 'feriados');
    rotas.push({ metodo: r.method, modelo: r.path, caminho });
  }
  return rotas;
}
