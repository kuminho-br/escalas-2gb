import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlocoDaGrade, GradeDoMes, LinhaDaGrade, OpcaoDeServico, PainelDoDia } from 'contratos';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// O celular na Grade (6.70, Task 8): a folha do painel do dia, os alvos de 44 px e a tela cheia estreita. Dados fictícios (D7).
// O jsdom não desenha: as provas são das classes que o Tailwind transforma em medida (`max-md:` = abaixo de 768 px).
const MES = '2026-12';
const DIA = `${MES}-10`;
const DIAS = Array.from({ length: 31 }, (_, i) => ({ data: `${MES}-${String(i + 1).padStart(2, '0')}`, diaDaSemana: (2 + i) % 7, feriado: null }));
const PRONTO = { id: 's-pronto', nome: 'Pronto', cor: '#2F8F5B', tipo: 'ordinario' as const };
const BLOCO: BlocoDaGrade = { alocacaoId: 'a-1', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00' };
const CABO: LinhaDaGrade = { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', jornada: 'pronto', dias: { [DIA]: [BLOCO] }, choques: [], afastamentos: [], pjes: 2, diarias: 1, horasTiradas: 0, horasPedidas: 0 };
const GRADE: GradeDoMes = { mes: MES, dias: DIAS, grupos: [{ chave: 'eq-alfa', nome: 'Alfa', linhas: [CABO] }] };
const opcao: OpcaoDeServico = {
  escalaId: 'e-ord', escala: 'Ordinário', inicio: '08:00', fim: '20:00', guarnicaoId: null, guarnicao: null, funcaoId: null, funcao: null,
  servicos: [{ servicoId: 's-pronto', turnoId: 't-a', nome: 'Pronto', semVoluntariado: false }], semVoluntariado: false, ordinario: true,
};
const PAINEL: PainelDoDia = {
  militar: { militarId: 'm-CABO', posto: 'SD', nomeGuerra: 'CABO', matricula: '997001-1', equipe: 'Alfa', jornada: 'pronto', cnh: [], voluntarioJes: false },
  data: DIA, afastamento: null, disponibilidade: [], servicos: [{ alocacaoId: 'a-1', escalaId: 'e-ord', escala: 'Ordinário', servico: PRONTO, letra: 'A', inicio: '08:00', fim: '20:00', guarnicao: null, funcao: null, acumulaCom: [] }], choques: [], opcoes: [opcao],
};
const entrar = async (caminho: string) => {
  simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    [`GET /api/unidades/u-1sb/grade/${MES}`]: { status: 200, corpo: GRADE },
    [`GET /api/unidades/u-1sb/grade/${MES}/militares/m-CABO/dias/${DIA}`]: { status: 200, corpo: PAINEL },
  });
  abrir(caminho);
  await screen.findByRole('button', { name: 'Abrir a ficha de SD CABO' });
};
const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);

describe('a folha do painel do dia (abaixo de 768 px)', () => {
  it('sobe de baixo e vai até 64% da altura, deixando acima o cabeçalho dos dias e a linha escolhida', async () => {
    await entrar(`/grade?mes=${MES}&militar=m-CABO&dia=${DIA}`);
    const folha = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    for (const c of ['max-md:fixed', 'max-md:inset-x-0', 'max-md:bottom-0', 'max-md:max-h-[64dvh]', 'max-md:rounded-t-2xl']) expect(classes(folha), c).toContain(c);
    // o corpo rola dentro da folha
    expect(folha.querySelector('[data-corpo-da-folha]')!.getAttribute('class')).toContain('max-md:overflow-y-auto');
  });

  it('"Adicionar serviço neste dia" fica fixo no pé da folha, mesmo com o painel de serviços aberto', async () => {
    await entrar(`/grade?mes=${MES}&militar=m-CABO&dia=${DIA}`);
    const folha = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    const botao = await within(folha).findByRole('button', { name: 'Adicionar serviço neste dia' });
    await userEvent.click(botao);
    const pe = botao.parentElement!;
    for (const c of ['max-md:sticky', 'max-md:bottom-0', 'max-md:order-last']) expect(classes(pe), c).toContain(c);
  });

  it('os alvos de toque da folha têm 44 px', async () => {
    await entrar(`/grade?mes=${MES}&militar=m-CABO&dia=${DIA}`);
    const folha = await screen.findByRole('complementary', { name: 'Dia de SD CABO' });
    for (const nome of ['Fechar', 'Trocar', 'Remover', 'Adicionar serviço neste dia']) {
      expect(classes(await within(folha).findByRole('button', { name: nome })), nome).toContain('max-md:h-11');
    }
  });
});

describe('a tabela no celular', () => {
  it('a célula do dia tem 44 px de altura; PJES e Diárias só ficam presas a partir de 1440 px', async () => {
    await entrar(`/grade?mes=${MES}`);
    expect(classes(screen.getByRole('button', { name: 'SD CABO, dia 10: Pronto A' }))).toContain('max-md:h-11');
    // só a partir de 1440 px as duas colunas finais ficam presas à direita; abaixo disso rolam com a tabela (o cabeçalho continua preso no alto)
    for (const [nome, direita] of [['PJES', 'right-16'], ['Diárias', 'right-0']] as const) {
      const c = classes(screen.getByRole('columnheader', { name: nome }));
      expect(c).toContain(`min-[1440px]:${direita}`);
      expect(c).not.toContain(direita);
    }
    const celulaDePjes = document.querySelector('tr[data-militar="m-CABO"]')!.querySelectorAll('td')[31]!;
    expect(classes(celulaDePjes)).toContain('min-[1440px]:sticky');
    expect(classes(celulaDePjes)).not.toContain('sticky');
  });
});

describe('a tela cheia no celular', () => {
  it('a coluna do militar estreita (112 px): o posto em cima do nome e sem a matrícula', async () => {
    await entrar(`/grade?mes=${MES}&cheia=true`);
    const botao = screen.getByRole('button', { name: 'Abrir a ficha de SD CABO' });
    const th = botao.closest('th')!;
    expect(classes(th)).toContain('max-md:w-28');
    expect(classes(th)).toContain('max-md:min-w-28');
    expect(botao.textContent).toContain('997001-1');
    expect(classes(within(botao).getByText('997001-1'))).toContain('max-md:hidden');
    expect(classes(within(botao).getByText('SD').parentElement!)).toContain('max-md:flex-col');
    // o posto e o nome ocupam a altura toda da célula (sem a matrícula e sem a barra do saldo, que não cabem em 112 px): nada fica cortado
    expect(classes(within(botao).getByText('SD').parentElement!)).toContain('max-md:row-span-2');
    // cabem seis dias: cada coluna com 44 px
    expect(classes(screen.getByRole('columnheader', { name: /^Dia 10,/ }))).toContain('max-md:min-w-11');
    expect(classes(document.querySelector('[data-rolagem="grade"]')!)).toContain('max-md:scroll-pl-28');
  });

  it('fora da tela cheia a coluna do militar continua larga e com a matrícula', async () => {
    await entrar(`/grade?mes=${MES}`);
    const botao = screen.getByRole('button', { name: 'Abrir a ficha de SD CABO' });
    expect(classes(botao.closest('th')!)).not.toContain('max-md:w-28');
    expect(classes(within(botao).getByText('997001-1'))).not.toContain('max-md:hidden');
  });
});
