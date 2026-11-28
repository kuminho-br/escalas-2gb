import { render, screen, within } from '@testing-library/react';
import type { AfastamentoNaGrade, BlocoDaGrade, GradeDoMes, LinhaDaGrade } from 'contratos';
import { describe, expect, it } from 'vitest';
import { CelulaDaGrade, nomeDaCelula } from '@/componentes/grade/CelulaDaGrade';
import { LegendaDaGrade } from '@/componentes/grade/LegendaDaGrade';
import { TabelaDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { afastadoNoMesTodo, afastamentoDoDia, dicaDoAfastamento } from '@/lib/afastamento-na-grade';
import { estiloDaCor } from '@/lib/cores';

// O afastado, o fim de semana e a legenda na Grade (6.70, Task 3). Dados fictícios (D7).
const af = (tipo: string, inicio: string, fim: string, inicioReal = inicio, fimReal = fim): AfastamentoNaGrade => ({ tipo, inicio, fim, inicioReal, fimReal });
const d = (n: number) => `2026-12-${String(n).padStart(2, '0')}`;
const DIAS_DO_MES = Array.from({ length: 31 }, (_, i) => d(i + 1));

describe('afastamentoDoDia', () => {
  const lista = [af('Férias', d(10), d(12), d(10), d(19)), af('LTS', d(20), d(22))];

  it('o dia dentro do período diz o tipo, se começa e se termina ali, e o período inteiro', () => {
    expect(afastamentoDoDia(lista, d(10))).toEqual({ tipo: 'Férias', comeca: true, termina: false, inicioReal: d(10), fimReal: d(19) });
    expect(afastamentoDoDia(lista, d(11))).toEqual({ tipo: 'Férias', comeca: false, termina: false, inicioReal: d(10), fimReal: d(19) });
    expect(afastamentoDoDia(lista, d(12))).toMatchObject({ comeca: false, termina: true });
  });

  it('o período de um dia só começa e termina nele', () => {
    expect(afastamentoDoDia([af('Curso', d(5), d(5))], d(5))).toMatchObject({ comeca: true, termina: true });
  });

  it('fora de qualquer período, null', () => {
    expect(afastamentoDoDia(lista, d(13))).toBeNull();
    expect(afastamentoDoDia([], d(1))).toBeNull();
  });
});

describe('afastadoNoMesTodo', () => {
  it('só é verdade com todos os dias do mês cobertos (juntando períodos seguidos)', () => {
    expect(afastadoNoMesTodo([af('LTS', d(1), d(31), '2026-11-15', '2027-01-15')], DIAS_DO_MES)).toBe(true);
    expect(afastadoNoMesTodo([af('LTS', d(1), d(15)), af('LTS', d(16), d(31))], DIAS_DO_MES)).toBe(true);
    expect(afastadoNoMesTodo([af('Férias', d(2), d(31))], DIAS_DO_MES)).toBe(false);
    expect(afastadoNoMesTodo([af('Férias', d(1), d(14)), af('Férias', d(16), d(31))], DIAS_DO_MES)).toBe(false);
    expect(afastadoNoMesTodo([], DIAS_DO_MES)).toBe(false);
  });
});

describe('dicaDoAfastamento', () => {
  it('no mesmo mês: "Férias: 10 a 19/12"', () => {
    expect(dicaDoAfastamento(af('Férias', d(10), d(12), d(10), d(19)))).toBe('Férias: 10 a 19/12');
  });

  it('o período inteiro, também quando atravessa o mês: "Licença: 28/11 a 6/12"', () => {
    expect(dicaDoAfastamento(af('Licença', d(1), d(6), '2026-11-28', d(6)))).toBe('Licença: 28/11 a 6/12');
  });

  it('com o ano diferente, o ano aparece nas duas datas', () => {
    expect(dicaDoAfastamento(af('LTS', d(1), d(31), '2026-11-15', '2027-01-15'))).toBe('LTS: 15/11/2026 a 15/1/2027');
  });
});

const bloco = (cor: string, letra: string, nome = 'Pronto'): BlocoDaGrade => ({ alocacaoId: `a-${nome}-${letra}`, servico: { id: `s-${nome}`, nome, cor, tipo: 'ordinario' }, letra, inicio: '08:00', fim: '20:00' });
const linha = (nomeGuerra: string, extra: Partial<LinhaDaGrade> = {}): LinhaDaGrade => ({
  militarId: `m-${nomeGuerra}`, posto: 'SD', nomeGuerra, matricula: '997001-1', jornada: 'pronto', dias: {}, choques: [], afastamentos: [], pjes: 0, diarias: 0, horasTiradas: 0, horasPedidas: 0, ...extra,
});

describe('nomeDaCelula', () => {
  it('termina com o afastamento: ", afastado: Férias"', () => {
    expect(nomeDaCelula({ posto: 'SD', nomeGuerra: 'ALFA' }, 12, [], false, 'Férias')).toBe('SD ALFA, dia 12: sem serviço, afastado: Férias');
    expect(nomeDaCelula({ posto: 'SD', nomeGuerra: 'ALFA' }, 12, [bloco('#2F8F5B', 'A')], true, 'Férias')).toBe('SD ALFA, dia 12: Pronto A, choque, afastado: Férias');
    expect(nomeDaCelula({ posto: 'SD', nomeGuerra: 'ALFA' }, 12, [], false)).toBe('SD ALFA, dia 12: sem serviço');
  });
});

describe('a célula do dia afastado', () => {
  const l = linha('ALFA');
  const celula = (extra: Partial<Parameters<typeof CelulaDaGrade>[0]> = {}) =>
    render(<CelulaDaGrade linha={l} dia={11} data={d(11)} blocos={[]} choque={false} escolhida={false} aoEscolher={() => undefined} {...extra} />).container.querySelector('button')!;
  const feriasDe10a19 = { tipo: 'Férias', comeca: false, termina: false, inicioReal: d(10), fimReal: d(19) };

  it('cada célula é uma camada isolada: o quadrinho e o rótulo (z-10) não passam por cima da coluna do nome presa quando a tabela rola de lado', () => {
    const b = celula({ afastado: { ...feriasDe10a19, comeca: true } });
    expect(b.className).toContain('isolate');
  });

  it('tem o tracejado (data-afastado, aria-hidden), a dica com o período inteiro e o nome acessível com o afastamento', () => {
    const b = celula({ afastado: feriasDe10a19 });
    expect(b).toHaveAttribute('data-afastado');
    expect(b).toHaveAttribute('title', 'Férias: 10 a 19/12');
    expect(b).toHaveAccessibleName('SD ALFA, dia 11: sem serviço, afastado: Férias');
    const traco = b.querySelector('[data-traco-do-afastado]')!;
    expect(traco).toHaveAttribute('aria-hidden', 'true');
    expect(traco.className).toContain('afastado-traco');
  });

  it('o primeiro dia do período escreve o tipo (na cor pendencia), e os outros dias não', () => {
    const primeiro = celula({ afastado: { ...feriasDe10a19, comeca: true } });
    const rotulo = primeiro.querySelector('[data-rotulo-do-afastado]')!;
    expect(rotulo).toHaveTextContent('Férias');
    expect(rotulo.className).toContain('text-pendencia');
    expect(celula({ afastado: feriasDe10a19 }).querySelector('[data-rotulo-do-afastado]')).toBeNull();
  });

  it('o traço marca onde o período começa e termina (as pontas), e continua entre os dias', () => {
    const traco = (a: Partial<typeof feriasDe10a19> & { comeca?: boolean; termina?: boolean }) => celula({ afastado: { ...feriasDe10a19, ...a } }).querySelector('[data-traco-do-afastado]')!;
    expect(traco({ comeca: true })).toHaveAttribute('data-comeca');
    expect(traco({ termina: true })).toHaveAttribute('data-termina');
    expect(traco({})).not.toHaveAttribute('data-comeca');
    expect(traco({})).not.toHaveAttribute('data-termina');
  });

  it('Review Focus 2: com serviço, a letra continua no DOM e o traço vem antes (fica atrás dos quadrados)', () => {
    const b = celula({ afastado: feriasDe10a19, blocos: [bloco('#2F8F5B', 'A')] });
    const traco = b.querySelector('[data-traco-do-afastado]')!;
    const quadrado = within(b).getByText('A');
    expect(traco.compareDocumentPosition(quadrado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(quadrado.className).toContain('relative');
  });

  it('Review Focus 2: com choque, o contorno do choque continua (e vem por cima do traço)', () => {
    const b = celula({ afastado: feriasDe10a19, choque: true });
    expect(b).toHaveAttribute('data-choque');
    expect(b.className).toContain('after:ring-alerta');
  });

  it('sem afastamento, nada disso', () => {
    const b = celula();
    expect(b).not.toHaveAttribute('data-afastado');
    expect(b).not.toHaveAttribute('title');
    expect(b.querySelector('[data-traco-do-afastado]')).toBeNull();
  });
});

const GRADE: GradeDoMes = {
  mes: '2026-12',
  dias: DIAS_DO_MES.map((data, i) => ({ data, diaDaSemana: (2 + i) % 7, feriado: data === d(8) ? 'Feriado de teste' : null })),
  grupos: [{
    chave: 'a', nome: 'Alfa',
    linhas: [
      linha('PARTE', { afastamentos: [af('Férias', d(10), d(12), d(10), d(19))] }),
      linha('MESTODO', { afastamentos: [af('LTS', d(1), d(31), '2026-11-15', '2027-01-15')] }),
      linha('LIVRE', { dias: { [d(5)]: [bloco('#2F8F5B', 'A')] } }),
    ],
  }],
};
const tabela = () =>
  render(<TabelaDaGrade grade={GRADE} grupos={GRADE.grupos} maximos={{ pjes: 0, diarias: 0 }} escolhida={null} aoEscolher={() => undefined} recolhidas={new Set()} aoAlternar={() => undefined} />);
const linhaDe = (nome: string) => document.querySelector<HTMLElement>(`tr[data-militar="m-${nome}"]`)!;

describe('o afastado na tabela', () => {
  it('as células dos dias do período têm o tracejado, com as pontas certas, e só o primeiro escreve o tipo', () => {
    tabela();
    const dia = (n: number) => linhaDe('PARTE').querySelector<HTMLElement>(`[data-data="${d(n)}"]`)!;
    expect(dia(9)).not.toHaveAttribute('data-afastado');
    expect(dia(10).querySelector('[data-traco-do-afastado]')).toHaveAttribute('data-comeca');
    expect(dia(10).querySelector('[data-rotulo-do-afastado]')).toHaveTextContent('Férias');
    expect(dia(11).querySelector('[data-traco-do-afastado]')).not.toHaveAttribute('data-comeca');
    expect(dia(11).querySelector('[data-rotulo-do-afastado]')).toBeNull();
    expect(dia(12).querySelector('[data-traco-do-afastado]')).toHaveAttribute('data-termina');
    expect(dia(13)).not.toHaveAttribute('data-afastado');
    // a dica é o período inteiro, mesmo com a marca só até o dia 12
    expect(dia(11)).toHaveAttribute('title', 'Férias: 10 a 19/12');
  });

  it('o militar afastado o mês todo tem o nome em tom apagado; afastado só em parte, não', () => {
    tabela();
    expect(linhaDe('MESTODO').querySelector('th')).toHaveAttribute('data-afastado-o-mes-todo');
    expect(linhaDe('MESTODO').querySelector('th strong')!.className).toContain('text-apagado');
    expect(linhaDe('PARTE').querySelector('th')).not.toHaveAttribute('data-afastado-o-mes-todo');
    expect(linhaDe('PARTE').querySelector('th strong')!.className).not.toContain('text-apagado');
  });
});

describe('o fim de semana e o feriado', () => {
  it('a coluna do fim de semana e do feriado não tem fundo (6.73), e o feriado leva o ponto vinho', () => {
    tabela();
    // dia 5 é sábado (2026-12-05); dia 6, domingo; dia 8, feriado numa terça
    for (const n of [5, 6, 8]) {
      const celulaDoCorpo = linhaDe('LIVRE').querySelector<HTMLElement>(`td[data-coluna="${d(n)}"]`)!;
      expect(celulaDoCorpo.className, `dia ${n}`).not.toContain('bg-passa');
      expect(document.querySelector(`th[data-coluna="${d(n)}"]`)!.className, `cabeçalho do dia ${n}`).not.toContain('bg-passa');
    }
    expect(linhaDe('LIVRE').querySelector(`td[data-coluna="${d(8)}"]`)).toHaveAttribute('data-feriado');
    expect(linhaDe('LIVRE').querySelector(`td[data-coluna="${d(5)}"]`)).toHaveAttribute('data-fim-de-semana');
    expect(linhaDe('LIVRE').querySelector(`td[data-coluna="${d(7)}"]`)!.className).not.toContain('bg-passa');
    expect(document.querySelector(`th[data-coluna="${d(8)}"] [data-ponto-feriado]`)).not.toBeNull();
  });
});

describe('a legenda', () => {
  const grupos: GradeDoMes['grupos'] = [{ chave: 'a', nome: 'Alfa', linhas: [linha('X', { dias: { [d(5)]: [bloco('#2F8F5B', 'A', 'Pronto'), bloco('#6E56A8', 'B', 'JES')] }, choques: [d(5)], afastamentos: [af('Férias', d(1), d(3))] })] }];

  it('mostra, como as células, os quadradinhos na cor ajustada e lisos (sem a letra do turno), o traço do afastado e o contorno do choque', () => {
    render(<LegendaDaGrade grupos={grupos} />);
    const legenda = screen.getByRole('list', { name: 'Legenda' });
    const pronto = within(legenda).getByText('Pronto').closest('li')!;
    const quadrado = pronto.querySelector<HTMLElement>('[data-quadrado]')!;
    expect(quadrado.textContent).toBe('');
    const ajustado = estiloDaCor('#2F8F5B');
    expect(quadrado.style.backgroundColor).not.toBe('');
    expect(quadrado).toHaveStyle({ backgroundColor: ajustado.backgroundColor, color: ajustado.color });
    expect(within(legenda).getByText('Afastado').closest('li')!.querySelector('[data-traco-do-afastado]')).not.toBeNull();
    expect(within(legenda).getByText('Choque de horário')).toBeInTheDocument();
  });

  it('só traz o afastado quando alguém está afastado na grade', () => {
    render(<LegendaDaGrade grupos={[{ chave: 'a', nome: 'Alfa', linhas: [linha('Y', { dias: { [d(5)]: [bloco('#2F8F5B', 'A')] } })] }]} />);
    expect(screen.queryByText('Afastado')).toBeNull();
  });

  it('a dica do Shift só aparece no computador (some no celular)', () => {
    render(<LegendaDaGrade grupos={grupos} />);
    const dica = screen.getByText('Para rolar para os lados, segure Shift e gire a roda do mouse.');
    expect(dica.closest('li')!.className).toContain('max-md:hidden');
  });
});
