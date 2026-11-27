import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Banco } from '../src/banco/banco.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

let banco: Banco;
let unidade: string;
let posto: string;
let pronto: string;
let turnoA: string;
let jes: string;
let turnoJes: string;
let escala: string;
let funcao: string;
let seq = 0;

async function militar() {
  seq++;
  return inserir(banco, 'militar', {
    matricula: `99${String(7000 + seq).padStart(4, '0')}-${seq % 10}`,
    posto_grad_id: posto,
    nome_guerra: `OP${seq}`,
  });
}

beforeAll(async () => {
  banco = await bancoDeTeste();
  const raiz = (await banco.query<{ id: string }>('select id from unidade where mae_id is null')).rows[0]?.id
    ?? (await inserir(banco, 'unidade', { tipo: 'corporacao', sigla: 'RAIZ-O', nome: 'Raiz', desde: '2026-11-01' }));
  unidade = await inserir(banco, 'unidade', { tipo: 'secao', sigla: 'SEC-O', nome: 'Seção', mae_id: raiz, desde: '2026-11-01' });
  posto = await inserir(banco, 'posto_grad', { sigla: 'SD-O', nome: 'Soldado', ordem: 902 });
  pronto = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Pronto', tipo: 'ordinario', cor: '#2F8F5B' });
  turnoA = await inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '08:00', fim: '20:00' });
  jes = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'JES', tipo: 'pjes', cor: '#6E56A8' });
  turnoJes = await inserir(banco, 'turno', { servico_id: jes, letra: 'A', inicio: '08:00', fim: '20:00' });
  escala = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Ordinário', titulo: 'Escala', militares_doc: 'todos', dias_doc: 'todos' });
  await inserir(banco, 'escala_servico', { escala_id: escala, servico_id: pronto, ordem: 1 }, 'escala_id');
  funcao = await inserir(banco, 'funcao', { unidade_id: unidade, nome: 'Motorista' });
});
afterAll(async () => {
  await banco.fechar();
});

function alocacao(militarId: string, extra: Record<string, unknown> = {}) {
  return inserir(banco, 'alocacao', {
    militar_id: militarId, escala_id: escala, servico_id: pronto, turno_id: turnoA, data: '2026-11-05', origem: 'manual', ...extra,
  });
}

describe('erros esperados', () => {
  it('turno repetido no servico', async () => {
    await expect(inserir(banco, 'turno', { servico_id: pronto, letra: 'A', inicio: '20:00', fim: '08:00' })).rejects.toThrow();
  });

  it('operacao so em diaria', async () => {
    await expect(
      inserir(banco, 'servico', { unidade_id: unidade, nome: 'X', tipo: 'pjes', operacao: 'Op', cor: '#000000' }),
    ).rejects.toThrow();
  });

  it('disponibilidade: o fim depois do início e dentro do dia', async () => {
    const m = await militar();
    const faixa = (inicio_min: number, fim_min: number) => inserir(banco, 'disponibilidade', { militar_id: m, data: '2026-11-05', inicio_min, fim_min, origem: 'manual' });
    await expect(faixa(600, 500)).rejects.toThrow();
    await expect(faixa(600, 1500)).rejects.toThrow();
    await expect(faixa(-1, 100)).rejects.toThrow();
  });

  it('alocacao de servico fora da escala', async () => {
    const m = await militar();
    await expect(alocacao(m, { servico_id: jes, turno_id: turnoJes })).rejects.toThrow(/não faz parte/);
  });

  it('alocacao com turno de outro servico', async () => {
    const m = await militar();
    await expect(alocacao(m, { turno_id: turnoJes })).rejects.toThrow(/não é deste serviço/);
  });

  it('alocacao repetida', async () => {
    const m = await militar();
    await alocacao(m);
    await expect(alocacao(m)).rejects.toThrow();
  });

  it('permuta com um item so', async () => {
    const m = await militar();
    const a = await alocacao(m, { data: '2026-11-06' });
    await expect(
      banco.transacao(async (tx) => {
        const p = await inserir(tx, 'permuta', { mes: '2026-11-01' });
        await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a, militar_original_id: m });
      }),
    ).rejects.toThrow(/exatamente 2/);
  });

  it('cota sem dia 1', async () => {
    await expect(
      inserir(banco, 'cota', { mes: '2026-11-02', unidade_id: unidade, servico_id: jes, quantidade: 1, prioridade: 1 }),
    ).rejects.toThrow();
  });

  it('cota de servico ordinario', async () => {
    await expect(
      inserir(banco, 'cota', { mes: '2026-11-01', unidade_id: unidade, servico_id: pronto, quantidade: 1, prioridade: 1 }),
    ).rejects.toThrow(/PJES ou diária/);
  });

  it('usuario sem militar', async () => {
    await expect(inserir(banco, 'usuario', { nome: 'X', email: 'x@exemplo.test' })).rejects.toThrow();
  });

  it('composicao com maximo menor que minimo', async () => {
    const g = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'UR-1' });
    const v = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    await expect(inserir(banco, 'composicao', { guarnicao_versao_id: v, funcao_id: funcao, minimo: 2, maximo: 1 })).rejects.toThrow();
  });

  it('cnh_exigida invalida', async () => {
    const g = await inserir(banco, 'guarnicao', { unidade_id: unidade, nome: 'UR-2' });
    const v = await inserir(banco, 'guarnicao_versao', { guarnicao_id: g, vigencia_desde: '2026-11-01' });
    await expect(
      inserir(banco, 'composicao', { guarnicao_versao_id: v, funcao_id: funcao, minimo: 1, cnh_exigida: 'F' }),
    ).rejects.toThrow();
  });
});

describe('casos validos', () => {
  it('permuta com dois itens', async () => {
    const m1 = await militar();
    const m2 = await militar();
    const a1 = await alocacao(m1, { data: '2026-11-07' });
    const a2 = await alocacao(m2, { data: '2026-11-08' });
    await banco.transacao(async (tx) => {
      const p = await inserir(tx, 'permuta', { mes: '2026-11-01' });
      await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a1, militar_original_id: m1 });
      await inserir(tx, 'permuta_item', { permuta_id: p, alocacao_id: a2, militar_original_id: m2 });
    });
    const { rows } = await banco.query<{ n: number }>('select count(*)::int as n from permuta_item');
    expect(rows[0]!.n).toBe(2);
  });

  it('turno que atravessa a meia-noite', async () => {
    const s = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E' });
    const t = await inserir(banco, 'turno', { servico_id: s, letra: 'C', inicio: '16:00', fim: '00:00' });
    expect(t).toBeTruthy();
  });
});

describe('escala dos oficiais (P1.2 e 6.27)', () => {
  let rodada: string;
  let servicoSaldo: string;
  let turnoSaldo: string;
  beforeAll(async () => {
    // a escala dos oficiais é uma escala comum de rodada de cotas, com um serviço de saldo
    rodada = await inserir(banco, 'escala', { unidade_id: unidade, nome: 'Oficiais de teste', titulo: 'OFICIAIS', militares_doc: 'escalados', dias_doc: 'com_escalados', distribuicao: 'rodada_de_cotas' });
    servicoSaldo = await inserir(banco, 'servico', { unidade_id: unidade, nome: 'Saldo de teste', tipo: 'ordinario', cor: '#2B7BB9' });
    turnoSaldo = await inserir(banco, 'turno', { servico_id: servicoSaldo, letra: 'A', inicio: '07:00', fim: '19:00' });
    await banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, 1)', [rodada, servicoSaldo]);
  });
  async function mes(mesData: string, extra: Record<string, unknown> = {}) {
    return inserir(banco, 'oficiais_mes', { unidade_id: unidade, escala_id: rodada, mes: mesData, ...extra });
  }

  it('o mesmo mês duas vezes na mesma escala falha com 23505', async () => {
    await mes('2030-01-01');
    await expect(mes('2030-01-01')).rejects.toMatchObject({ code: '23505' });
  });

  it('o mês sem escala falha com 23502; a escala só aceita os dois jeitos de distribuir (23514)', async () => {
    await expect(inserir(banco, 'oficiais_mes', { unidade_id: unidade, mes: '2030-01-01' })).rejects.toMatchObject({ code: '23502' });
    await expect(inserir(banco, 'escala', { unidade_id: unidade, nome: 'Jeito errado', titulo: 'X', militares_doc: 'escalados', dias_doc: 'todos', distribuicao: 'sorteio' })).rejects.toMatchObject({ code: '23514' });
  });

  it('fechada_em sem aberto_em e encerrada_em sem fechada_em falham com 23514', async () => {
    await expect(mes('2030-02-01', { fechada_em: '2030-02-01T10:00:00Z' })).rejects.toMatchObject({ code: '23514' });
    await expect(mes('2030-03-01', { aberto_em: '2030-03-01T10:00:00Z', encerrada_em: '2030-03-02T10:00:00Z' })).rejects.toMatchObject({ code: '23514' });
  });

  it('ajuste sem motivo falha com 23514; com motivo grava', async () => {
    const m = await militar();
    const ajuste = (motivo: string | null) =>
      inserir(banco, 'oficiais_saldo', { unidade_id: unidade, militar_id: m, tipo: 'ajuste', valor: 0.5, motivo });
    await expect(ajuste(null)).rejects.toMatchObject({ code: '23514' });
    await expect(ajuste('   ')).rejects.toMatchObject({ code: '23514' });
    expect(await ajuste('Correção do gestor')).toBeTruthy();
  });

  it('dois lançamentos mes do mesmo militar no mesmo mês falham com 23505', async () => {
    const m = await militar();
    const id = await mes('2030-04-01');
    const lanc = () => inserir(banco, 'oficiais_saldo', { unidade_id: unidade, militar_id: m, mes_id: id, tipo: 'mes', valor: -0.25 });
    await lanc();
    await expect(lanc()).rejects.toMatchObject({ code: '23505' });
  });

  it('a auditoria da cobertura sai com a unidade da escala', async () => {
    const quem = await militar();
    const saiu = await militar();
    const aloc = await inserir(banco, 'alocacao', { militar_id: quem, escala_id: rodada, servico_id: servicoSaldo, turno_id: turnoSaldo, data: '2030-05-01', origem: 'distribuicao' });
    await banco.query('insert into oficiais_cobertura (alocacao_id, saiu_militar_id) values ($1, $2)', [aloc, saiu]);
    const { rows } = await banco.query<{ unidade_id: string }>("select unidade_id from auditoria where tabela = 'oficiais_cobertura' and acao = 'insert' and depois ->> 'alocacao_id' = $1", [aloc]);
    expect(rows[0]?.unidade_id).toBe(unidade);
  });

  it('cobertura: uma por alocação, e apagar a alocação apaga a cobertura', async () => {
    const quem = await militar();
    const saiu = await militar();
    const aloc = await inserir(banco, 'alocacao', { militar_id: quem, escala_id: rodada, servico_id: servicoSaldo, turno_id: turnoSaldo, data: '2030-06-02', origem: 'distribuicao' });
    await banco.query('insert into oficiais_cobertura (alocacao_id, saiu_militar_id) values ($1, $2)', [aloc, saiu]);
    await expect(banco.query('insert into oficiais_cobertura (alocacao_id, saiu_militar_id) values ($1, $2)', [aloc, saiu])).rejects.toMatchObject({ code: '23505' });
    await banco.query('delete from alocacao where id = $1', [aloc]);
    expect((await banco.query('select 1 from oficiais_cobertura where alocacao_id = $1', [aloc])).rows).toHaveLength(0);
  });
});
