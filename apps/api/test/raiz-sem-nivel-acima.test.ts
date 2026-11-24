import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

// Entrega 6.31: a raiz (CBMPE) não tem unidade de cima. Quem tem nível de acesso na raiz (administrador, ou gestor da raiz) age sobre o Pecúlio de qualquer
// seção, e a mensagem "quem tem nível de acesso no nível acima" nunca aparece para a raiz. Dados fictícios (D7): matrículas 9910xx-x e nomes de guerra fictícios.
let api: ApiDeTeste;
let raiz: string;
const CAB = [
  'MATRÍCULA', 'POSTO/GRAD', 'NOME COMPLETO', 'NOME DE GUERRA', 'ANTIGUIDADE', 'SEXO', 'NASCIMENTO', 'TELEFONE', 'E-MAIL', 'COMPORTAMENTO', 'BOLETIM DO COMPORTAMENTO',
  'CPF', 'CEP', 'LOGRADOURO', 'NÚMERO', 'COMPLEMENTO', 'BAIRRO', 'CIDADE', 'UF', 'LOTAÇÃO', 'QUADRO', 'SITUAÇÃO', 'JORNADA', 'EQUIPE', 'MOTORISTA', 'CNH', 'VOLUNTÁRIO JES',
  'FUNÇÃO', 'ABONO DE PERMANÊNCIA',
];
type Linha = Record<string, string | number>;
const novo = (mat: string, guerra: string, lotacao = 'CBMPE'): Linha => ({ 'MATRÍCULA': mat, 'POSTO/GRAD': 'SD', 'NOME COMPLETO': `${guerra} de Tal`, 'NOME DE GUERRA': guerra, 'LOTAÇÃO': lotacao });
const comoLinha = (l: Linha) => CAB.map((c) => l[c] ?? '');
const caminho = (confirmar = false) => `/api/unidades/${raiz}/importacao/peculio${confirmar ? '?confirmar=1' : ''}`;
async function enviar(linhas: Linha[], quem: 'admin' | 'escalante' = 'admin', confirmar = false) {
  return api.pedir(quem, 'POST', caminho(confirmar), formulario(await planilha({ 'PECÚLIO': [CAB, ...linhas.map(comoLinha)] })));
}
const NIVEL_ACIMA = /nível de acesso no/;

beforeAll(async () => {
  api = await montarApi();
  raiz = api.ids.raiz;
});
afterAll(async () => {
  await api.fechar();
});

describe('o administrador na raiz importa o Pecúlio sem a mensagem do nível acima', () => {
  it('militares novos lotados na raiz (CBMPE): a prévia não traz nenhum problema de "nível de acesso" e a importação grava', async () => {
    const r = await enviar([novo('991001-1', 'NOVOA'), novo('991002-2', 'NOVOB')]);
    expect(r.status).toBe(200);
    const previa = await r.json();
    expect(previa.problemas.filter((p: { mensagem: string }) => NIVEL_ACIMA.test(p.mensagem))).toEqual([]);
    expect(previa.novos).toHaveLength(2);
    const confirmado = await enviar([novo('991001-1', 'NOVOA'), novo('991002-2', 'NOVOB')], 'admin', true);
    expect(confirmado.status).toBe(200);
    expect((await api.banco.query("select 1 from militar where matricula = '991001-1'")).rows).toHaveLength(1);
  });

  it('um militar que já está lotado na raiz (e muda de lotação pela planilha) também passa, sem a mensagem do nível acima', async () => {
    const id = await inserir(api.banco, 'militar', { matricula: '991003-3', posto_grad_id: (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id, nome_guerra: 'MUDADO', antiguidade: 1 });
    await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: raiz, jornada: 'adm', desde: '2026-01-01' });
    const r = await enviar([novo('991003-3', 'MUDADO', '2º GB')]);
    const previa = await r.json();
    expect(previa.problemas.filter((p: { mensagem: string }) => NIVEL_ACIMA.test(p.mensagem))).toEqual([]);
  });
});

describe('o gestor da raiz também importa, e a ficha segue a mesma regra', () => {
  it('um gestor da raiz (sem ser administrador) importa militares novos sem a mensagem do nível acima', async () => {
    await api.banco.query("update papel_usuario set papel = 'gestor', unidade_id = $2 where usuario_id = $1", [api.usuarios.escalante, raiz]);
    const r = await enviar([novo('991004-4', 'GESTRAIZ')], 'escalante');
    expect(r.status).toBe(200);
    const previa = await r.json();
    expect(previa.problemas.filter((p: { mensagem: string }) => NIVEL_ACIMA.test(p.mensagem))).toEqual([]);
    await api.banco.query("update papel_usuario set papel = 'escalante', unidade_id = $2 where usuario_id = $1", [api.usuarios.escalante, api.ids.secao]);
  });

  it('o administrador cadastra militar pela ficha na raiz (CBMPE)', async () => {
    const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const r = await api.pedir('admin', 'POST', `/api/unidades/${raiz}/militares`, {
      matricula: '991005-5', postoGradId: posto, nomeGuerra: 'FICHA', nomeCompleto: 'Ficha de Teste', antiguidade: 4001, motorista: false, cnh: [], voluntarioJes: false,
      lotacao: { equipeId: null, jornada: 'adm', desde: '2026-12-01' },
    });
    expect(r.status, await r.clone().text()).toBe(201);
  });

  it('o administrador muda a lotação de um militar lotado na raiz pela ficha (Alterar situação), sem a mensagem do nível acima', async () => {
    const id = (await api.banco.query<{ id: string }>("select id from militar where matricula = '991005-5'")).rows[0]!.id;
    const r = await api.pedir('admin', 'POST', `/api/militares/${id}/situacao`, { unidadeId: api.ids.secao, equipeId: null, jornada: 'adm', desde: '2027-01-01' });
    expect([200, 201], await r.clone().text()).toContain(r.status);
  });
});

describe('linhas sem MATRÍCULA: não viram problema, e são contadas à parte', () => {
  it('uma linha com dados mas sem matrícula não entra na prévia como problema; a prévia diz quantas foram ignoradas', async () => {
    const linhas = [novo('991006-6', 'OKAY'), ...Array.from({ length: 40 }, (_, i) => ({ ...novo('', `SEMMAT${i}`), 'MATRÍCULA': '' }))];
    const previa = await (await enviar(linhas)).json();
    expect(previa.problemas).toEqual([]);
    expect(previa.avisos).toContain('40 linhas sem MATRÍCULA foram ignoradas.');
  });
});
