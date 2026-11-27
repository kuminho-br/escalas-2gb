import type { OpcaoDeServico } from 'contratos';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdicionarServico } from '@/componentes/grade/AdicionarServico';

// 6.73: o acabamento da Grade e do "Adicionar serviço" (os degraus e a árvore inteira têm os testes em degraus-da-unidade.test.tsx; o fim de semana, em grade-afastados.test.tsx).
const opcao = (o: Partial<OpcaoDeServico>): OpcaoDeServico => ({
  escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00', guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null,
  servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }], semVoluntariado: false, ordinario: true, ...o,
});
const vaga = (guarnicaoId: string, guarnicao: string, funcaoId: string, funcao: string) => ({ guarnicaoId, guarnicao, funcaoId, funcao });

describe('"Adicionar serviço": a vaga de abertura', () => {
  const OPCOES = [
    opcao({ ...vaga('g-abt', 'ABT', 'f-comb', 'Combatente') }),
    opcao({ ...vaga('g-res', 'Resgate', 'f-chefe', 'Chefe') }),
    opcao({}), // Sem guarnição, 08h–20h
    opcao({ inicio: '20:00', fim: '08:00', ...vaga('g-abt', 'ABT', 'f-mot', 'Motorista'), servicos: [{ servicoId: 's-pronto', turnoId: 't-b', nome: 'Pronto', semVoluntariado: false }] }),
    opcao({ inicio: '20:00', fim: '08:00', servicos: [{ servicoId: 's-pronto', turnoId: 't-b', nome: 'Pronto', semVoluntariado: false }] }), // Sem guarnição, 20h–08h
  ];

  it('em todo turno que tem "Sem guarnição", é ela que vem marcada ao abrir', () => {
    render(<AdicionarServico opcoes={OPCOES} salvando={false} aoEscolher={() => {}} />);
    for (const faixa of ['08h–20h', '20h–08h']) {
      const linha = screen.getByRole('listitem', { name: faixa });
      const lista = within(linha).getByLabelText(`Vaga de ${faixa}`) as HTMLSelectElement;
      expect(lista.selectedOptions[0]!.textContent, faixa).toBe('Sem guarnição');
    }
  });

  it('o turno sem "Sem guarnição" abre na primeira vaga, e escolher outra vaga continua possível', () => {
    render(<AdicionarServico opcoes={[OPCOES[0]!, OPCOES[1]!]} salvando={false} aoEscolher={() => {}} />);
    const lista = screen.getByLabelText('Vaga de 08h–20h') as HTMLSelectElement;
    expect(lista.selectedOptions[0]!.textContent).toBe('ABT · Combatente');
  });
});

describe('o traço do afastado na Grade', () => {
  it('tem o mesmo desenho em toda célula: padrão em pixels fixos (6 px de traço, 4 px de vão), nunca em % da célula', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'estilo.css'), 'utf8');
    const regra = /\.afastado-traco\s*\{([^}]*)\}/.exec(css)![1]!;
    const fundo = /background:\s*([^;]+);/.exec(regra)![1]!;
    const [gradiente, tamanho] = fundo.split(/\)\s+0 0 \/\s*/) as [string, string];
    // o tamanho do período (e da altura) é em px: um % faria o traço sair diferente conforme a largura do dia
    expect(tamanho).toMatch(/^\d+px \d+px repeat-x$/);
    expect(tamanho).not.toContain('%');
    expect(gradiente).toContain('0 6px');
    expect(gradiente).toContain('6px 10px');
  });
});
