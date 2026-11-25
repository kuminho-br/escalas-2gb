import { somarMeses, type EscalaDoMes } from 'contratos';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { lerRegistro } from '../src/registro.ts';
import { inserir } from './banco-teste.ts';
import { entrarComo, montarApi, type ApiDeTeste, type Pessoa } from './apoio-api.ts';

// O relógio da trava do passado é fixo: as 12:00 do dia 15 do mês do cenário (o turno A começa às 08:00 e já começou; o B, às 20:00, não).
const relogio = vi.hoisted(() => ({ agora: { dia: '2000-01-01', minutos: 0 } }));
vi.mock('../src/datas.ts', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/datas.ts')>()), agoraRecife: () => relogio.agora }));

// Cenário fictício (D7): seção com Pronto A (08h–20h) e B (20h–08h), a guarnição ABT (Motorista CNH D 1–1, Combatente 1–2) e a AR (Chefe 1–1) nas duas faixas,
// a equipe Alfa e um Expediente (08h–16h). O mês é o seguinte ao atual, para todo dia ser futuro do ponto de vista do resto do sistema.
let api: ApiDeTeste;
let escala: string;
let pronto: string;
let turnoA: string;
let turnoB: string;
let abt: string;
let ar: string;
let motorista: string;
let combatente: string;
let chefe: string;
let expediente: { servicoId: string; turnoId: string };
let coordenador: Pessoa;
let equipe: string;
let posto: string;
const militar: Record<string, string> = {};
const atual = hojeRecife().slice(0, 7);
const mes = somarMeses(atual, 1);
const dia = (n: number) => `${mes}-${String(n).padStart(2, '0')}`;
const secao = () => `/api/unidades/${api.ids.secao}`;
const A = { inicio: '08:00', fim: '20:00' };
const B = { inicio: '20:00', fim: '08:00' };
const MSG_SO_GESTOR = 'Este turno já começou. Só o gestor altera o passado.';
const MSG_MOTIVO = 'Diga o motivo da alteração (pelo menos 10 letras).';
const MOTIVO = 'Trocou por motivo de saúde';
type Quem = 'admin' | 'escalante' | 'gestorGb';

const agora = (d: number, hora: number, minuto = 0) => {
  relogio.agora = { dia: dia(d), minutos: hora * 60 + minuto };
};

let seq = 0;
async function criarMilitar(nome: string, cnh: string[] = []) {
  seq++;
  militar[nome] = await inserir(api.banco, 'militar', {
    matricula: `99${String(8000 + seq).padStart(4, '0')}-${seq % 10}`, posto_grad_id: posto, nome_guerra: nome, motorista: cnh.length > 0, cnh, voluntario_jes: false,
  });
  await inserir(api.banco, 'rastreio', { militar_id: militar[nome], unidade_id: api.ids.secao, equipe_id: equipe, jornada: 'pronto', desde: `${atual}-01` });
}

const escalar = (quem: Quem | Pessoa, nome: string, d: number, o: { turno?: string; guarnicao?: string | null; funcao?: string | null; justificativa?: string } = {}) => {
  const corpo = {
    militarId: militar[nome], data: dia(d), turnoId: o.turno ?? turnoA, guarnicaoId: o.guarnicao === undefined ? abt : o.guarnicao, funcaoId: o.funcao === undefined ? combatente : o.funcao,
    ...(o.justificativa ? { justificativa: o.justificativa } : {}),
  };
  return typeof quem === 'string' ? api.pedir(quem, 'POST', `/api/escalas/${escala}/alocacoes`, corpo) : quem.pedir('POST', `/api/escalas/${escala}/alocacoes`, corpo);
};
const alocacaoDe = async (nome: string, d: number, turno = turnoA) =>
  (await api.banco.query<{ id: string }>('select id from alocacao where militar_id = $1 and data = $2::date and turno_id = $3', [militar[nome], dia(d), turno])).rows[0]!.id;
const quantas = async () => Number((await api.banco.query<{ n: number }>('select count(*)::int as n from alocacao')).rows[0]!.n);
const registros = () => lerRegistro(api.banco, { escalaId: escala, mes, tipo: 'escala_no_passado' });
const textos = async () => (await registros()).map((r) => r.texto);
const sozinho = async (acao: () => Promise<Response>) => {
  const antes = (await registros()).length;
  const r = await acao();
  return { r, novos: (await registros()).slice(0, (await registros()).length - antes) };
};

beforeAll(async () => {
  api = await montarApi();
  posto = await inserir(api.banco, 'posto_grad', { sigla: 'SD-PS', nome: 'Soldado PS', ordem: 941 });
  equipe = await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
  motorista = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Motorista' });
  combatente = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Combatente' });
  chefe = await inserir(api.banco, 'funcao', { unidade_id: api.ids.secao, nome: 'Chefe' });
  const servico = async (nome: string, inicio: string, fim: string) => {
    const s = (await (await api.pedir('escalante', 'POST', `${secao()}/servicos`, { nome, tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B' })).json()) as { id: string };
    const turnos = (await (await api.pedir('escalante', 'POST', `/api/servicos/${s.id}/turnos`, { letra: 'A', inicio, fim })).json()).turnos as { id: string; letra: string }[];
    return { id: s.id, turnoA: turnos.find((t) => t.letra === 'A')!.id };
  };
  const p = await servico('Pronto', A.inicio, A.fim);
  pronto = p.id;
  turnoA = p.turnoA;
  turnoB = (await (await api.pedir('escalante', 'POST', `/api/servicos/${pronto}/turnos`, { letra: 'B', ...B })).json()).turnos.find((t: { letra: string }) => t.letra === 'B').id;
  const e = await servico('Expediente', '08:00', '16:00');
  expediente = { servicoId: e.id, turnoId: e.turnoA };
  const guarnicao = async (nome: string, prioridade: number, composicao: unknown[]) =>
    (await (await api.pedir('escalante', 'POST', `${secao()}/guarnicoes`, { nome, vigencia: mes, versao: { viatura: null, tipoViatura: null, prioridade, ativa: true, composicao } })).json()).id as string;
  abt = await guarnicao('ABT', 1, [{ funcaoId: motorista, minimo: 1, maximo: 1, cnhExigida: 'D' }, { funcaoId: combatente, minimo: 1, maximo: 2, cnhExigida: null }]);
  ar = await guarnicao('AR', 2, [{ funcaoId: chefe, minimo: 1, maximo: 1, cnhExigida: null }]);
  escala = (await (await api.pedir('escalante', 'POST', `${secao()}/escalas`, { nome: 'Ordinário' })).json()).id;
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/servicos`, { servicoIds: [pronto] })).status).toBe(200);
  const vinculos = [{ guarnicaoId: abt, ...A }, { guarnicaoId: abt, ...B }, { guarnicaoId: ar, ...A }, { guarnicaoId: ar, ...B }];
  expect((await api.pedir('escalante', 'PUT', `/api/escalas/${escala}/vinculos/${mes}`, { itens: vinculos })).status).toBe(200);
  for (let n = 1; n <= 20; n++) await criarMilitar(`M${n}`);
  await criarMilitar('MOT', ['D']);
  coordenador = await entrarComo(api, { matricula: '990971-1', nome: 'COORDENADOR', nivel: { papel: 'gestor_lateral', unidadeId: api.ids.secao } });
  agora(15, 12);
});
afterAll(async () => {
  await api.fechar();
});

describe('sem prévia lançada, nada muda', () => {
  it('o escalante escala, remove e desfaz no passado como sempre', async () => {
    expect((await escalar('escalante', 'M1', 9)).status).toBe(201);
    const r = await api.pedir('escalante', 'DELETE', `/api/alocacoes/${await alocacaoDe('M1', 9)}`);
    expect(r.status).toBe(200);
    expect((await api.pedir('escalante', 'POST', `/api/remocoes/${((await r.json()) as { remocaoId: string }).remocaoId}/desfazer`)).status).toBe(200);
    expect(await registros()).toEqual([]);
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${await alocacaoDe('M1', 9)}`)).status).toBe(200);
  });
});

describe('com a prévia lançada', () => {
  // o que existe antes de lançar a prévia, todo em dias que já passaram (agora são 12:00 do dia 15)
  const id: Record<string, string> = {};
  beforeAll(async () => {
    expect((await escalar('escalante', 'M2', 10)).status).toBe(201); // ABT Combatente, vaga 1
    expect((await escalar('escalante', 'M3', 10)).status).toBe(201); // ABT Combatente, vaga 2
    expect((await escalar('escalante', 'MOT', 10, { funcao: motorista })).status).toBe(201);
    expect((await escalar('escalante', 'M4', 11, { guarnicao: null, funcao: null })).status).toBe(201); // sem posto
    expect((await escalar('escalante', 'M5', 12)).status).toBe(201);
    expect((await escalar('escalante', 'M6', 13)).status).toBe(201);
    for (const [nome, d] of [['M2', 10], ['M3', 10], ['MOT', 10], ['M4', 11], ['M5', 12], ['M6', 13]] as const) id[nome] = await alocacaoDe(nome, d);
    // um acúmulo (o M2 também ocupa o Chefe da AR) e duas remoções (do M7 e do M8, no dia 11)
    expect((await api.pedir('escalante', 'POST', `/api/alocacoes/${id.M2}/acumulos`, { guarnicaoId: ar, funcaoId: chefe })).status).toBe(201);
    id.acumulo = (await api.banco.query<{ id: string }>('select id from alocacao_acumulo where alocacao_id = $1', [id.M2])).rows[0]!.id;
    for (const nome of ['M7', 'M8']) {
      expect((await escalar('escalante', nome, 11)).status).toBe(201);
      id[`rem${nome}`] = ((await (await api.pedir('escalante', 'DELETE', `/api/alocacoes/${await alocacaoDe(nome, 11)}`)).json()) as { remocaoId: string }).remocaoId;
    }
    // uma alocação sem escala (o expediente da pré-escala, 6.40), também no passado
    id.exp = await inserir(api.banco, 'alocacao', { militar_id: militar.M9, escala_id: null, servico_id: expediente.servicoId, turno_id: expediente.turnoId, data: dia(10), origem: 'pre_escala' });
    expect((await api.pedir('escalante', 'POST', `/api/escalas/${escala}/mes/${mes}/previa`)).status).toBe(200);
  });

  describe('o escalante não altera o passado', () => {
    const todas = () => [
      ['escalar', () => escalar('escalante', 'M10', 14)],
      ['remover', () => api.pedir('escalante', 'DELETE', `/api/alocacoes/${id.M3}`)],
      ['trocar por livre', () => api.pedir('escalante', 'POST', `/api/alocacoes/${id.M4}/trocar`, { militarId: militar.M11, turnoId: turnoA })],
      ['acumular', () => api.pedir('escalante', 'POST', `/api/alocacoes/${id.M5}/acumulos`, { guarnicaoId: ar, funcaoId: chefe })],
      ['tirar o acúmulo', () => api.pedir('escalante', 'DELETE', `/api/acumulos/${id.acumulo}`)],
      ['voltar ao turno', () => api.pedir('escalante', 'POST', `/api/alocacoes/${id.M6}/voltar-ao-turno`, { guarnicaoId: abt, funcaoId: combatente })],
      ['desfazer a remoção', () => api.pedir('escalante', 'POST', `/api/remocoes/${id.remM7}/desfazer`)],
      ['permitir de novo', () => api.pedir('escalante', 'DELETE', `/api/remocoes/${id.remM8}`)],
      ['desfazer a resolução', () => api.pedir('escalante', 'POST', '/api/resolucoes/desfazer', { alocacaoId: id.M6, remocaoId: null })],
    ] as const;

    it('cada rota que muda uma alocação recusa com 403 e a frase fixa, e nada é gravado (turno do dia 14: o escalar é no passado)', async () => {
      const antes = await quantas();
      for (const [nome, fazer] of todas()) {
        const r = await fazer();
        expect([nome, r.status]).toEqual([nome, 403]);
        expect(((await r.json()) as { erro: string }).erro).toBe(MSG_SO_GESTOR);
      }
      expect(await quantas()).toBe(antes);
      expect(await registros()).toEqual([]);
    });

    it('um turno que ainda não começou segue livre para o escalante, sem registro (o B das 20:00, às 12:00; e os dias seguintes)', async () => {
      expect((await escalar('escalante', 'M12', 15, { turno: turnoB })).status).toBe(201);
      expect((await escalar('escalante', 'M13', 20)).status).toBe(201);
      expect(await registros()).toEqual([]);
    });

    it('Review Focus 2: o que começou há um minuto é passado; o que começa daqui a um minuto, não', async () => {
      agora(15, 19, 59);
      expect((await escalar('escalante', 'M14', 15, { turno: turnoB })).status).toBe(201);
      agora(15, 20, 1);
      const r = await escalar('escalante', 'M15', 15, { turno: turnoB });
      expect(r.status).toBe(403);
      agora(15, 12);
    });

    it('alocação sem escala (o expediente da pré-escala) não entra na trava', async () => {
      expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${id.exp}`)).status).toBe(200);
    });
  });

  describe('o gestor, o coordenador e o administrador alteram o passado com justificativa', () => {
    it('sem justificativa ou com menos de 10 letras: 400, no campo "justificativa", e nada é gravado', async () => {
      const antes = await quantas();
      for (const justificativa of [undefined, '   ', 'curta', '  nove ltrs ']) {
        const r = await escalar('gestorGb', 'M10', 14, { justificativa });
        expect(r.status).toBe(400);
        expect(((await r.json()) as { campos: Record<string, string> }).campos.justificativa).toBe(MSG_MOTIVO);
      }
      expect(await quantas()).toBe(antes);
    });

    it('escalar: passa e grava uma linha com antes, depois, quem, quando e por quê, e a frase pronta', async () => {
      const r = await escalar('gestorGb', 'M10', 14, { justificativa: MOTIVO });
      expect(r.status).toBe(201);
      const [linha, ...resto] = await registros();
      expect(resto).toEqual([]);
      expect(linha).toMatchObject({
        tipo: 'escala_no_passado', data: dia(14), justificativa: MOTIVO, por: { patente: 'SD', nomeGuerra: 'GESTORGB' },
        antes: { guarnicao: 'ABT', funcao: 'Combatente', inicio: '08:00', militares: [] },
        depois: { militares: [expect.objectContaining({ nomeGuerra: 'M10', patente: 'SD-PS' })] },
        texto: `Pôs SD-PS M10 em ABT (Combatente), dia 14, 08:00`,
      });
      expect(Date.now() - new Date(linha!.em).getTime()).toBeLessThan(60_000);
    });

    it('remover: a frase é "Tirou … de …"', async () => {
      const { r, novos } = await sozinho(() => api.pedir('gestorGb', 'DELETE', `/api/alocacoes/${id.M3}`, { justificativa: MOTIVO }));
      expect(r.status).toBe(200);
      expect(novos.map((x) => x.texto)).toEqual(['Tirou SD-PS M3 de ABT (Combatente), dia 10, 08:00']);
    });

    it('desfazer a remoção: devolve o militar e registra', async () => {
      const { r, novos } = await sozinho(() => api.pedir('gestorGb', 'POST', `/api/remocoes/${id.remM7}/desfazer`, { justificativa: MOTIVO }));
      expect(r.status).toBe(200);
      expect(novos.map((x) => x.texto)).toEqual(['Pôs SD-PS M7 em ABT (Combatente), dia 11, 08:00']);
    });

    it('trocar por um militar livre: a frase diz quem saiu e quem entrou na mesma vaga', async () => {
      const { r, novos } = await sozinho(() => api.pedir('gestorGb', 'POST', `/api/alocacoes/${id.M4}/trocar`, { militarId: militar.M11, turnoId: turnoA, justificativa: MOTIVO }));
      expect(r.status).toBe(200);
      expect(novos.map((x) => x.texto)).toEqual(['Trocou SD-PS M4 por SD-PS M11 em sem guarnição, dia 11, 08:00']);
    });

    it('acumular e tirar o acúmulo', async () => {
      const a = await sozinho(() => api.pedir('gestorGb', 'POST', `/api/alocacoes/${id.M5}/acumulos`, { guarnicaoId: ar, funcaoId: chefe, justificativa: MOTIVO }));
      expect(a.r.status).toBe(201);
      expect(a.novos.map((x) => x.texto)).toEqual(['Pôs SD-PS M5 em AR (Chefe), dia 12, 08:00']);
      const t = await sozinho(() => api.pedir('gestorGb', 'DELETE', `/api/acumulos/${id.acumulo}`, { justificativa: MOTIVO }));
      expect(t.r.status).toBe(200);
      expect(t.novos.map((x) => x.texto)).toEqual(['Tirou SD-PS M2 de AR (Chefe), dia 10, 08:00']);
    });

    it('voltar ao turno (desfazer o movimento para a vaga): a vaga perde o militar e o "sem guarnição" ganha', async () => {
      const { r, novos } = await sozinho(() => api.pedir('gestorGb', 'POST', `/api/alocacoes/${id.M6}/voltar-ao-turno`, { guarnicaoId: abt, funcaoId: combatente, justificativa: MOTIVO }));
      expect(r.status).toBe(200);
      expect(novos.map((x) => x.texto).sort()).toEqual(['Pôs SD-PS M6 em sem guarnição, dia 13, 08:00', 'Tirou SD-PS M6 de ABT (Combatente), dia 13, 08:00']);
    });

    it('o coordenador e o administrador também passam (cada um com a sua justificativa)', async () => {
      const c = await sozinho(() => escalar(coordenador, 'M16', 14, { justificativa: 'Cobertura de afastamento' }));
      expect(c.r.status).toBe(201);
      expect(c.novos[0]).toMatchObject({ por: { nomeGuerra: 'COORDENADOR' }, justificativa: 'Cobertura de afastamento' });
      const a = await sozinho(() => escalar('admin', 'M17', 12, { justificativa: 'Ajuste pedido pelo comando' }));
      expect(a.r.status).toBe(201);
      expect(a.novos[0]).toMatchObject({ por: { nomeGuerra: 'ADMIN' } });
    });

    it('um turno futuro não pede nada ao gestor: sem justificativa e sem registro', async () => {
      const antes = (await registros()).length;
      expect((await escalar('gestorGb', 'M18', 20)).status).toBe(201);
      expect((await registros()).length).toBe(antes);
    });

    it('Review Focus 1: a troca de lugar entre um turno que começou e um que não começou vale a regra do passado para a troca inteira', async () => {
      // o M19 no A das 08:00 e o M20 no B das 20:00, as duas do dia 15 (agora: 12:00)
      agora(15, 7);
      expect((await escalar('escalante', 'M19', 15, { guarnicao: null, funcao: null })).status).toBe(201);
      expect((await escalar('escalante', 'M20', 15, { turno: turnoB, guarnicao: null, funcao: null })).status).toBe(201);
      agora(15, 12);
      const idA = await alocacaoDe('M19', 15);
      const idB = await alocacaoDe('M20', 15, turnoB);
      const negada = await api.pedir('escalante', 'POST', `/api/alocacoes/${idA}/trocar`, { comAlocacaoId: idB });
      expect(negada.status).toBe(403);
      expect(((await negada.json()) as { erro: string }).erro).toBe(MSG_SO_GESTOR);
      const { r, novos } = await sozinho(() => api.pedir('gestorGb', 'POST', `/api/alocacoes/${idA}/trocar`, { comAlocacaoId: idB, justificativa: MOTIVO }));
      expect(r.status).toBe(200);
      // as duas vagas entram no registro, a do turno que ainda não começou também
      expect(novos.map((x) => x.data).sort()).toEqual([dia(15), dia(15)]);
      expect(novos).toHaveLength(2);
    });
  });
});

describe('a pré-escala numa escala com prévia lançada só preenche o que ainda não começou', () => {
  it('sem registro, e o que já passou fica como está', async () => {
    agora(15, 12);
    const antes = (await registros()).length;
    const r = await api.pedir('escalante', 'POST', `/api/escalas/${escala}/mes/${mes}/pre-escala`, { equipeDia1Id: equipe });
    expect(r.status).toBe(201);
    const novas = (await api.banco.query<{ data: string; turno_id: string }>("select to_char(data, 'YYYY-MM-DD') as data, turno_id from alocacao where origem = 'pre_escala' and escala_id = $1", [escala])).rows;
    expect(novas.length).toBeGreaterThan(0);
    // nenhum turno que já começou foi preenchido pela pré-escala: dia antes do 15, ou o A do próprio 15
    expect(novas.filter((n) => n.data < dia(15) || (n.data === dia(15) && n.turno_id === turnoA))).toEqual([]);
    expect((await registros()).length).toBe(antes);
  });
});

describe('prévia recolhida', () => {
  it('Review Focus 4: a trava some (o escalante volta a alterar o passado) e o registro já gravado continua legível', async () => {
    agora(15, 12);
    const gravados = await registros();
    expect(gravados.length).toBeGreaterThan(0);
    expect((await api.pedir('escalante', 'DELETE', `/api/escalas/${escala}/mes/${mes}/previa`)).status).toBe(200);
    expect((await api.pedir('escalante', 'DELETE', `/api/alocacoes/${await alocacaoDe('M10', 14)}`)).status).toBe(200);
    expect(await registros()).toEqual(gravados);
  });
});
