import type { LinhaEscala, LinhaGuarnicao, LinhaMilitar, Servico } from 'contratos';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// O jsdom não calcula layout: o que se confere é a estrutura. Só os itens ficam na área que rola;
// filtros, contagem e o botão "Mostrar desativadas" ficam parados, à vista.
// A rolagem de verdade (a lista longa rolando sozinha, sem a página) se confere à vista no ambiente de teste, no
// computador e no celular: estes testes só impedem que a estrutura que a produz seja desfeita sem querer.
const ROLA = '[data-lista-rolavel]';
const dentro = (el: HTMLElement) => el.closest(ROLA) !== null;

const MILITAR: LinhaMilitar = {
  id: 'm1', matricula: '990001-1', posto: 'SD BM', nomeGuerra: 'ALVES', equipe: 'Alfa', jornada: 'pronto', motorista: null,
  voluntarioJes: false, ativo: true, situacao: 'Disponível', pendencias: [],
};
const GUARNICAO: LinhaGuarnicao = { id: 'g1', nome: 'Auto Bomba 1', viatura: null, prioridade: 1, ativa: true, minimo: 1, maximo: 2, aPartirDe: null };
const SERVICO: Servico = { id: 's1', nome: 'Pronto', tipo: 'ordinario', operacao: null, rotuloImpressao: null, cor: '#2F8F5B', ativo: true, turnos: [] };
const ESCALA: LinhaEscala = { id: 'e1', nome: 'Ordinário', ativa: true, servicos: ['Pronto'] };

function api() {
  return simularApi({
    '/api/eu': { status: 200, corpo: EU_EXEMPLO },
    'GET /api/unidades/u-1sb/militares': { status: 200, corpo: [MILITAR] },
    'GET /api/unidades/u-1sb/equipes': { status: 200, corpo: [] },
    'GET /api/unidades/u-1sb/guarnicoes': { status: 200, corpo: [GUARNICAO] },
    'GET /api/unidades/u-1sb/servicos': { status: 200, corpo: [SERVICO] },
    'GET /api/unidades/u-1sb/escalas': { status: 200, corpo: [ESCALA] },
  });
}

describe('listas dos cadastros: só os itens rolam', () => {
  it('militares: a busca e os filtros ficam fora da área que rola', async () => {
    api();
    abrir('/militares');
    expect(dentro(await screen.findByText('ALVES'))).toBe(true);
    expect(dentro(screen.getByPlaceholderText('Buscar por nome ou matrícula'))).toBe(false);
    expect(dentro(screen.getByLabelText('Equipe'))).toBe(false);
  });

  it('guarnições: a contagem e "Mostrar desativadas" ficam fora da área que rola', async () => {
    api();
    abrir('/guarnicoes');
    expect(dentro(await screen.findByText('Auto Bomba 1'))).toBe(true);
    expect(dentro(screen.getByLabelText('Mostrar desativadas'))).toBe(false);
    expect(dentro(screen.getByText(/\d+ guarnições?/))).toBe(false);
  });

  it('serviços: "Mostrar desativados" fica fora da área que rola', async () => {
    api();
    abrir('/servicos');
    expect(dentro(await screen.findByText('Pronto'))).toBe(true);
    expect(dentro(screen.getByLabelText('Mostrar desativados'))).toBe(false);
  });

  it('escalas: "Mostrar desativadas" fica fora da área que rola', async () => {
    api();
    abrir('/escalas');
    expect(dentro(await screen.findByText('Ordinário'))).toBe(true);
    expect(dentro(screen.getByLabelText('Mostrar desativadas'))).toBe(false);
  });

  it.each([['/militares', 'ALVES'], ['/guarnicoes', 'Auto Bomba 1'], ['/servicos', 'Pronto'], ['/escalas', 'Ordinário']])(
    'a área que rola de %s não passa a rolagem para a página',
    async (caminho, texto) => {
      api();
      abrir(caminho);
      await screen.findByText(texto);
      expect(document.querySelector(ROLA)).toHaveClass('overscroll-contain');
    },
  );
});
