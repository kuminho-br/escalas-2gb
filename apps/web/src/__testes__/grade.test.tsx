import { QueryClient } from '@tanstack/react-query';
import type { BlocoDaGrade, EfetivoDoDia, GradeDoMes, LinhaDaGrade } from 'contratos';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { escalar } from '@/api/escala-do-mes';
import { desativar } from '@/api/efetivo-do-dia';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Dezembro de 2026 (dia 1 = terça; dia 5 = sábado; dia 8 = feriado de teste). Equipes Alfa (CABO, SD1) e Bravo (BRAVO) e o Adm (ADM).
const MES = '2026-12';
const dia = (n: number) => `${MES}-${String(n).padStart(2, '0')}`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: dia(i + 1), diaDaSemana: (2 + i) % 7, feriado: i + 1 === 8 ? 'Feriado de teste' : null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const JES = { id: 's-jes', nome: 'JES', cor: '#6E56A8', tipo: 'pjes' as const };
const bloco = (servico: typeof PRONTO | typeof JES, letra: string, inicio = '08:00', fim = '20:00'): BlocoDaGrade => ({
  alocacaoId: `a-${servico.nome}-${letra}-${inicio}`, servico, letra, inicio, fim, expediente: false,
});
const EXPEDIENTE: BlocoDaGrade = { alocacaoId: null, servico: null, letra: null, inicio: '08:00', fim: '16:00', expediente: true };
const linha = (nomeGuerra: string, extra: Partial<LinhaDaGrade> = {}): LinhaDaGrade => ({
  militarId: `m-${nomeGuerra}`, posto: 'SD BM', nomeGuerra, matricula: '990001-1', jornada: 'pronto', dias: {}, choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra,
});
const GRADE: GradeDoMes = {
  mes: MES,
  dias: DIAS,
  grupos: [
    {
      chave: 'eq-alfa', nome: 'Alfa',
      linhas: [
        linha('CABO', {
          dias: { [dia(2)]: [bloco(PRONTO, 'A')], [dia(31)]: [bloco(PRONTO, 'B', '20:00', '08:00')] },
          choques: [dia(31)], pjes: 4, diarias: 0, horasTiradas: 24 * 60, horasPedidas: 60 * 60,
        }),
        linha('SD1', { dias: { [dia(5)]: [bloco(PRONTO, 'A'), bloco(JES, 'A', '20:00', '23:00')] }, pjes: 8, diarias: 2, horasTiradas: 90, horasPedidas: 180 }),
      ],
    },
    { chave: 'eq-bravo', nome: 'Bravo', linhas: [linha('BRAVO', { dias: { [dia(8)]: [bloco(JES, 'A')] }, pjes: 2, diarias: 1 })] },
    { chave: 'adm', nome: 'Adm', linhas: [linha('ADM', { jornada: 'adm', dias: { [dia(2)]: [EXPEDIENTE] } })] },
  ],
};
const ROTA = `GET /api/unidades/u-1sb/grade/${MES}`;

function api(grade: GradeDoMes = GRADE) {
  return simularApi({ '/api/eu': { status: 200, corpo: EU_EXEMPLO }, [ROTA]: { status: 200, corpo: grade } });
}
const linhaDe = (nome: string) => screen.getByRole('rowheader', { name: new RegExp(nome) }).closest('tr') as HTMLElement;
const celula = (nome: string, n: number, texto: string) => within(linhaDe(nome)).getByRole('button', { name: `SD BM ${nome}, dia ${n}: ${texto}` });
const larguras = (nome: string) => [...linhaDe(nome).querySelectorAll<HTMLElement>('[data-barra]')].map((b) => b.style.width);

describe('grade geral: a tabela', () => {
  it('mostra os grupos na ordem da API e as linhas com os blocos (letra e cor do serviço)', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect([...document.querySelectorAll('tr[data-grupo]')].map((g) => g.querySelector('strong')?.textContent)).toEqual(['Alfa', 'Bravo', 'Adm']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('CABO'), expect.stringContaining('ADM')]));
    const b = within(celula('CABO', 2, 'Pronto A')).getByText('A');
    expect(b).toHaveStyle({ backgroundColor: '#2F8F5B' });
    // dois serviços no mesmo dia: os dois blocos, na ordem do dia
    const dois = celula('SD1', 5, 'Pronto A, JES A');
    expect(within(dois).getAllByText('A')).toHaveLength(2);
  });

  it('a grade rola dentro da própria caixa, nas duas direções', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const tabela = await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    // o jsdom não calcula "sticky": que o cabeçalho de fato fica à vista ao rolar se confere no navegador
    const caixa = tabela.closest('[data-rolagem="grade"]');
    expect(caixa).not.toBeNull();
    expect(caixa).toHaveClass('overflow-auto', 'max-h-[calc(100dvh-12rem)]');
    expect(caixa).not.toHaveClass('overflow-x-auto');
    // o cabeçalho dos dias e a coluna "Militar" grudam no alto e na esquerda da própria caixa
    expect(screen.getByRole('columnheader', { name: /^Dia 2,/ })).toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('columnheader', { name: 'Militar' })).toHaveClass('sticky', 'top-0', 'left-0');
  });

  it('o grupo mostra o nome e o total, preso à esquerda', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const alfa = document.querySelector<HTMLElement>('tr[data-grupo="eq-alfa"] th[scope="colgroup"] [data-nome-do-grupo]')!;
    expect(alfa).toHaveClass('sticky', 'left-4');
    expect(alfa).toHaveTextContent('Alfa');
    expect(alfa).toHaveTextContent('2 militares');
    expect(alfa.querySelector('strong')).toHaveClass('text-tinta', 'font-bold');
    expect(document.querySelector('tr[data-grupo="eq-bravo"] [data-nome-do-grupo]')).toHaveTextContent('1 militar');
    expect(document.querySelector('tr[data-grupo="eq-bravo"] [data-nome-do-grupo]')).not.toHaveTextContent('1 militares');
  });

  it('a sigla do dia é Dom, Seg…; fim de semana e feriado em vinho, sem fundo, e o feriado com pontinho', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const sabado = await screen.findByRole('columnheader', { name: /^Dia 5, sábado/ });
    expect(within(sabado).getByText('Sáb')).toBeInTheDocument();
    expect(within(sabado).getByText('5')).toHaveClass('text-vinho');
    expect(screen.getByRole('columnheader', { name: /^Dia 1, terça/ })).toHaveTextContent('Ter');
    expect(within(screen.getByRole('columnheader', { name: /^Dia 1, terça/ })).getByText('1')).not.toHaveClass('text-vinho');
    expect(document.querySelectorAll('[class*="F6F7F9"]')).toHaveLength(0);
    expect(sabado).toHaveAttribute('data-fim-de-semana');
    expect(celula('SD1', 5, 'Pronto A, JES A').closest('td')).toHaveAttribute('data-fim-de-semana');
    expect(celula('CABO', 2, 'Pronto A').closest('td')).not.toHaveAttribute('data-fim-de-semana');
    const feriado = screen.getByRole('columnheader', { name: /^Dia 8, terça, feriado: Feriado de teste/ });
    expect(feriado).toHaveAttribute('data-feriado');
    expect(feriado).toHaveAttribute('title', 'Feriado de teste');
    expect(within(feriado).getByText('8')).toHaveClass('text-vinho');
    expect(within(feriado).getByText('8')).not.toHaveClass('text-alerta');
    expect(feriado.querySelector('[data-ponto-feriado]')).not.toBeNull();
    expect(sabado.querySelector('[data-ponto-feriado]')).toBeNull();
  });

  it('segunda-feira abre a semana com uma linha mais forte (mesmo num feriado)', async () => {
    // dia 7 é segunda-feira: aqui ele é feriado, e a linha da semana, o vinho e o pontinho valem juntos (Review Focus 5)
    api({ ...GRADE, dias: DIAS.map((d) => (d.data === dia(7) ? { ...d, feriado: 'Feriado de segunda' } : d.data === dia(8) ? { ...d, feriado: null } : d)) });
    abrir(`/?mes=${MES}`);
    const segunda = await screen.findByRole('columnheader', { name: /^Dia 7, segunda, feriado: Feriado de segunda/ });
    expect(segunda).toHaveClass('border-l-[#C9CED6]');
    expect(within(segunda).getByText('7')).toHaveClass('text-vinho');
    expect(segunda.querySelector('[data-ponto-feriado]')).not.toBeNull();
    expect(celula('CABO', 7, 'sem serviço').closest('td')).toHaveClass('border-l-[#C9CED6]');
    expect(screen.getByRole('columnheader', { name: /^Dia 14, segunda/ })).toHaveClass('border-l-[#C9CED6]');
    expect(screen.getByRole('columnheader', { name: /^Dia 6, domingo/ })).not.toHaveClass('border-l-[#C9CED6]');
    expect(screen.getByRole('columnheader', { name: /^Dia 8, terça/ })).not.toHaveClass('border-l-[#C9CED6]');
    expect(celula('CABO', 8, 'sem serviço').closest('td')).not.toHaveClass('border-l-[#C9CED6]');
  });

  it('o militar aparece com posto e nome na mesma linha e a matrícula embaixo', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const cabeca = screen.getByRole('rowheader', { name: /CABO/ });
    const nome = within(cabeca).getByText('CABO');
    expect(nome.tagName).toBe('STRONG');
    expect(nome.parentElement).toHaveTextContent('SD BM');
    expect(within(cabeca).getByText('990001-1')).toHaveClass('text-xs');
    expect(cabeca).toHaveClass('min-w-[13rem]');
    // o nome acessível da célula não muda
    expect(celula('CABO', 2, 'Pronto A')).toBeInTheDocument();
  });

  it('os blocos têm largura fixa e se espalham por igual', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const dois = celula('SD1', 5, 'Pronto A, JES A');
    expect(dois).toHaveClass('justify-evenly');
    for (const bloco of within(dois).getAllByText('A')) {
      expect(bloco).toHaveClass('w-5', 'shrink-0');
      expect(bloco).not.toHaveClass('flex-1');
    }
  });

  it('a célula com choque tem contorno vermelho e "choque" no nome; o expediente é um bloco sem letra', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const c = await screen.findByRole('button', { name: 'SD BM CABO, dia 31: Pronto B, choque' });
    expect(c).toHaveAttribute('data-choque');
    expect(c).toHaveClass('ring-alerta');
    const exp = celula('ADM', 2, 'expediente');
    expect(exp).toBeInTheDocument();
    expect(within(exp).queryByText(/^[A-C]$/)).toBeNull();
    expect(celula('CABO', 3, 'sem serviço')).not.toHaveAttribute('data-choque');
  });
});

describe('grade geral: a legenda', () => {
  it('traz só os serviços que aparecem, o expediente e o choque', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const legenda = await screen.findByRole('list', { name: 'Legenda' });
    expect(within(legenda).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['JES', 'Pronto', 'Expediente do Adm', 'Choque de horário']);
  });

  it('com o filtro, a legenda acompanha os grupos que aparecem', async () => {
    api();
    abrir(`/?mes=${MES}&equipe=eq-bravo`);
    const legenda = await screen.findByRole('list', { name: 'Legenda' });
    expect(within(legenda).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['JES']);
  });
});

describe('grade geral: as colunas finais', () => {
  it('PJES e Diárias mostram o número com a barra proporcional ao maior da coluna em toda a grade', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table');
    // PJES: máximo 8 (SD1); Diárias: máximo 2 (SD1)
    expect(larguras('CABO')).toEqual(['50%', '0%']);
    expect(larguras('SD1')).toEqual(['100%', '100%']);
    expect(larguras('BRAVO')).toEqual(['25%', '50%']);
    expect(within(linhaDe('CABO')).getByText('4')).toBeInTheDocument();
  });

  it('Voluntariado mostra as horas tiradas de pedidas, e traço quando não há nada', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table');
    expect(within(linhaDe('CABO')).getByText('24h de 60h')).toBeInTheDocument();
    expect(within(linhaDe('SD1')).getByText('1h30 de 3h')).toBeInTheDocument();
    expect(within(linhaDe('BRAVO')).getByText('–')).toBeInTheDocument();
  });
});

describe('grade geral: o filtro de equipes e o clique', () => {
  it('"Bravo" esconde os outros grupos, fica na busca e a barra continua comparando com todo o efetivo', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Bravo' }));
    await waitFor(() => expect((router.state.location.search as { equipe?: string }).equipe).toBe('eq-bravo'));
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.queryByRole('rowheader', { name: /ADM/ })).toBeNull();
    expect(larguras('BRAVO')).toEqual(['25%', '50%']);
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
  });

  it('o filtro vindo do endereço já abre filtrado', async () => {
    api();
    abrir(`/?mes=${MES}&equipe=adm`);
    await screen.findByRole('rowheader', { name: /ADM/ });
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
  });

  it('clicar na célula põe o militar e o dia na busca, e a célula escolhida fica marcada', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'SD BM CABO, dia 2: Pronto A' }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ militar: 'm-CABO', dia: dia(2) }));
    expect(celula('CABO', 2, 'Pronto A')).toHaveAttribute('data-escolhida');
    expect(celula('CABO', 3, 'sem serviço')).not.toHaveAttribute('data-escolhida');
  });

  it('o seletor de mês troca o mês e pede a grade do novo mês', async () => {
    const f = simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      [ROTA]: { status: 200, corpo: GRADE },
      'GET /api/unidades/u-1sb/grade/2027-01': { status: 200, corpo: { ...GRADE, mes: '2027-01', dias: [], grupos: [] } },
    });
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Próximo mês' }));
    await waitFor(() => expect((router.state.location.search as { mes?: string }).mes).toBe('2027-01'));
    await waitFor(() => expect(f.mock.calls.some(([e]) => String(e).endsWith('/grade/2027-01'))).toBe(true));
  });

  it('um filtro de equipe que não existe neste mês é ignorado: a grade aparece inteira (achado da revisão final)', async () => {
    api();
    abrir(`/?mes=${MES}&equipe=equipe-que-sumiu`);
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /ADM/ })).toBeInTheDocument();
  });

  it('o militar comum não consulta a grade e vê uma frase neutra, sem alerta vermelho (achado da revisão final)', async () => {
    const f = simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    abrir(`/?mes=${MES}`);
    expect(await screen.findByText('A grade geral é dos escalantes e gestores.')).toHaveClass('text-apagado');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(f.mock.calls.some(([e]) => String(e).includes('/grade/'))).toBe(false);
  });

  it('mês sem ninguém diz isso', async () => {
    api({ ...GRADE, grupos: [] });
    abrir(`/?mes=${MES}`);
    expect(await screen.findByText('Ninguém para mostrar neste mês.')).toBeInTheDocument();
  });
});

describe('grade geral: as gravações invalidam a grade', () => {
  const ESCALA = { escalaId: 'e1', nome: 'Ordinário', mes: MES, dias: [], resumo: { preenchidas: 0, obrigatorias: 0, obrigatoriasVazias: 0 } };
  const EFETIVO: EfetivoDoDia = { data: dia(2), meta: { origem: 'dia', total: 0, ativadas: 0 }, guarnicoes: [], desativadas: [], cotas: [] };

  it('escalar e desativar uma guarnição marcam a grade como desatualizada', async () => {
    simularApi({
      'POST /api/escalas/e1/alocacoes': { status: 201, corpo: ESCALA },
      [`POST /api/unidades/u-1sb/meta-do-dia/${dia(2)}/desativar`]: { status: 200, corpo: { efetivo: EFETIVO, desfazer: {} } },
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(['grade', 'u-1sb', MES], GRADE);
    await escalar(queryClient, 'e1', { militarId: 'm1', data: dia(2), turnoId: 't1', guarnicaoId: null, funcaoId: null });
    expect(queryClient.getQueryState(['grade', 'u-1sb', MES])!.isInvalidated).toBe(true);
    queryClient.setQueryData(['grade', 'u-1sb', MES], GRADE);
    await desativar(queryClient, 'u-1sb', dia(2), 'g1');
    expect(queryClient.getQueryState(['grade', 'u-1sb', MES])!.isInvalidated).toBe(true);
  });
});
