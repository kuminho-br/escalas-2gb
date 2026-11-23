import type { FichaDeConsulta, ResultadoDaConsulta, UnidadeDaConsulta } from 'contratos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { inserir } from './banco-teste.ts';
import { divisoesDoGb, entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// Entrega 6.11, Task 6: a consulta de militares. Dados fictícios (D7): matrículas 990xxx-x e CPF com dígitos válidos.
let api: ApiDeTeste;
let da: string;
let divOp: string;
let sb1: string; // dentro da DivOp
let sb2: string; // dentro da DA
let sb3: string; // direto no 2º GB
let sb9: string; // de outro grupamento
const hoje = hojeRecife();
const dia1 = `${hoje.slice(0, 7)}-01`;
const alvo: Record<string, string> = {};
const quadro: Record<string, string> = {};
const pessoa = {} as Record<'oficial' | 'chefe' | 'auxiliarDoGb', Pessoa>;
const SO_IDENTIFICACAO = ['id', 'postoGrad', 'nomeGuerra', 'nomeCompleto', 'matricula', 'lotacao', 'quadro', 'podeAbrirFichaCompleta'];
const PROIBIDAS = ['cpf', 'nascimento', 'endereco'];

type Quem = 'admin' | 'gestorGb' | 'escalante' | 'semPapel' | Pessoa;
const pedir = (quem: Quem, caminho: string) => (typeof quem === 'string' ? api.pedir(quem, 'GET', caminho) : quem.pedir('GET', caminho));
const buscar = async (quem: Quem, consulta: string): Promise<ResultadoDaConsulta> => {
  const r = await pedir(quem, `/api/consulta/militares?${consulta}`);
  expect(r.status, consulta).toBe(200);
  return r.json();
};
const nomes = (r: ResultadoDaConsulta) => r.militares.map((m) => m.nomeGuerra);
const ficha = async (quem: Quem, militar: string): Promise<FichaDeConsulta> => {
  const r = await pedir(quem, `/api/consulta/militares/${alvo[militar]}`);
  expect(r.status).toBe(200);
  return r.json();
};
/** Todas as chaves de um JSON, em qualquer fundura. */
const chaves = (v: unknown, acc = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => chaves(x, acc));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.add(k); chaves(x, acc); }
  return acc;
};

/** Um militar fictício; `unidadeId` null deixa sem lotação. */
async function militar(chave: string, matricula: string, unidadeId: string | null, extra: Record<string, unknown> = {}, quadroSigla: string | null = 'QBMG', posto = 'SD BM') {
  const postoId = (await api.banco.query<{ id: string }>('select id from posto_grad where sigla = $1', [posto])).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula, posto_grad_id: postoId, nome_guerra: chave, ...extra });
  if (unidadeId) await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: unidadeId, jornada: 'pronto', desde: dia1, ...(quadroSigla ? { quadro_id: quadro[quadroSigla] } : {}) });
  alvo[chave] = id;
  return id;
}

beforeAll(async () => {
  api = await montarApi();
  ({ da, divOp } = await divisoesDoGb(api));
  for (const q of (await api.banco.query<{ id: string; sigla: string }>('select id, sigla from quadro')).rows) quadro[q.sigla] = q.id;
  sb1 = api.ids.secao;
  sb2 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '2ª SB'")).rows[0]!.id;
  sb3 = (await api.banco.query<{ id: string }>("select id from unidade where sigla = '3ª SB'")).rows[0]!.id;
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb1, divOp]);
  await api.banco.query('update unidade set mae_id = $2 where id = $1', [sb2, da]);
  const gb9 = await inserir(api.banco, 'unidade', { tipo: 'grupamento', sigla: '9º GB', nome: '9º Grupamento', mae_id: api.ids.raiz, desde: '2026-11-01' });
  sb9 = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '9ª SB', nome: '9ª Seção', mae_id: gb9, desde: '2026-11-01' });

  // o militar de que mais se consulta: todos os dados preenchidos, na 2ª SB (dentro da DA)
  await militar('ANDRADE', '990821-1', sb2, {
    nome_completo: 'João da Silva Andrade', telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br', sexo: 'M',
    cpf: '52998224725', nascimento_dia: 15, nascimento_mes: 3, nascimento_ano: 1985,
    cep: '50000000', logradouro: 'Rua Fictícia', numero: '10', bairro: 'Centro', cidade: 'Recife', uf: 'PE',
    comportamento: 'Bom', comportamento_boletim: 'BG 12/2026', motorista: true, cnh: ['D'], voluntario_jes: true,
  });
  const tipo = (await api.banco.query<{ id: string }>("select id from tipo_afastamento where nome = 'LTS'")).rows[0]!.id;
  await inserir(api.banco, 'afastamento', { militar_id: alvo.ANDRADE, tipo_afastamento_id: tipo, inicio: somarDias(hoje, 10), fim: somarDias(hoje, 20), motivo: 'Tratamento de saúde', boletim: 'BG 99/2026' });
  await militar('JOAO', '990822-2', sb1, { nome_completo: 'José Antônio Çavalcante Ñandú' });
  await militar('SEMLOTACAO', '990823-3', null, { nome_completo: 'Pessoa Sem Lotação Hoje', cpf: '39053344705' });
  await militar('OUTROGB', '990829-9', sb9, { nome_completo: 'Fulano do Outro Grupamento' });
  await militar('PERCENTUAL', '990828-8', sb3, { nome_completo: 'Fulano 100% Fictício' });
  // um lote de 51 militares na 3ª SB, para o limite de 50 linhas
  for (let i = 1; i <= 51; i++) await militar(`LOTE${String(i).padStart(2, '0')}`, `99084${Math.floor(i / 10)}-${i % 10}`, sb3);

  pessoa.oficial = await entrarComo(api, { matricula: '990831-1', nome: 'COFICIAL', posto: 'CAP BM' });
  await inserir(api.banco, 'rastreio', { militar_id: pessoa.oficial.militarId, unidade_id: sb3, jornada: 'adm', desde: dia1, quadro_id: quadro.QOC });
  pessoa.chefe = await entrarComo(api, { matricula: '990832-2', nome: 'CCHEFE', nivel: { papel: 'chefe_divisao', unidadeId: divOp } });
  pessoa.auxiliarDoGb = await entrarComo(api, { matricula: '990833-3', nome: 'CAUXGB', nivel: { papel: 'escalante', unidadeId: api.ids.gb } });
});
afterAll(async () => {
  await api.fechar();
});

describe('a busca', () => {
  it('sem texto de 3 letras e sem unidade é 400 com o texto fixo', async () => {
    for (const consulta of ['', 'texto=', 'texto=ab', 'texto=%20%20a%20%20', 'unidadeId=']) {
      const r = await pedir('semPapel', `/api/consulta/militares?${consulta}`);
      expect(r.status, consulta).toBe(400);
      expect((await r.json()).erro).toBe('Digite pelo menos 3 letras ou escolha uma unidade.');
    }
  });

  it('acha por nome de guerra, nome completo e matrícula, sem diferenciar maiúsculas nem acentos', async () => {
    expect(nomes(await buscar('semPapel', 'texto=andrade'))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', 'texto=Silva%20Andrade'))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', 'texto=990821'))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', 'texto=990821-1'))).toEqual(['ANDRADE']);
    // acentos dos dois lados: o texto sem acento acha o nome com acento e vice-versa
    expect(nomes(await buscar('semPapel', 'texto=jose%20antonio%20cavalcante%20nandu'))).toEqual(['JOAO']);
    expect(nomes(await buscar('semPapel', `texto=${encodeURIComponent('JOSÉ ANTÔNIO')}`))).toEqual(['JOAO']);
    expect(nomes(await buscar('semPapel', `texto=${encodeURIComponent('joão da silva')}`))).toEqual(['ANDRADE']);
    // todas as palavras precisam aparecer, em qualquer ordem
    expect(nomes(await buscar('semPapel', 'texto=andrade%20joao'))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', 'texto=andrade%20antonio'))).toEqual([]);
  });

  it('a linha traz só a identificação: posto, nomes, matrícula, lotação e quadro', async () => {
    const r = await buscar('semPapel', 'texto=andrade');
    expect(r).toEqual({
      militares: [{ id: alvo.ANDRADE, postoGrad: 'SD BM', nomeGuerra: 'ANDRADE', nomeCompleto: 'João da Silva Andrade', matricula: '990821-1', lotacao: '2ª SB', quadro: 'QBMG' }],
      haMais: false,
    });
  });

  it('com a unidade, traz ela e as de baixo; a divisão traz as seções de dentro', async () => {
    expect(nomes(await buscar('semPapel', `unidadeId=${sb2}`))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', `unidadeId=${da}`))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', `unidadeId=${divOp}`))).toEqual(['JOAO']);
    expect(nomes(await buscar('semPapel', `unidadeId=${api.ids.gb}&texto=a%20silva`))).toEqual(['ANDRADE']);
    expect(nomes(await buscar('semPapel', `unidadeId=${sb9}`))).toEqual(['OUTROGB']);
    // texto e unidade juntos: os dois filtros valem
    expect(nomes(await buscar('semPapel', `unidadeId=${sb1}&texto=andrade`))).toEqual([]);
    // quem está sem lotação hoje só aparece na busca por texto, nunca pela unidade
    expect(nomes(await buscar('semPapel', `unidadeId=${api.ids.raiz}&texto=Sem%20Lota`))).toEqual([]);
  });

  it('a busca alcança a corporação inteira, de qualquer unidade, para quem não tem nível de acesso nenhum', async () => {
    expect(nomes(await buscar('semPapel', 'texto=outro%20grupamento'))).toEqual(['OUTROGB']);
    expect(nomes(await buscar('escalante', 'texto=outro%20grupamento'))).toEqual(['OUTROGB']);
  });

  it('unidade que não existe é 404', async () => {
    expect((await pedir('semPapel', '/api/consulta/militares?unidadeId=00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await pedir('semPapel', '/api/consulta/militares?unidadeId=x')).status).toBe(404);
  });

  it('51 resultados: vêm 50 e "haMais"; com 50 ou menos, não', async () => {
    const todos = await buscar('semPapel', `unidadeId=${sb3}&texto=lote`);
    expect(todos.militares).toHaveLength(50);
    expect(todos.haMais).toBe(true);
    expect(nomes(todos)[0]).toBe('LOTE01');
    const refinada = await buscar('semPapel', `unidadeId=${sb3}&texto=lote5`);
    expect(nomes(refinada)).toEqual(['LOTE50', 'LOTE51']);
    expect(refinada.haMais).toBe(false);
    // exatamente 50: sem aviso (o 51º sai da 3ª SB por um instante)
    await api.banco.query('update rastreio set unidade_id = $2 where militar_id = $1', [alvo.LOTE51, sb2]);
    try {
      const cinquenta = await buscar('semPapel', `unidadeId=${sb3}&texto=lote`);
      expect(cinquenta.militares).toHaveLength(50);
      expect(cinquenta.haMais).toBe(false);
    } finally {
      await api.banco.query('update rastreio set unidade_id = $2 where militar_id = $1', [alvo.LOTE51, sb3]);
    }
  });

  it('"%", "_" e "\\" valem como letras: a busca não devolve a corporação inteira (Review Focus 5)', async () => {
    for (const texto of ['%%%', '___', '\\\\\\', '%a%', 'a_b']) {
      const r = await buscar('semPapel', `texto=${encodeURIComponent(texto)}`);
      expect(nomes(r), texto).toEqual([]);
    }
    // o "%" que está no nome vale como letra
    expect(nomes(await buscar('semPapel', `texto=${encodeURIComponent('100%')}`))).toEqual(['PERCENTUAL']);
  });

  it('o militar sem lotação aparece na busca por texto, só com a identificação (Review Focus 3)', async () => {
    const r = await buscar('semPapel', 'texto=sem%20lotacao');
    expect(r.militares).toEqual([{ id: alvo.SEMLOTACAO, postoGrad: 'SD BM', nomeGuerra: 'SEMLOTACAO', nomeCompleto: 'Pessoa Sem Lotação Hoje', matricula: '990823-3', lotacao: null, quadro: null }]);
  });

  it('a unidade de escolha: a árvore da corporação inteira, na ordem da árvore, para qualquer pessoa com conta', async () => {
    const r = await pedir('semPapel', '/api/consulta/unidades');
    expect(r.status).toBe(200);
    const unidades: UnidadeDaConsulta[] = await r.json();
    expect(unidades[0]).toMatchObject({ sigla: 'CBMPE', nivel: 0 });
    const siglas = unidades.map((u) => u.sigla);
    expect(siglas).toContain('9ª SB');
    // o pai antes dos filhos: a DivOp vem antes da 1ª SB, que está dentro dela, e a seção sem divisão vem entre as irmãs, pela sigla
    expect(siglas.indexOf('DivOp')).toBeLessThan(siglas.indexOf('1ª SB'));
    expect(unidades.find((u) => u.sigla === '1ª SB')!.nivel).toBe(unidades.find((u) => u.sigla === 'DivOp')!.nivel + 1);
    expect(unidades.find((u) => u.sigla === '3ª SB')!.nivel).toBe(unidades.find((u) => u.sigla === '2º GB')!.nivel + 1);
    expect(Object.keys(unidades[0]!).sort()).toEqual(['id', 'nivel', 'sigla']);
    // as unidades extintas não entram
    const extinta = await inserir(api.banco, 'unidade', { tipo: 'secao', sigla: '8ª SB', nome: '8ª Seção', mae_id: api.ids.gb, desde: '2020-01-01', ate: '2020-12-31' });
    expect(((await (await pedir('semPapel', '/api/consulta/unidades')).json()) as UnidadeDaConsulta[]).map((u) => u.id)).not.toContain(extinta);
  });
});

describe('a ficha de consulta', () => {
  it('o militar comum recebe só a identificação: as chaves dos outros blocos ficam ausentes (não vêm null)', async () => {
    const f = await ficha('semPapel', 'ANDRADE');
    expect(Object.keys(f).sort()).toEqual([...SO_IDENTIFICACAO].sort());
    expect(f).toMatchObject({ nomeGuerra: 'ANDRADE', matricula: '990821-1', lotacao: '2ª SB', quadro: 'QBMG', podeAbrirFichaCompleta: false });
    for (const bloco of ['contato', 'situacao', 'afastamentos', 'dadosDaEscala', 'comportamento']) expect(bloco in f, bloco).toBe(false);
  });

  it('o oficial recebe contato, situação, afastamentos e dados da escala; os afastamentos vêm sem motivo e sem boletim', async () => {
    const f = await ficha(pessoa.oficial, 'ANDRADE');
    expect(f.contato).toEqual({ telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br' });
    expect(f.situacao).toMatchObject({ equipe: null, jornada: 'pronto', situacaoDoMilitar: expect.any(String) });
    expect(f.situacao!.historico).toEqual([{ desde: dia1, ate: null, lotacao: '2ª SB', equipe: null, jornada: 'pronto', quadro: 'QBMG', situacaoDoMilitar: f.situacao!.situacaoDoMilitar }]);
    expect(f.afastamentos).toEqual([{ tipo: 'LTS', inicio: somarDias(hoje, 10), fim: somarDias(hoje, 20) }]);
    expect(Object.keys(f.afastamentos![0]!).sort()).toEqual(['fim', 'inicio', 'tipo']);
    expect(f.dadosDaEscala).toEqual({ motorista: true, cnh: ['D'], voluntarioJes: true });
    expect('comportamento' in f).toBe(false);
    expect(f.podeAbrirFichaCompleta).toBe(false);
  });

  it('o chefe de divisão recebe também o comportamento e o motivo e o boletim dos afastamentos, nas seções das divisões irmãs', async () => {
    const f = await ficha(pessoa.chefe, 'ANDRADE');
    expect(f.comportamento).toEqual({ comportamento: 'Bom', boletim: 'BG 12/2026' });
    expect(f.afastamentos).toEqual([{ tipo: 'LTS', inicio: somarDias(hoje, 10), fim: somarDias(hoje, 20), motivo: 'Tratamento de saúde', boletim: 'BG 99/2026' }]);
    // o chefe não tem a camada fora das divisões irmãs: de um militar de outro grupamento, só a identificação
    expect(Object.keys(await ficha(pessoa.chefe, 'OUTROGB')).sort()).toEqual([...SO_IDENTIFICACAO].sort());
    // sem a camada do chefe, o motivo e o boletim não saem nem para o oficial
    expect(JSON.stringify(await ficha(pessoa.oficial, 'ANDRADE'))).not.toMatch(/Tratamento|BG 99/);
  });

  it('o auxiliar do 2º GB, que tem nível de acesso na lotação, vê os sete blocos e pode abrir a ficha completa', async () => {
    const f = await ficha(pessoa.auxiliarDoGb, 'ANDRADE');
    for (const bloco of ['contato', 'situacao', 'afastamentos', 'dadosDaEscala', 'comportamento']) expect(bloco in f, bloco).toBe(true);
    expect(f.afastamentos![0]).toMatchObject({ motivo: 'Tratamento de saúde', boletim: 'BG 99/2026' });
    expect(f.podeAbrirFichaCompleta).toBe(true);
  });

  it('"podeAbrirFichaCompleta" é verdadeiro só para quem tem nível de acesso na lotação do militar (ou acima)', async () => {
    expect((await ficha('admin', 'ANDRADE')).podeAbrirFichaCompleta).toBe(true);
    expect((await ficha('gestorGb', 'ANDRADE')).podeAbrirFichaCompleta).toBe(true);
    // o auxiliar da 1ª SB: é da 1ª SB, não da 2ª
    expect((await ficha('escalante', 'ANDRADE')).podeAbrirFichaCompleta).toBe(false);
    expect((await ficha('escalante', 'JOAO')).podeAbrirFichaCompleta).toBe(true);
    // o chefe da DivOp edita na própria divisão, não na irmã (ele só a vê)
    expect((await ficha(pessoa.chefe, 'JOAO')).podeAbrirFichaCompleta).toBe(true);
    expect((await ficha(pessoa.chefe, 'ANDRADE')).podeAbrirFichaCompleta).toBe(false);
    expect((await ficha(pessoa.oficial, 'ANDRADE')).podeAbrirFichaCompleta).toBe(false);
  });

  it('o militar sem lotação hoje abre a ficha só com a identificação, para qualquer pessoa, até o administrador (Review Focus 3)', async () => {
    for (const quem of ['semPapel', 'admin', 'gestorGb', pessoa.oficial, pessoa.chefe] as Quem[]) {
      const f = await ficha(quem, 'SEMLOTACAO');
      expect(Object.keys(f).sort()).toEqual([...SO_IDENTIFICACAO].sort());
      expect(f).toMatchObject({ lotacao: null, quadro: null, podeAbrirFichaCompleta: false });
    }
  });

  it('militar que não existe é 404', async () => {
    expect((await pedir('semPapel', '/api/consulta/militares/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await pedir('semPapel', '/api/consulta/militares/x')).status).toBe(404);
  });

  it('nenhuma resposta de /api/consulta traz cpf, nascimento ou endereço, nem para o administrador', async () => {
    const respostas: unknown[] = [];
    for (const quem of ['semPapel', 'admin', 'gestorGb', 'escalante', pessoa.oficial, pessoa.chefe, pessoa.auxiliarDoGb] as Quem[]) {
      respostas.push(await buscar(quem, 'texto=andrade'), await ficha(quem, 'ANDRADE'), await ficha(quem, 'SEMLOTACAO'), await (await pedir(quem, '/api/consulta/unidades')).json());
    }
    const texto = JSON.stringify(respostas);
    for (const proibida of PROIBIDAS) expect(chaves(respostas).has(proibida), proibida).toBe(false);
    // nem os valores: o CPF e a rua do endereço de teste
    expect(texto).not.toMatch(/52998224725|529\.982|Rua Fictícia|50000000/);
  });

  it('a borda ajustada vale na hora: ligar "contato" para todos o dá ao militar comum; desligar tira', async () => {
    await api.pedir('admin', 'PUT', '/api/visao', (await (await api.pedir('admin', 'GET', '/api/visao')).json()).map((l: { bloco: string }) => (l.bloco === 'contato' ? { ...l, todos: true } : l)));
    expect((await ficha('semPapel', 'ANDRADE')).contato).toEqual({ telefone: '(81) 99999-0001', email: 'andrade@bombeiros.pe.gov.br' });
    await api.pedir('admin', 'PUT', '/api/visao', (await (await api.pedir('admin', 'GET', '/api/visao')).json()).map((l: { bloco: string }) => (l.bloco === 'contato' ? { ...l, todos: false } : l)));
    expect('contato' in (await ficha('semPapel', 'ANDRADE'))).toBe(false);
  });
});
