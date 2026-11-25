import type { MeuServico, MinhaEscala } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { somarMeses } from 'contratos';
import { mesAtual } from '@/lib/meses';
import { abrir, chamadasA, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 7.5, Task 1: a Minha escala. O militar comum (sem nível de acesso). Dados fictícios (D7).
const MES = mesAtual();
const COMUM = { ...EU_EXEMPLO, papeis: [] };
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const servico = (id: string, d: number, extra: Partial<MeuServico> = {}): MeuServico => ({
  alocacaoId: id, data: dia(d), inicio: '08:00', fim: '20:00', servico: 'Pronto', escala: 'Ordinário', unidadeSigla: '1ª SB', unidadeId: 'u-1sb', estado: 'publicada', emRetificacao: false, guarnicao: 'ABT', funcao: 'Combatente',
  composicao: [{ patente: 'SD', nomeGuerra: 'ANDRADE', funcao: 'Combatente', eu: true }, { patente: '3º SGT', nomeGuerra: 'COLEGA', funcao: 'Motorista', eu: false }], ...extra,
});
const ROTA = `GET /api/eu/escala/${MES}`;

function api(servicos: MeuServico[], eu: unknown = COMUM) {
  return simularApi({ '/api/eu': { status: 200, corpo: eu }, [ROTA]: { status: 200, corpo: { mes: MES, servicos } satisfies MinhaEscala } });
}
const secaoDoDia = (n: number) => screen.findByRole('region', { name: `Dia ${n}` });

describe('a Minha escala (7.5)', () => {
  it('mostra o mês com as setas e os serviços por dia: horário, serviço, escala e unidade, estado, guarnição e função, e a composição com "Você" no próprio', async () => {
    api([servico('a1', 6, { estado: 'previa' })]);
    abrir('/minha-escala');
    expect(await screen.findByRole('heading', { name: 'Minha escala' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
    const d = within(await secaoDoDia(6));
    expect(d.getByText('08:00 às 20:00')).toBeInTheDocument();
    expect(d.getByText('Pronto')).toBeInTheDocument();
    expect(d.getByText(/Ordinário · 1ª SB/)).toBeInTheDocument();
    expect(d.getByText('Prévia')).toBeInTheDocument();
    expect(d.getByText(/Pode mudar até o dia do serviço\./)).toBeInTheDocument();
    expect(d.getByText('ABT · Combatente')).toBeInTheDocument();
    const comp = within(d.getByRole('list', { name: 'Quem compõe ABT' }));
    expect(comp.getByText('Você')).toBeInTheDocument();
    expect(comp.queryByText('ANDRADE')).toBeNull();
    expect(comp.getByText('COLEGA')).toBeInTheDocument();
    expect(comp.getByText('3º SGT')).toBeInTheDocument();
    expect(comp.getByText('Motorista')).toBeInTheDocument();
  });

  it('o estado de cada serviço: Publicada, Retificada, Remessada e a etiqueta "Escala em retificação"', async () => {
    api([servico('a1', 6), servico('a2', 7, { estado: 'retificada' }), servico('a3', 8, { estado: 'remessada' }), servico('a4', 9, { estado: 'publicada', emRetificacao: true })]);
    abrir('/minha-escala');
    expect(within(await secaoDoDia(6)).getByText('Publicada')).toBeInTheDocument();
    expect(within(await secaoDoDia(7)).getByText('Retificada')).toBeInTheDocument();
    expect(within(await secaoDoDia(8)).getByText('Remessada')).toBeInTheDocument();
    expect(within(await secaoDoDia(9)).getByText('Escala em retificação')).toBeInTheDocument();
    expect(within(await secaoDoDia(6)).queryByText(/Pode mudar até/)).toBeNull();
  });

  it('o vazio tem o texto fixo', async () => {
    api([]);
    abrir('/minha-escala');
    expect(await screen.findByText(/^Você não tem serviço em .+ nas escalas que já foram abertas\.$/)).toBeInTheDocument();
  });

  it('Review Focus 1: o serviço que passa da meia-noite fica no dia em que começa, com "até 08:00 do dia seguinte"', async () => {
    api([servico('a1', 10, { inicio: '20:00', fim: '08:00' })]);
    abrir('/minha-escala');
    expect(within(await secaoDoDia(10)).getByText('20:00 até 08:00 do dia seguinte')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dia 11' })).toBeNull();
  });

  it('6.53: o serviço que termina à meia-noite diz "às 24:00" (e o que passa da meia-noite continua "até 08:00 do dia seguinte")', async () => {
    api([servico('a1', 10, { inicio: '16:00', fim: '00:00' }), servico('a2', 11, { inicio: '20:00', fim: '08:00' })]);
    abrir('/minha-escala');
    expect(within(await secaoDoDia(10)).getByText('16:00 às 24:00')).toBeInTheDocument();
    expect(within(await secaoDoDia(11)).getByText('20:00 até 08:00 do dia seguinte')).toBeInTheDocument();
  });

  it('6.53: duas unidades de mesma sigla no mês mostram a unidade de cima ("1ª SB, em DivOp"); com a sigla sem repetir, só a sigla', async () => {
    const f = api([servico('a1', 6), servico('a2', 7, { unidadeId: 'u-1sb-3gb' }), servico('a3', 8, { unidadeSigla: 'DA', unidadeId: 'u-da' })]);
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, i) => (String(e).endsWith('/api/consulta/unidades')
      ? new Response(JSON.stringify([
        { id: 'u-gb', sigla: '2º GB', nivel: 3, maeId: null }, { id: 'u-3gb', sigla: '3º GB', nivel: 3, maeId: null }, { id: 'u-divop', sigla: 'DivOp', nivel: 4, maeId: 'u-gb' }, { id: 'u-da', sigla: 'DA', nivel: 4, maeId: 'u-gb' },
        { id: 'u-1sb', sigla: '1ª SB', nivel: 5, maeId: 'u-divop' }, { id: 'u-1sb-3gb', sigla: '1ª SB', nivel: 4, maeId: 'u-3gb' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : padrao(e, i)));
    abrir('/minha-escala');
    expect(await within(await secaoDoDia(6)).findByText(/Ordinário · 1ª SB, em DivOp/)).toBeInTheDocument();
    expect(within(await secaoDoDia(7)).getByText(/Ordinário · 1ª SB, em 3º GB/)).toBeInTheDocument();
    expect(within(await secaoDoDia(8)).getByText(/Ordinário · DA$/)).toBeInTheDocument();
  });

  it('Review Focus 2: dois serviços no mesmo dia aparecem os dois, em ordem de hora', async () => {
    api([servico('a1', 12, { inicio: '08:00', fim: '16:00', servico: 'Expediente' }), servico('a2', 12, { inicio: '20:00', fim: '08:00', servico: 'Pronto' })]);
    abrir('/minha-escala');
    const d = within(await secaoDoDia(12));
    const itens = d.getAllByRole('listitem').filter((li) => /Expediente|Pronto/.test(li.textContent ?? '') && li.querySelector('.font-cond'));
    expect(itens[0]).toHaveTextContent('Expediente');
    expect(itens[1]).toHaveTextContent('Pronto');
  });

  it('Review Focus 3: o serviço sem guarnição (só no turno) aparece sem a composição, com "Guarnição a definir"', async () => {
    api([servico('a1', 14, { guarnicao: null, funcao: null, composicao: [] })]);
    abrir('/minha-escala');
    const d = within(await secaoDoDia(14));
    expect(d.getByText('Guarnição a definir')).toBeInTheDocument();
    expect(d.queryByRole('list', { name: /Quem compõe/ })).toBeNull();
  });

  it('Review Focus 5: é uma lista por dia, sem tabela', async () => {
    api([servico('a1', 6), servico('a2', 7)]);
    abrir('/minha-escala');
    await secaoDoDia(6);
    expect(document.querySelector('table')).toBeNull();
    expect(screen.getAllByRole('region').filter((r) => /^Dia \d+$/.test(r.getAttribute('aria-label') ?? ''))).toHaveLength(2);
  });

  it('as setas trocam o mês e a tela pede o mês novo', async () => {
    const f = api([servico('a1', 6)]);
    const seguinte = somarMeses(MES, 1);
    const padrao = f.getMockImplementation()!;
    f.mockImplementation(async (e, i) => (String(e).includes(`/api/eu/escala/${seguinte}`) ? new Response(JSON.stringify({ mes: seguinte, servicos: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) : padrao(e, i)));
    abrir('/minha-escala');
    await secaoDoDia(6);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(await screen.findByText(/^Você não tem serviço em/)).toBeInTheDocument();
    expect(chamadasA(f, `GET /api/eu/escala/${seguinte}`)).toBe(1);
  });

  it('o trilho do módulo tem Minha escala, Meu voluntariado e Escalas', async () => {
    api([]);
    abrir('/minha-escala');
    await screen.findByRole('heading', { name: 'Minha escala' });
    const trilho = within(screen.getByRole('navigation', { name: 'Navegação principal' }));
    expect(trilho.getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Minha escala', 'Meu voluntariado', 'Escalas']);
    expect(trilho.getByRole('link', { name: 'Minha escala' })).toHaveAttribute('aria-current', 'page');
  });
});
