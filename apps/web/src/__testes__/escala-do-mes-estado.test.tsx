import type { CardDaGuarnicao, DiaDaEscala, EscalaDoMes, EstadoDoMes, FaixaDoDia, LinhaEscala, OcupanteDaVaga, RegistroDeAlteracao } from 'contratos';
import { mesPorExtenso } from 'contratos';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EuDaApi } from '@/api/eu';
import { foiCancelado, pedir } from '@/api/cliente';
import { desativar } from '@/api/efetivo-do-dia';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 7.4: o estado da escala na montagem, "Lançar prévia", "Publicar" e "Republicar", o motivo do passado e as alterações no passado. Dados fictícios (D7).
const MES = mesAtual();
const LISTA: LinhaEscala[] = [{ id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'], montaBlocosVoluntariado: true, distribuicao: 'pre_escala' }];
const ocupante = (nome: string): OcupanteDaVaga => ({
  alocacaoId: `a-${nome}`, acumuloId: null, acumulaCom: [], militarId: `m-${nome}`, posto: 'SD', nomeGuerra: nome, matricula: '990001-1', servico: { id: 's1', nome: 'Pronto', cor: '#2F8F5B' }, letra: 'A',
});
const card = (motorista: boolean): CardDaGuarnicao => ({
  guarnicaoId: 'g-abt', nome: 'ABT', viatura: 'ABT-01', prioridade: 1, completa: motorista, faltam: motorista ? [] : ['Falta 1 Motorista (CNH D)'],
  funcoes: [{ funcaoId: 'f-mot', funcao: 'Motorista', minimo: 1, maximo: 1, cnhExigida: 'D', ocupantes: motorista ? [ocupante('MOTOR')] : [] }],
});
const faixa = (c: CardDaGuarnicao): FaixaDoDia => ({
  inicio: '08:00', fim: '20:00', noturna: false, turnos: [{ turnoId: 't-a', servicoId: 's1', servico: 'Pronto', cor: '#2F8F5B', letra: 'A' }], guarnicoes: [c], semPosto: [], removidos: [],
});
const dia = (n: number, c: CardDaGuarnicao): DiaDaEscala => ({ data: `${MES}-0${n}`, diaDaSemana: n % 7, feriado: null, faixas: [faixa(c)], obrigatoriasVazias: c.faltam.length });
const estado = (e: Partial<EstadoDoMes>): EstadoDoMes => ({ estado: 'rascunho', emRetificacao: false, em: null, por: null, ...e });
const ESCALA = (e: Partial<EstadoDoMes> = {}, extra: Partial<EscalaDoMes> = {}): EscalaDoMes => ({
  escalaId: 'e1', nome: 'Ordinário', mes: MES, dias: [dia(1, card(true)), dia(2, card(false))], resumo: { preenchidas: 1, obrigatorias: 2, obrigatoriasVazias: 1 },
  estado: estado(e), podePublicar: false, podeAlterarPassado: false, ...extra,
});
const EM = '2026-11-20T15:00:00.000Z';
const GESTOR = { podePublicar: true, podeAlterarPassado: true };
const CONSULTA: EuDaApi = { ...EU_EXEMPLO, papeis: [], unidades: [], unidadesSoConsulta: [{ id: 'u-1sb', sigla: '1ª SB', caminho: ['CBMPE', 'DGO', 'DInter/1', '2º GB', '1ª SB'], nivel: 4, tipo: 'secao', maeId: null }] };
const ROTA_MES = `GET /api/escalas/e1/mes/${MES}`;
const ROTA_REGISTRO = `GET /api/escalas/e1/mes/${MES}/registro`;

function api(escala: EscalaDoMes, extra: Parameters<typeof simularApi>[0] = {}, eu: EuDaApi = EU_EXEMPLO) {
  return simularApi({
    '/api/eu': { status: 200, corpo: eu },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: LISTA },
    [ROTA_MES]: { status: 200, corpo: escala },
    [ROTA_REGISTRO]: { status: 200, corpo: [] },
    ...extra,
  });
}
/** Cada chamada à rota recebe a próxima resposta da fila (a última se repete). */
function fila(f: ReturnType<typeof simularApi>, rota: string, respostas: { status: number; corpo?: unknown }[]) {
  const padrao = f.getMockImplementation()!;
  const [metodo, caminho] = rota.split(' ');
  let n = 0;
  f.mockImplementation(async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    if (new URL(url, 'http://localhost').pathname === caminho && (init?.method ?? 'GET').toUpperCase() === metodo) {
      const r = respostas[Math.min(n++, respostas.length - 1)]!;
      return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }
    return padrao(entrada, init);
  });
}
const botao = (nome: string) => screen.queryByRole('button', { name: nome });
const secaoDoDia = (n: number) => screen.getByRole('region', { name: `Dia ${n}` });
async function removerMotorista() {
  const d1 = await screen.findByRole('region', { name: 'Dia 1' });
  await userEvent.click(within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: /^Ações de MOTOR/ }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Remover da vaga' }));
}
const SEM_MOTOR = (e: Partial<EstadoDoMes> = {}, extra: Partial<EscalaDoMes> = {}) => ({ ...ESCALA(e, extra), dias: [dia(1, card(false)), dia(2, card(false))], remocaoId: 'r-MOTOR' });
const MOTIVO = 'Trocou por motivo de saúde';

describe('o estado da escala (Task 1)', () => {
  const casos: [string, Partial<EstadoDoMes>, string, string][] = [
    ['rascunho', {}, 'Rascunho', 'Só quem monta esta escala a vê.'],
    ['prévia', { estado: 'previa', em: EM, por: 'SD ESCALANTE' }, 'Prévia', 'Prévia lançada em 20/11 por SD ESCALANTE. A sua unidade e as de baixo veem. Pode mudar até o dia do serviço.'],
    ['publicada', { estado: 'publicada', em: EM, por: 'SD GESTOR' }, 'Publicada', 'Publicada em 20/11. Toda a corporação vê. Qualquer mudança agora é uma retificação.'],
    ['retificada', { estado: 'retificada', em: EM, por: 'SD GESTOR' }, 'Retificada', 'Republicada em 20/11.'],
    ['remessada', { estado: 'remessada', em: EM, por: 'SD GESTOR' }, 'Remessada', 'Remessada em 20/11. Só o administrador altera.'],
  ];
  for (const [nome, e, rotulo, apoio] of casos) {
    it(`${nome}: mostra o nome do estado e a linha de apoio com o texto fixo`, async () => {
      api(ESCALA(e));
      abrir('/escala-do-mes');
      const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
      expect(within(bloco).getByText(rotulo)).toBeInTheDocument();
      expect(within(bloco).getByText(apoio)).toBeInTheDocument();
      expect(within(bloco).queryByText('Escala em retificação')).toBeNull();
    });
  }

  it('em retificação: a etiqueta "Escala em retificação" e a linha de apoio dela; para quem não publica, diz quem publica', async () => {
    api(ESCALA({ estado: 'publicada', em: EM, emRetificacao: true }));
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).getByText('Escala em retificação')).toBeInTheDocument();
    expect(within(bloco).getByText('Em retificação. O gestor republica quando terminar.')).toBeInTheDocument();
    expect(within(bloco).getByText('Quem publica é o gestor da unidade.')).toBeInTheDocument();
  });

  it('em retificação, para o gestor não diz "quem publica é o gestor" (ele mesmo republica)', async () => {
    api(ESCALA({ estado: 'publicada', em: EM, emRetificacao: true }, GESTOR));
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).queryByText('Quem publica é o gestor da unidade.')).toBeNull();
  });

  const botoes: [string, Partial<EstadoDoMes>, boolean, string[]][] = [
    ['rascunho, escalante', {}, false, ['Lançar prévia']],
    ['rascunho, gestor', {}, true, ['Lançar prévia', 'Publicar']],
    ['prévia, escalante', { estado: 'previa', em: EM }, false, []],
    ['prévia, gestor', { estado: 'previa', em: EM }, true, ['Publicar']],
    ['publicada, escalante', { estado: 'publicada', em: EM }, false, []],
    ['publicada, gestor', { estado: 'publicada', em: EM }, true, []],
    ['em retificação, escalante', { estado: 'publicada', em: EM, emRetificacao: true }, false, []],
    ['em retificação, gestor', { estado: 'publicada', em: EM, emRetificacao: true }, true, ['Republicar']],
    ['retificada em retificação, gestor', { estado: 'retificada', em: EM, emRetificacao: true }, true, ['Republicar']],
    ['remessada, gestor', { estado: 'remessada', em: EM }, true, []],
  ];
  for (const [nome, e, publica, esperados] of botoes) {
    it(`os botões de ${nome}: ${esperados.length ? esperados.join(' e ') : 'nenhum'}`, async () => {
      api(ESCALA(e, { podePublicar: publica }));
      abrir('/escala-do-mes');
      await screen.findByRole('region', { name: 'Estado da escala' });
      for (const b of ['Lançar prévia', 'Publicar', 'Republicar']) expect(Boolean(botao(b)), b).toBe(esperados.includes(b));
    });
  }

  it('unidade só de consulta: o estado aparece e nenhum botão de passagem', async () => {
    api(ESCALA({}, GESTOR), {}, CONSULTA);
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).getByText('Rascunho')).toBeInTheDocument();
    for (const b of ['Lançar prévia', 'Publicar', 'Republicar']) expect(botao(b), b).toBeNull();
  });

  it('com vaga obrigatória vazia, "Lançar prévia" e "Publicar" continuam ativos (o escalante nunca é impedido de fechar a escala)', async () => {
    api(ESCALA({}, GESTOR));
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Estado da escala' });
    expect(screen.getByText(/1 vazias/)).toBeInTheDocument();
    expect(botao('Lançar prévia')).toBeEnabled();
    expect(botao('Publicar')).toBeEnabled();
  });

  it('"Lançar prévia" pede confirmação (texto fixo); confirmar manda o POST e o estado novo entra na tela; cancelar não manda nada', async () => {
    const f = api(ESCALA(), { [`POST /api/escalas/e1/mes/${MES}/previa`]: { status: 200, corpo: ESCALA({ estado: 'previa', em: EM, por: 'SD ESCALANTE' }) } });
    abrir('/escala-do-mes');
    await userEvent.click(await screen.findByRole('button', { name: 'Lançar prévia' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(`Lançar a prévia de Ordinário, ${mesPorExtenso(MES)}? A sua unidade e as de baixo passam a ver esta escala. Você continua podendo alterar.`)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(chamadasA(f, `POST /api/escalas/e1/mes/${MES}/previa`)).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Lançar prévia' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lançar prévia' }));
    await waitFor(() => expect(chamadasA(f, `POST /api/escalas/e1/mes/${MES}/previa`)).toBe(1));
    const bloco = screen.getByRole('region', { name: 'Estado da escala' });
    expect(await within(bloco).findByText('Prévia')).toBeInTheDocument();
    expect(botao('Lançar prévia')).toBeNull();
  });

  it('"Publicar" e "Republicar" pedem confirmação com o texto fixo e mandam o POST certo', async () => {
    const f = api(ESCALA({}, GESTOR), {
      [`POST /api/escalas/e1/mes/${MES}/publicar`]: { status: 200, corpo: ESCALA({ estado: 'publicada', em: EM, por: 'SD GESTOR' }, GESTOR) },
      [`POST /api/escalas/e1/mes/${MES}/republicar`]: { status: 200, corpo: ESCALA({ estado: 'retificada', em: EM, por: 'SD GESTOR' }, GESTOR) },
    });
    abrir('/escala-do-mes');
    await userEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    const d1 = await screen.findByRole('dialog');
    expect(within(d1).getByText(`Publicar Ordinário, ${mesPorExtenso(MES)}? Toda a corporação passa a ver esta escala. Daqui em diante, qualquer mudança é uma retificação.`)).toBeInTheDocument();
    await userEvent.click(within(d1).getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(chamadasA(f, `POST /api/escalas/e1/mes/${MES}/publicar`)).toBe(1));
    expect(await screen.findByText('Publicada em 20/11. Toda a corporação vê. Qualquer mudança agora é uma retificação.')).toBeInTheDocument();
  });

  it('Review Focus 4: a etiqueta acende na hora (sem recarregar) com o aviso, e some depois do "Republicar", com o estado "Retificada"', async () => {
    const f = api(ESCALA({ estado: 'publicada', em: EM, por: 'SD GESTOR' }, GESTOR), {
      'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: SEM_MOTOR({ estado: 'publicada', em: EM, por: 'SD GESTOR', emRetificacao: true }, GESTOR) },
      [`POST /api/escalas/e1/mes/${MES}/republicar`]: { status: 200, corpo: ESCALA({ estado: 'retificada', em: EM, por: 'SD GESTOR' }, GESTOR) },
    });
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).queryByText('Escala em retificação')).toBeNull();
    await removerMotorista();
    expect(await within(bloco).findByText('Escala em retificação')).toBeInTheDocument();
    expect(within(bloco).getByText('Esta escala está publicada. Ela ficou em retificação até o gestor republicar.')).toBeInTheDocument();
    await userEvent.click(within(bloco).getByRole('button', { name: 'Republicar' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Republicar' }));
    await waitFor(() => expect(chamadasA(f, `POST /api/escalas/e1/mes/${MES}/republicar`)).toBe(1));
    await waitFor(() => expect(within(bloco).queryByText('Escala em retificação')).toBeNull());
    expect(within(bloco).getByText('Retificada')).toBeInTheDocument();
    expect(within(bloco).queryByText(/ficou em retificação/)).toBeNull();
  });

  it('a escala que já abre em retificação não mostra o aviso da primeira mudança', async () => {
    api(ESCALA({ estado: 'publicada', em: EM, emRetificacao: true }, GESTOR));
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).getByText('Escala em retificação')).toBeInTheDocument();
    expect(within(bloco).queryByText(/ficou em retificação/)).toBeNull();
  });
});

describe('o motivo do passado (Task 2)', () => {
  const pedido = { status: 400, corpo: { erro: 'Diga o motivo da alteração (pelo menos 10 letras).', campos: { justificativa: 'Diga o motivo da alteração (pelo menos 10 letras).' } } };
  const ok = { status: 200, corpo: SEM_MOTOR({ estado: 'previa', em: EM }) };
  const diagolo = () => screen.findByRole('dialog', { name: 'Alterar o passado' });

  it('a chamada comum passa direto, sem diálogo', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }), { 'DELETE /api/alocacoes/a-MOTOR': ok });
    abrir('/escala-do-mes');
    await removerMotorista();
    expect(await screen.findByText('SD MOTOR saiu de Motorista da ABT.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1);
  });

  it('o 400 da justificativa abre o diálogo; confirmado, a segunda chamada leva o texto', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR));
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [pedido, ok]);
    abrir('/escala-do-mes');
    await removerMotorista();
    const d = within(await diagolo());
    expect(d.getByText('Este turno já começou. Diga o motivo da alteração: ele fica registrado.')).toBeInTheDocument();
    await userEvent.type(d.getByLabelText('Motivo'), MOTIVO);
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('SD MOTOR saiu de Motorista da ABT.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const envios = f.mock.calls.filter(([e, i]) => String(e).endsWith('/api/alocacoes/a-MOTOR') && i?.method === 'DELETE');
    expect(envios).toHaveLength(2);
    expect(JSON.parse(String(envios[1]![1]!.body))).toEqual({ justificativa: MOTIVO });
  });

  it('o motivo curto demais: a mensagem da API aparece no campo e o diálogo continua aberto, com o texto digitado', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR));
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [pedido, pedido, ok]);
    abrir('/escala-do-mes');
    await removerMotorista();
    const d = within(await diagolo());
    await userEvent.type(d.getByLabelText('Motivo'), 'curto');
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    expect(await d.findByRole('alert')).toHaveTextContent('Diga o motivo da alteração (pelo menos 10 letras).');
    expect(d.getByLabelText('Motivo')).toHaveValue('curto');
    await userEvent.type(d.getByLabelText('Motivo'), ' de novo, agora longo');
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText('SD MOTOR saiu de Motorista da ABT.')).toBeInTheDocument();
  });

  it('Review Focus 1: cancelar o diálogo não muda nada na escala e não mostra erro (o militar continua na vaga)', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR));
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [pedido, ok]);
    abrir('/escala-do-mes');
    await removerMotorista();
    await userEvent.click(within(await diagolo()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1);
    expect(screen.queryByText('SD MOTOR saiu de Motorista da ABT.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(secaoDoDia(1).querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: /^Ações de MOTOR/ })).toBeInTheDocument();
  });

  it('o 403 do escalante e o da escala remessada aparecem como a mensagem de erro normal da tela, sem diálogo', async () => {
    for (const erro of ['Este turno já começou. Só o gestor altera o passado.', 'Esta escala já foi remessada. Só o administrador altera.']) {
      api(ESCALA({ estado: 'previa', em: EM }), { 'DELETE /api/alocacoes/a-MOTOR': { status: 403, corpo: { erro } } });
      abrir('/escala-do-mes');
      await removerMotorista();
      expect(await screen.findByText(erro)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
    }
  });

  it('Review Focus 2: o "Desfazer" da faixa num turno passado também abre o diálogo e repete com o texto', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR), { 'DELETE /api/alocacoes/a-MOTOR': ok });
    fila(f, 'POST /api/remocoes/r-MOTOR/desfazer', [pedido, { status: 200, corpo: ESCALA({ estado: 'previa', em: EM }, GESTOR) }]);
    abrir('/escala-do-mes');
    await removerMotorista();
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    const d = within(await diagolo());
    await userEvent.type(d.getByLabelText('Motivo'), MOTIVO);
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/remocoes/r-MOTOR/desfazer')).toBe(2));
    const envios = f.mock.calls.filter(([e]) => String(e).endsWith('/api/remocoes/r-MOTOR/desfazer'));
    expect(JSON.parse(String(envios[1]![1]!.body))).toEqual({ justificativa: MOTIVO });
  });

  it('achado da revisão: cancelar o diálogo depois de "Desfazer" não mostra erro nenhum ("Cancelado.") e deixa tudo como estava', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR), { 'DELETE /api/alocacoes/a-MOTOR': ok });
    fila(f, 'POST /api/remocoes/r-MOTOR/desfazer', [pedido, { status: 200, corpo: ESCALA({ estado: 'previa', em: EM }, GESTOR) }]);
    abrir('/escala-do-mes');
    await removerMotorista();
    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await userEvent.click(within(await diagolo()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(/Cancelado/)).toBeNull();
    expect(screen.queryByText('Algo deu errado. Tente de novo.')).toBeNull();
    expect(chamadasA(f, 'POST /api/remocoes/r-MOTOR/desfazer')).toBe(1);
  });

  it('Review Focus 3: a regra é do site todo (a Grade, o painel do dia, o efetivo): qualquer chamada de mudança que a API responder com o 400 da justificativa abre o mesmo diálogo', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR));
    fila(f, 'POST /api/alocacoes/a-X/trocar', [pedido, { status: 200, corpo: { escalas: [] } }]);
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const resultado = pedir('POST', '/api/alocacoes/a-X/trocar', { comAlocacaoId: 'a-Y' });
    const d = within(await diagolo());
    await userEvent.type(d.getByLabelText('Motivo'), MOTIVO);
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    await expect(resultado).resolves.toEqual({ escalas: [] });
    const envios = f.mock.calls.filter(([e]) => String(e).endsWith('/trocar'));
    expect(JSON.parse(String(envios[1]![1]!.body))).toEqual({ comAlocacaoId: 'a-Y', justificativa: MOTIVO });
  });

  it('Review Focus 5: em rascunho a chamada passa sem diálogo; depois de "Lançar prévia", a mesma chamada abre o diálogo', async () => {
    const f = api(ESCALA({}, GESTOR), { [`POST /api/escalas/e1/mes/${MES}/previa`]: { status: 200, corpo: ESCALA({ estado: 'previa', em: EM }, GESTOR) } });
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [{ status: 200, corpo: SEM_MOTOR() }, pedido, ok]);
    abrir('/escala-do-mes');
    await removerMotorista();
    expect(await screen.findByText('SD MOTOR saiu de Motorista da ABT.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Alterar o passado' })).toBeNull();
  });
});

describe('as alterações no passado (Task 3)', () => {
  const linha = (id: string, texto: string, em: string, justificativa: string | null = MOTIVO): RegistroDeAlteracao => ({
    id, em, por: { patente: 'SD', nomeGuerra: 'GESTOR' }, tipo: 'escala_no_passado', data: `${MES}-01`, antes: null, depois: null, justificativa, texto,
  });
  const REGISTRO = [linha('r2', 'Tirou SD MOTOR de ABT (Motorista), dia 01, 08:00', '2026-11-21T10:00:00.000Z'), linha('r1', 'Pôs SD MOTOR em ABT (Motorista), dia 01, 08:00', '2026-11-20T09:00:00.000Z', 'Cobertura de afastamento')];

  it('com registro, o botão "Alterações no passado (n)" abre o painel com a lista, da mais nova para a mais velha: quando, quem, a frase e o motivo', async () => {
    api(ESCALA({ estado: 'previa', em: EM }), { [ROTA_REGISTRO]: { status: 200, corpo: REGISTRO } });
    abrir('/escala-do-mes');
    await userEvent.click(await screen.findByRole('button', { name: 'Alterações no passado (2)' }));
    const painel = await screen.findByRole('region', { name: 'Alterações no passado' });
    const itens = within(painel).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Tirou SD MOTOR de ABT (Motorista), dia 01, 08:00');
    expect(itens[0]).toHaveTextContent('SD GESTOR');
    expect(itens[0]).toHaveTextContent(MOTIVO);
    expect(itens[1]).toHaveTextContent('Cobertura de afastamento');
  });

  it('sem registro, o botão não aparece', async () => {
    api(ESCALA({ estado: 'previa', em: EM }));
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Estado da escala' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Alterações no passado/ })).toBeNull());
  });

  it('a lista recarrega depois de uma alteração justificada', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR), { 'DELETE /api/alocacoes/a-MOTOR': { status: 200, corpo: SEM_MOTOR({ estado: 'previa', em: EM }) } });
    fila(f, ROTA_REGISTRO, [{ status: 200, corpo: [] }, { status: 200, corpo: [REGISTRO[0]] }]);
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Estado da escala' });
    expect(screen.queryByRole('button', { name: /^Alterações no passado/ })).toBeNull();
    await removerMotorista();
    expect(await screen.findByRole('button', { name: 'Alterações no passado (1)' })).toBeInTheDocument();
  });
});

describe('o motivo do passado, uma vez por ação (6.53, Task 2)', () => {
  const pedido = { status: 400, corpo: { erro: 'Diga o motivo da alteração (pelo menos 10 letras).', campos: { justificativa: 'Diga o motivo da alteração (pelo menos 10 letras).' } } };
  const diagolo = () => screen.findByRole('dialog', { name: 'Alterar o passado' });
  const ZULU = { militarId: 'm-zulu', posto: 'SD', nomeGuerra: 'ZULU', matricula: '990002-2', equipe: 'Alfa', jornada: 'pronto', servicos: [{ servicoId: 's1', turnoId: 't-a', nome: 'Pronto' }] };
  const CANDIDATOS = { aptos: [ZULU], semVoluntariado: [], emChoque: [], fora: [], acumular: [] };
  const rotaCandidatos = `GET /api/escalas/e1/mes/${MES}/candidatos`;
  const trocarMotorista = async () => {
    const d1 = await screen.findByRole('region', { name: 'Dia 1' });
    await userEvent.click(within(d1.querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: /^Ações de MOTOR/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Trocar militar' }));
  };
  /** O POST de escalar só passa com o motivo no corpo (senão, o 400 do passado): a prova de que o motivo da primeira chamada foi adiante. */
  function escalarExigindoMotivo(f: ReturnType<typeof simularApi>) {
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (entrada, init) => {
      const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
      if (url.endsWith('/api/escalas/e1/alocacoes') && init?.method === 'POST') {
        const corpo = JSON.parse(String(init.body)) as { justificativa?: string };
        const r = corpo.justificativa ? { status: 201, corpo: ESCALA({ estado: 'previa', em: EM }, GESTOR) } : pedido;
        return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { 'Content-Type': 'application/json' } });
      }
      return padrao(entrada, init);
    });
  }

  it('Review Focus 1: "Trocar militar" num turno passado pede o motivo uma vez; o escalar já sai com o motivo digitado no tirar, e o aviso de retificação não se repete', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR), { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [pedido, { status: 200, corpo: SEM_MOTOR({ estado: 'previa', em: EM }, GESTOR) }]);
    escalarExigindoMotivo(f);
    abrir('/escala-do-mes');
    await trocarMotorista();
    const d = within(await diagolo());
    await userEvent.type(d.getByLabelText('Motivo'), MOTIVO);
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    const escolha = within(await screen.findByRole('dialog', { name: 'Escolher militar' }));
    await userEvent.click(await escolha.findByRole('button', { name: /ZULU/ }));
    await waitFor(() => expect(chamadasA(f, 'POST /api/escalas/e1/alocacoes')).toBe(1));
    const envio = f.mock.calls.find(([e, i]) => String(e).endsWith('/api/escalas/e1/alocacoes') && i?.method === 'POST')!;
    expect(JSON.parse(String(envio[1]!.body))).toMatchObject({ militarId: 'm-zulu', justificativa: MOTIVO });
    // o motivo foi pedido uma vez só: nenhum diálogo do passado ficou ou voltou
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Review Focus 1: cancelar o diálogo do motivo no "Trocar militar" não tira ninguém e não abre a escolha', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR), { [rotaCandidatos]: { status: 200, corpo: CANDIDATOS } });
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [pedido, { status: 200, corpo: SEM_MOTOR({ estado: 'previa', em: EM }, GESTOR) }]);
    abrir('/escala-do-mes');
    await trocarMotorista();
    await userEvent.click(within(await diagolo()).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('dialog', { name: 'Escolher militar' })).toBeNull();
    expect(screen.queryByText('SD MOTOR saiu de Motorista da ABT.')).toBeNull();
    expect(chamadasA(f, 'DELETE /api/alocacoes/a-MOTOR')).toBe(1);
    expect(within(secaoDoDia(1).querySelector('[data-faixa]') as HTMLElement).getByRole('button', { name: /^Ações de MOTOR/ })).toBeInTheDocument();
  });

  it('Review Focus 2: um segundo pedido de motivo com o diálogo aberto cancela o primeiro em silêncio, e só o segundo fica aberto; nenhuma promessa fica pendurada', async () => {
    const f = api(ESCALA({ estado: 'previa', em: EM }, GESTOR));
    fila(f, 'POST /api/alocacoes/a-X/trocar', [pedido, { status: 200, corpo: { escalas: [] } }]);
    fila(f, 'POST /api/alocacoes/a-Y/trocar', [pedido, { status: 200, corpo: { escalas: ['y'] } }]);
    abrir('/escala-do-mes');
    await screen.findByRole('region', { name: 'Dia 1' });
    const primeiro = pedir('POST', '/api/alocacoes/a-X/trocar', { comAlocacaoId: 'a-1' });
    await diagolo();
    const segundo = pedir('POST', '/api/alocacoes/a-Y/trocar', { comAlocacaoId: 'a-2' });
    await expect(primeiro).rejects.toSatisfy((e: unknown) => foiCancelado(e));
    expect(screen.getAllByRole('dialog', { name: 'Alterar o passado' })).toHaveLength(1);
    const d = within(await diagolo());
    await userEvent.type(d.getByLabelText('Motivo'), MOTIVO);
    await userEvent.click(d.getByRole('button', { name: 'Confirmar' }));
    await expect(segundo).resolves.toEqual({ escalas: ['y'] });
    // só o segundo foi repetido com o motivo
    expect(chamadasA(f, 'POST /api/alocacoes/a-X/trocar')).toBe(1);
    expect(chamadasA(f, 'POST /api/alocacoes/a-Y/trocar')).toBe(2);
  });

  it('o aviso "ficou em retificação" aparece só quando a retificação veio de uma gravação desta tela: uma nova leitura (outra pessoa mexeu) só acende a etiqueta', async () => {
    const f = api(ESCALA({ estado: 'publicada', em: EM }, GESTOR));
    fila(f, ROTA_MES, [{ status: 200, corpo: ESCALA({ estado: 'publicada', em: EM }, GESTOR) }, { status: 200, corpo: ESCALA({ estado: 'publicada', em: EM, emRetificacao: true }, GESTOR) }]);
    abrir('/escala-do-mes');
    const bloco = await screen.findByRole('region', { name: 'Estado da escala' });
    expect(within(bloco).queryByText('Escala em retificação')).toBeNull();
    // outra pessoa mexeu: a janela volta ao foco e a escala é lida de novo
    window.dispatchEvent(new Event('visibilitychange'));
    expect(await within(bloco).findByText('Escala em retificação')).toBeInTheDocument();
    expect(within(bloco).queryByText(/ficou em retificação/)).toBeNull();
  });

  it('depois de "Lançar prévia", a mesma mudança em dia passado passa a abrir o diálogo (em rascunho não abria)', async () => {
    const f = api(ESCALA({}, GESTOR), { [`POST /api/escalas/e1/mes/${MES}/previa`]: { status: 200, corpo: ESCALA({ estado: 'previa', em: EM }, GESTOR) } });
    fila(f, 'DELETE /api/alocacoes/a-MOTOR', [{ status: 200, corpo: SEM_MOTOR() }, pedido, { status: 200, corpo: SEM_MOTOR({ estado: 'previa', em: EM }, GESTOR) }]);
    abrir('/escala-do-mes');
    await removerMotorista();
    expect(await screen.findByText('SD MOTOR saiu de Motorista da ABT.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Alterar o passado' })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Lançar prévia' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lançar prévia' }));
    await waitFor(() => expect(chamadasA(f, `POST /api/escalas/e1/mes/${MES}/previa`)).toBe(1));
    await removerMotorista();
    expect(await diagolo()).toBeInTheDocument();
  });

  it('uma mudança pelo Efetivo por dia também invalida a lista de alterações no passado', async () => {
    simularApi({ 'POST /api/unidades/u-1sb/meta-do-dia/2026-12-01/desativar': { status: 200, corpo: { efetivo: { data: '2026-12-01', guarnicoes: [], desativadas: [], cotas: [], meta: { origem: 'dia', total: 0, ativadas: 0 } }, desfazer: {} } } });
    const invalidar = vi.fn();
    await desativar({ invalidateQueries: invalidar, setQueryData: () => undefined } as never, 'u-1sb', '2026-12-01', 'g1').catch(() => undefined);
    expect(invalidar.mock.calls.map(([o]) => (o as { queryKey: unknown[] }).queryKey[0])).toContain('registro-do-passado');
  });
});
