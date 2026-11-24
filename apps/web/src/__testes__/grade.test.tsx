import { QueryClient } from '@tanstack/react-query';
import type { BlocoDaGrade, EfetivoDoDia, GradeDoMes, LinhaDaGrade } from 'contratos';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { escalar } from '@/api/escala-do-mes';
import { TabelaDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { desativar } from '@/api/efetivo-do-dia';
import { corLegivel } from '@/lib/cores';
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
  militarId: `m-${nomeGuerra}`, posto: 'SD', nomeGuerra, matricula: '990001-1', jornada: 'pronto', dias: {}, choques: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra,
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
const celula = (nome: string, n: number, texto: string) => within(linhaDe(nome)).getByRole('button', { name: `SD ${nome}, dia ${n}: ${texto}` });
const larguras = (nome: string) => [...linhaDe(nome).querySelectorAll<HTMLElement>('[data-barra]')].map((b) => b.style.width);

describe('grade geral: o dia de hoje (N0.4, achado T4)', () => {
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    vi.useRealTimers();
  });
  const comHoje = (data: string) => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(`${data}T15:00:00Z`) });
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    return rolar;
  };

  it('no mês corrente, a coluna de hoje tem aria-current="date" e uma marca visível, e a tabela rola até ela uma vez ao abrir', async () => {
    const rolar = comHoje(dia(10));
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const cab = screen.getByRole('columnheader', { name: /^Dia 10,/ });
    expect(cab).toHaveAttribute('aria-current', 'date');
    // sem a marca visual do dia de hoje (diretriz do usuário, 23/11): o dia continua sendo o atual para o leitor de tela, e a tabela abre rolada até ele
    expect(cab.querySelector('[data-marca-hoje]')).toBeNull();
    expect(screen.getAllByRole('columnheader').filter((h) => h.getAttribute('aria-current') === 'date')).toHaveLength(1);
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    expect(rolar.mock.contexts[0]).toBe(cab);
  });

  it('trocar o filtro de equipes não rola de novo', async () => {
    const rolar = comHoje(dia(10));
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    await userEvent.click(within(screen.getByRole('group', { name: 'Equipes' })).getByRole('button', { name: 'Bravo' }));
    await screen.findByRole('rowheader', { name: /BRAVO/ });
    expect(rolar).toHaveBeenCalledTimes(1);
  });

  it('em outro mês, não há marca nem rolagem', async () => {
    const rolar = comHoje('2027-01-10');
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect(screen.getAllByRole('columnheader').some((h) => h.hasAttribute('aria-current'))).toBe(false);
    expect(document.querySelector('[data-marca-hoje]')).toBeNull();
    expect(rolar).not.toHaveBeenCalled();
  });
});

describe('grade geral: a tabela', () => {
  it('mostra os grupos na ordem da API e as linhas com os blocos (letra e cor do serviço)', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect([...document.querySelectorAll('tr[data-grupo]')].map((g) => g.querySelector('strong')?.textContent)).toEqual(['Alfa', 'Bravo', 'Adm']);
    expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('CABO'), expect.stringContaining('ADM')]));
    const b = within(celula('CABO', 2, 'Pronto A')).getByText('A');
    // a cor do serviço aparece com o contraste de 4,5:1 com o texto (o valor salvo, #2F8F5B, não muda)
    expect(b).toHaveStyle({ backgroundColor: corLegivel('#2F8F5B').fundo });
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
    expect(caixa).toHaveClass('overflow-auto', 'max-h-[calc(100dvh-13rem)]');
    expect(caixa).not.toHaveClass('overflow-x-auto');
    // o cabeçalho dos dias e a coluna "Militar" grudam no alto e na esquerda da própria caixa
    expect(screen.getByRole('columnheader', { name: /^Dia 2,/ })).toHaveClass('sticky', 'top-0');
    expect(screen.getByRole('columnheader', { name: 'Militar' })).toHaveClass('sticky', 'top-0', 'left-0');
  });

  it('a caixa deixa folga para as partes presas, para a célula escolhida não parar debaixo delas (achado da revisão final da 4.4)', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const caixa = (await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' })).closest('[data-rolagem="grade"]');
    // a coluna Militar (13rem) à esquerda, as duas colunas finais (8rem, a partir de 1440px) à direita e o cabeçalho (4rem) em cima
    expect(caixa).toHaveClass('scroll-pl-52', 'scroll-pt-16', 'min-[1440px]:scroll-pr-32');
  });

  it('PJES e Diárias ficam presos à direita em tela larga, e não há coluna Voluntariado', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    expect(screen.queryByRole('columnheader', { name: 'Voluntariado' })).toBeNull();
    // o cabeçalho já gruda em cima em qualquer largura; a borda direita só a partir de 1440px, e as células do corpo grudam junto
    const cabecalhos = ['PJES', 'Diárias'].map((nome) => screen.getByRole('columnheader', { name: nome }));
    const direita = ['min-[1440px]:right-16', 'min-[1440px]:right-0'];
    cabecalhos.forEach((th, i) => expect(th).toHaveClass('sticky', 'top-0', direita[i]!));
    // as duas são as últimas colunas da tabela
    const todos = [...document.querySelectorAll<HTMLElement>('thead th')];
    expect(todos.slice(-2)).toEqual(cabecalhos);
    const finais = [...linhaDe('CABO').querySelectorAll<HTMLElement>('td')].slice(-2);
    finais.forEach((td, i) => expect(td).toHaveClass('min-[1440px]:sticky', direita[i]!, 'bg-superficie'));
    // larguras fixas para as duas empilharem sem sobrepor (4rem + 4rem)
    cabecalhos.forEach((th) => expect(th).toHaveClass('w-16'));
  });

  it('as duas colunas finais têm largura fixa de verdade (min e max iguais), para as presas se empilharem sem se sobrepor', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const finais = [...linhaDe('CABO').querySelectorAll<HTMLElement>('td')].slice(-2);
    ['PJES', 'Diárias'].forEach((nome, i) => {
      expect(screen.getByRole('columnheader', { name: nome })).toHaveClass('w-16', 'min-w-16', 'max-w-16');
      expect(finais[i]).toHaveClass('w-16', 'min-w-16', 'max-w-16');
    });
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
    expect(nome.parentElement).toHaveTextContent('SD');
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

  // [foco 5] a linha do militar e a coluna do dia ficam marcadas com um fundo leve; sair da escolha tira a marca
  it('clicar numa célula marca a linha do militar e a coluna do dia, e escolher outra célula troca a marcação', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: /Grade geral/ });
    expect(document.querySelector('[data-linha-marcada]')).toBeNull();
    expect(document.querySelector('[data-coluna-marcada]')).toBeNull();
    await userEvent.click(celula('CABO', 2, 'Pronto A'));
    await waitFor(() => expect(linhaDe('CABO')).toHaveAttribute('data-linha-marcada'));
    // com o mouse em cima da célula clicada, a marca da linha não some: a linha marcada não tem o fundo de "passar o mouse", que cobriria a marca
    expect(linhaDe('CABO')).not.toHaveClass('hover:bg-black/[0.03]');
    expect(linhaDe('CABO')).toHaveClass('bg-vinho/[0.06]');
    expect(screen.getByRole('rowheader', { name: /CABO/ })).not.toHaveClass('group-hover:bg-[#F7F7F8]');
    // as outras linhas seguem com o fundo de passar o mouse
    expect(linhaDe('SD1')).toHaveClass('hover:bg-black/[0.03]');
    expect(screen.getByRole('rowheader', { name: /SD1/ })).toHaveClass('group-hover:bg-[#F7F7F8]');
    // só a linha do CABO; só a coluna do dia 2, em todas as linhas (e no cabeçalho do dia)
    expect(document.querySelectorAll('[data-linha-marcada]')).toHaveLength(1);
    const colunaMarcada = [...document.querySelectorAll('[data-coluna-marcada]')];
    expect(colunaMarcada.length).toBeGreaterThanOrEqual(4);
    expect(colunaMarcada.every((c) => c.getAttribute('data-coluna') === dia(2))).toBe(true);
    expect(within(linhaDe('SD1')).getAllByRole('button').find((b) => b.getAttribute('data-data') === dia(2))!.closest('td')).toHaveAttribute('data-coluna-marcada');
    // outra célula: a marcação vai junto
    await userEvent.click(celula('SD1', 5, 'Pronto A, JES A'));
    await waitFor(() => expect(linhaDe('SD1')).toHaveAttribute('data-linha-marcada'));
    expect(linhaDe('CABO')).not.toHaveAttribute('data-linha-marcada');
    expect(document.querySelectorAll('[data-linha-marcada]')).toHaveLength(1);
    expect([...document.querySelectorAll('[data-coluna-marcada]')].every((c) => c.getAttribute('data-coluna') === dia(5))).toBe(true);
  });

  it('uma grade sem linhas ou sem colunas não quebra com uma célula escolhida (Review Focus 5)', () => {
    const escolhida = { militarId: 'm-CABO', dia: dia(2) };
    const maximos = { pjes: 0, diarias: 0 };
    const semLinhas = render(<TabelaDaGrade grade={{ ...GRADE, grupos: [] }} grupos={[]} maximos={maximos} escolhida={escolhida} aoEscolher={() => {}} recolhidas={new Set()} aoAlternar={() => {}} />);
    expect(semLinhas.container.querySelector('[data-linha-marcada]')).toBeNull();
    // o dia escolhido não está nas colunas (a grade do mês não tem nenhum dia): nada é marcado e nada quebra
    const semDias = render(<TabelaDaGrade grade={{ ...GRADE, dias: [] }} grupos={GRADE.grupos} maximos={maximos} escolhida={escolhida} aoEscolher={() => {}} recolhidas={new Set()} aoAlternar={() => {}} />);
    expect(semDias.container.querySelector('[data-coluna-marcada]')).toBeNull();
    expect(semDias.container.querySelector('[data-linha-marcada]')).not.toBeNull();
    // militar que não está na grade: nenhuma linha marcada
    const semMilitar = render(<TabelaDaGrade grade={GRADE} grupos={GRADE.grupos} maximos={maximos} escolhida={{ militarId: 'm-NINGUEM', dia: dia(2) }} aoEscolher={() => {}} recolhidas={new Set()} aoAlternar={() => {}} />);
    expect(semMilitar.container.querySelector('[data-linha-marcada]')).toBeNull();
    expect(semMilitar.container.querySelector('[data-coluna-marcada]')).not.toBeNull();
  });

  it('a célula escolhida com choque mantém o contorno vermelho e ganha o fundo da escolhida', async () => {
    api();
    abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'SD CABO, dia 31: Pronto B, choque' }));
    const c = await screen.findByRole('button', { name: 'SD CABO, dia 31: Pronto B, choque' });
    await waitFor(() => expect(c).toHaveAttribute('data-escolhida'));
    expect(c).toHaveAttribute('data-choque');
    expect(c).toHaveClass('ring-alerta', 'bg-vinho/15');
    expect(c).not.toHaveClass('ring-vinho');
  });

  it('a célula com choque tem contorno vermelho e "choque" no nome; o expediente é um bloco sem letra', async () => {
    api();
    abrir(`/?mes=${MES}`);
    const c = await screen.findByRole('button', { name: 'SD CABO, dia 31: Pronto B, choque' });
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
});

describe('a cota de saldo na Grade geral (6.38)', () => {
  it('a linha do Adm traz a barra da cota na frente da matrícula, com o leitor de tela dizendo "{n} de {total} saldos no mês"; a do Pronto não tem barra', async () => {
    const g: GradeDoMes = {
      ...GRADE,
      grupos: [
        { chave: 'eq-alfa', nome: 'Alfa', linhas: [linha('CABO')] },
        { chave: 'adm', nome: 'Adm', linhas: [linha('ADM', { jornada: 'adm', saldos: { feitos: 2, total: 6 } }), linha('SOBRA', { jornada: 'adm', saldos: { feitos: 7, total: 6 } })] },
      ],
    };
    api(g);
    abrir(`/?mes=${MES}`);
    await screen.findByRole('table', { name: 'Grade geral de dezembro de 2026' });
    const barra = within(linhaDe('ADM')).getByRole('img', { name: '2 de 6 saldos no mês' });
    // na frente da matrícula: a barra é a primeira coisa da linha da matrícula
    const matricula = within(linhaDe('ADM')).getByText('990001-1');
    expect(matricula.firstElementChild).toBe(barra);
    expect(within(linhaDe('SOBRA')).getByRole('img', { name: '7 de 6 saldos no mês' })).toHaveAttribute('data-estado', 'acima');
    expect(within(linhaDe('CABO')).queryByRole('img')).toBeNull();
  });
});

describe('grade geral: o filtro de equipes e o clique', () => {
  it('"Bravo" esconde os outros grupos, fica na busca e a barra continua comparando com todo o efetivo', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Bravo' }));
    await waitFor(() => expect((router.state.location.search as { equipes?: string[] }).equipes).toEqual(['eq-bravo']));
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.queryByRole('rowheader', { name: /ADM/ })).toBeNull();
    expect(larguras('BRAVO')).toEqual(['25%', '50%']);
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
  });

  it('o filtro vindo do endereço já abre filtrado', async () => {
    api();
    abrir(`/?mes=${MES}&equipes=${encodeURIComponent('["adm"]')}`);
    await screen.findByRole('rowheader', { name: /ADM/ });
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adm' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('o endereço antigo ?equipe=bravo continua filtrando', async () => {
    api();
    abrir(`/?mes=${MES}&equipe=eq-bravo`);
    await screen.findByRole('rowheader', { name: /BRAVO/ });
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ligar Alfa e Bravo mostra as duas; "Todas" limpa a seleção', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Alfa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bravo' }));
    await waitFor(() => expect((router.state.location.search as { equipes?: string[] }).equipes).toEqual(['eq-alfa', 'eq-bravo']));
    expect(screen.getByRole('button', { name: 'Alfa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /BRAVO/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /ADM/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }));
    await waitFor(() => expect((router.state.location.search as { equipes?: string[] }).equipes).toBeUndefined());
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('rowheader', { name: /ADM/ })).toBeInTheDocument();
  });

  it('ligar todas uma a uma volta para "Todas"', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    for (const nome of ['Alfa', 'Bravo', 'Adm']) await userEvent.click(await screen.findByRole('button', { name: nome }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true'));
    expect((router.state.location.search as { equipes?: string[] }).equipes).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Alfa' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('desligar a última equipe ligada volta para "Todas" (Review Focus 2)', async () => {
    api();
    const router = abrir(`/?mes=${MES}&equipes=${encodeURIComponent('["eq-bravo"]')}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Bravo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true'));
    expect((router.state.location.search as { equipes?: string[] }).equipes).toBeUndefined();
    // nunca deixa a grade vazia
    expect(screen.getByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
  });

  it('equipes que não existem no mês são descartadas (Review Focus 1)', async () => {
    api();
    abrir(`/?mes=${MES}&equipes=${encodeURIComponent('["fantasma","eq-bravo"]')}`);
    await screen.findByRole('rowheader', { name: /BRAVO/ });
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Bravo' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('só equipes que não existem vale como "Todas"', async () => {
    api();
    abrir(`/?mes=${MES}&equipes=${encodeURIComponent('["fantasma"]')}`);
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /ADM/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
  });

  describe('a busca por nome', () => {
    const COM_NOMES: GradeDoMes = {
      ...GRADE,
      grupos: [
        { chave: 'eq-alfa', nome: 'Alfa', linhas: [linha('JOÃO', { matricula: '990042-7' }), linha('CABO', { matricula: '990001-1' })] },
        { chave: 'eq-bravo', nome: 'Bravo', linhas: [linha('BRAVO', { matricula: '990077-3' })] },
      ],
    };

    it('a busca filtra pelo nome de guerra ou pela matrícula, sem acento e sem maiúscula', async () => {
      api(COM_NOMES);
      const router = abrir(`/?mes=${MES}`);
      const campo = await screen.findByLabelText('Buscar militar');
      await userEvent.type(campo, 'joao');
      await waitFor(() => expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull());
      expect(screen.getByRole('rowheader', { name: /JOÃO/ })).toBeInTheDocument();
      // o grupo que fica sem ninguém some
      expect(document.querySelector('tr[data-grupo="eq-bravo"]')).toBeNull();
      await waitFor(() => expect(router.state.location.search).toMatchObject({ busca: 'joao' }));
      // pela matrícula (parte dela)
      await userEvent.clear(campo);
      await userEvent.type(campo, '0077');
      expect(await screen.findByRole('rowheader', { name: /BRAVO/ })).toBeInTheDocument();
      expect(screen.queryByRole('rowheader', { name: /JOÃO/ })).toBeNull();
    });

    it('a matrícula é comparada só pelos dígitos: com e sem hífen acham o mesmo militar (Review Focus 4)', async () => {
      api(COM_NOMES);
      abrir(`/?mes=${MES}`);
      const campo = await screen.findByLabelText('Buscar militar');
      for (const digitado of ['9900427', '990042-7', '990042', '0042-7']) {
        await userEvent.clear(campo);
        await userEvent.type(campo, digitado);
        expect(await screen.findByRole('rowheader', { name: /JOÃO/ })).toBeInTheDocument();
        expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
      }
      // letras e números juntos ("a1") não são uma matrícula: não casam com a matrícula de ninguém por acaso
      await userEvent.clear(campo);
      await userEvent.type(campo, 'cabo1');
      expect(await screen.findByText('Ninguém com esse nome nas equipes escolhidas.')).toBeInTheDocument();
    });

    it('a busca do endereço já abre filtrada e o campo mostra o texto', async () => {
      api(COM_NOMES);
      abrir(`/?mes=${MES}&busca=cabo`);
      expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
      expect(screen.queryByRole('rowheader', { name: /JOÃO/ })).toBeNull();
      expect(screen.getByLabelText('Buscar militar')).toHaveValue('cabo');
    });

    it('busca e equipes valem juntas', async () => {
      api(COM_NOMES);
      abrir(`/?mes=${MES}&equipes=${encodeURIComponent('["eq-bravo"]')}`);
      await userEvent.type(await screen.findByLabelText('Buscar militar'), 'joao');
      expect(await screen.findByText('Ninguém com esse nome nas equipes escolhidas.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
    });
  });

  it('clicar na célula põe o militar e o dia na busca, e a célula escolhida fica marcada', async () => {
    api();
    const router = abrir(`/?mes=${MES}`);
    await userEvent.click(await screen.findByRole('button', { name: 'SD CABO, dia 2: Pronto A' }));
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

  it('o militar comum não chega à grade: vai para o início com o aviso e nada é consultado', async () => {
    const f = simularApi({ '/api/eu': { status: 200, corpo: { ...EU_EXEMPLO, papeis: [] } } });
    const router = abrir(`/grade?mes=${MES}`);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
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

describe('grade geral: recolher e mostrar a equipe', () => {
  const nomeDaEquipe = (chave: string) => within(document.querySelector<HTMLElement>(`tr[data-grupo="${chave}"]`)!).getByRole('button');

  it('clicar no nome da equipe esconde e mostra os militares dela', async () => {
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('rowheader', { name: /CABO/ });
    const botao = nomeDaEquipe('eq-alfa');
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(botao);
    expect(nomeDaEquipe('eq-alfa')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(screen.queryByRole('rowheader', { name: /SD1/ })).toBeNull();
    // as outras equipes continuam
    expect(screen.getByRole('rowheader', { name: /BRAVO/ })).toBeInTheDocument();
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
  });

  it('a faixa mostra quantos militares a equipe tem, aberta ou recolhida', async () => {
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('rowheader', { name: /CABO/ });
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    expect(document.querySelector('tr[data-grupo="eq-alfa"] [data-nome-do-grupo]')).toHaveTextContent('2 militares');
  });

  it('com busca, a equipe com resultado aparece aberta', async () => {
    api();
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('rowheader', { name: /CABO/ });
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    await userEvent.type(screen.getByLabelText('Buscar militar'), 'cabo');
    expect(await screen.findByRole('rowheader', { name: /CABO/ })).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar militar'));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull());
  });

  it('recolher a equipe do militar escolhido não fecha o painel do dia, e abrir mostra a linha marcada', async () => {
    api();
    const router = abrir(`/grade?mes=${MES}&militar=m-CABO&dia=${dia(2)}`);
    await screen.findByRole('rowheader', { name: /CABO/ });
    expect(document.querySelector('[data-linha-marcada]')).not.toBeNull();
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
    expect(router.state.location.search).toMatchObject({ militar: 'm-CABO', dia: dia(2) });
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    await screen.findByRole('rowheader', { name: /CABO/ });
    expect(document.querySelector('tr[data-militar="m-CABO"]')).toHaveAttribute('data-linha-marcada');
  });

  it('trocar de mês mantém as equipes recolhidas', async () => {
    simularApi({
      '/api/eu': { status: 200, corpo: EU_EXEMPLO },
      [ROTA]: { status: 200, corpo: GRADE },
      'GET /api/unidades/u-1sb/grade/2027-01': { status: 200, corpo: { ...GRADE, mes: '2027-01', dias: [] } },
    });
    abrir(`/grade?mes=${MES}`);
    await screen.findByRole('rowheader', { name: /CABO/ });
    await userEvent.click(nomeDaEquipe('eq-alfa'));
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    await screen.findByRole('table', { name: 'Grade geral de janeiro de 2027' });
    expect(nomeDaEquipe('eq-alfa')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('rowheader', { name: /CABO/ })).toBeNull();
  });
});
