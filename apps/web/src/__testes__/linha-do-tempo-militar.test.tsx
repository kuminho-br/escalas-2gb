import type { FichaMilitar } from 'contratos';
import { describe, expect, it } from 'vitest';
import { ddmmaaaa, eventosDoRastreio, periodoAtual, ROTULO_DO_CAMPO, textoDoAutor, valorDoCampo, type EventoDoRastreio } from '@/lib/linha-do-tempo-militar';

type Periodo = FichaMilitar['rastreio'][number];
const HOJE = '2026-11-24';
const periodo = (id: string, desde: string, ate: string | null, unidadeSigla: string, equipe: string | null, jornada: 'pronto' | 'adm', quadro: string | null = 'QBMG', situacao = 'Ativa'): Periodo => ({
  id, unidadeId: `u-${unidadeSigla}`, unidadeSigla, equipe, jornada, quadro, situacao, desde, ate, alteradoPor: null, alteradoEm: null, podeMexer: false,
});
const comAutor = (p: Periodo, patente: string, nomeGuerra: string, em: string): Periodo => ({ ...p, alteradoPor: { patente, nomeGuerra }, alteradoEm: em });
type ComCampos = Exclude<EventoDoRastreio, { tipo: 'vao' }>;
/** O evento, dito de qual tipo é (o teste quebra com a mensagem certa se for outro). */
const so = (e: EventoDoRastreio | undefined, tipo: 'inicio' | 'mudanca'): ComCampos => {
  if (!e || e.tipo !== tipo) throw new Error(`esperava ${tipo}, veio ${e?.tipo}`);
  return e;
};

// os dados fictícios do mockup da DESIGN: DGO (Adm) → DGO com quadro → 1ª SB (Pronto, Alfa)
const COMUM = [
  periodo('r1', '2022-03-14', '2025-02-02', 'DGO', null, 'adm', null),
  periodo('r2', '2025-02-03', '2026-08-11', 'DGO', null, 'adm', 'QBMG'),
  comAutor(periodo('r3', '2026-08-12', null, '1ª SB', 'ALFA', 'pronto', 'QBMG'), 'MAJ', 'BARRETO', '2026-08-10T09:15:42'),
];

describe('periodoAtual', () => {
  it('é o período que cobre o dia; o marcado para depois ainda não vale, e o que já terminou também não', () => {
    expect(periodoAtual(COMUM, HOJE)?.id).toBe('r3');
    expect(periodoAtual([...COMUM, periodo('r4', '2027-01-01', null, '1ª SB', 'BRAVO', 'pronto')].map((p) => (p.id === 'r3' ? { ...p, ate: '2026-12-31' } : p)), HOJE)?.id).toBe('r3');
    expect(periodoAtual([periodo('r1', '2025-01-01', '2026-06-30', '1ª SB', null, 'pronto')], HOJE)).toBeNull();
    expect(periodoAtual([], HOJE)).toBeNull();
  });
});

describe('valorDoCampo', () => {
  it('diz o valor de cada campo (a jornada pelo nome) e null quando falta a equipe ou o quadro', () => {
    const p = periodo('r1', '2026-01-01', null, '1ª SB', 'ALFA', 'adm', 'QBMG');
    expect(['lotacao', 'equipe', 'jornada', 'quadro', 'situacao'].map((c) => valorDoCampo(p, c as never))).toEqual(['1ª SB', 'ALFA', 'ADM', 'QBMG', 'Ativa']);
    expect(valorDoCampo({ ...p, equipe: null, quadro: null }, 'equipe')).toBeNull();
    expect(valorDoCampo({ ...p, equipe: null, quadro: null }, 'quadro')).toBeNull();
    expect(ROTULO_DO_CAMPO).toEqual({ lotacao: 'Lotação', equipe: 'Equipe', jornada: 'Jornada', quadro: 'Quadro', situacao: 'Situação' });
  });
});

describe('eventosDoRastreio', () => {
  it('o primeiro período é o "inicio": a situação inteira numa frase e nenhuma mudança; os outros são "mudanca", só com os campos que mudaram, na ordem fixa', () => {
    const e = eventosDoRastreio(COMUM, HOJE);
    expect(e.map((x) => x.tipo)).toEqual(['mudanca', 'mudanca', 'inicio']);
    const inicio = so(e[2], 'inicio');
    expect(inicio).toMatchObject({ desde: '2022-03-14', inteira: 'DGO · ADM · Ativa', mudancas: [] });
    expect(so(e[1], 'mudanca')).toMatchObject({ desde: '2025-02-03', mudancas: [{ campo: 'quadro', antes: 'sem quadro', depois: 'QBMG' }] });
    expect(so(e[0], 'mudanca').mudancas).toEqual([
      { campo: 'lotacao', antes: 'DGO', depois: '1ª SB' },
      { campo: 'equipe', antes: 'sem equipe', depois: 'ALFA' },
      { campo: 'jornada', antes: 'ADM', depois: 'Pronto' },
    ]);
  });

  it('a ordem não depende da ordem de entrada (a API manda do mais novo para o mais velho)', () => {
    expect(eventosDoRastreio([...COMUM].reverse(), HOJE)).toEqual(eventosDoRastreio(COMUM, HOJE));
  });

  it('o "inicio" só diz o que existe: sem equipe e sem quadro, eles não entram na frase', () => {
    expect(so(eventosDoRastreio([periodo('r1', '2026-03-01', null, '2ª SB', null, 'pronto', null, 'Reserva')], HOJE)[0], 'inicio').inteira).toBe('2ª SB · Pronto · Reserva');
  });

  it('o valor que passa a faltar também vira "sem equipe" (e o que passa a existir, o nome)', () => {
    const e = eventosDoRastreio([periodo('r1', '2026-01-01', '2026-02-28', '1ª SB', 'ALFA', 'pronto'), periodo('r2', '2026-03-01', null, '1ª SB', null, 'pronto')], HOJE);
    expect(so(e[0], 'mudanca').mudancas).toEqual([{ campo: 'equipe', antes: 'ALFA', depois: 'sem equipe' }]);
  });

  it('quadro e situação que mudam entram na ordem Lotação, Equipe, Jornada, Quadro, Situação', () => {
    const e = eventosDoRastreio([
      periodo('r1', '2026-01-01', '2026-02-28', '2ª SB', 'ALFA', 'adm', 'QOA', 'Ativa'),
      periodo('r2', '2026-03-01', null, '1ª SB', 'ALFA', 'pronto', 'QOC', 'Reserva'),
    ], HOJE);
    expect(so(e[0], 'mudanca').mudancas.map((m) => m.campo)).toEqual(['lotacao', 'jornada', 'quadro', 'situacao']);
  });

  it('dois períodos iguais seguidos: a mudança vem sem nenhum campo (a tela diz "Sem mudança na situação")', () => {
    const e = eventosDoRastreio([periodo('r1', '2026-01-01', '2026-02-28', '1ª SB', 'ALFA', 'pronto'), periodo('r2', '2026-03-01', null, '1ª SB', 'ALFA', 'pronto')], HOJE);
    expect(so(e[0], 'mudanca').mudancas).toEqual([]);
  });

  describe('o que vale agora, o que passou e o que está marcado', () => {
    it('o período de hoje vale agora; os anteriores, "antes"; o de data futura, "marcada"; só um "agora" (Review Focus 1)', () => {
      const marcada = [...COMUM, comAutor(periodo('r4', '2027-01-01', null, '1ª SB', 'BRAVO', 'pronto'), 'MAJ', 'BARRETO', '2026-11-23T16:30:00')].map((p) => (p.id === 'r3' ? { ...p, ate: '2026-12-31' } : p));
      const vales = eventosDoRastreio(marcada, HOJE).map((x) => (x.tipo === 'vao' ? 'vao' : `${x.desde}:${x.vale}`));
      expect(vales).toEqual(['2027-01-01:marcada', '2026-08-12:agora', '2025-02-03:antes', '2022-03-14:antes']);
      expect(vales.filter((v) => v.endsWith(':agora'))).toHaveLength(1);
    });

    it('com o período de hoje já terminado e nenhum seguinte, nenhum evento vale agora (Review Focus 2)', () => {
      const e = eventosDoRastreio([periodo('r1', '2025-01-01', '2026-06-30', '1ª SB', 'ALFA', 'pronto')], HOJE);
      expect(e.map((x) => (x.tipo === 'vao' ? 'vao' : x.vale))).toEqual(['antes']);
    });

    it('o primeiro registro pode ser também o que vale agora', () => {
      expect(so(eventosDoRastreio([periodo('r1', '2026-03-01', null, '1ª SB', 'ALFA', 'pronto')], HOJE)[0], 'inicio').vale).toBe('agora');
    });
  });

  describe('os dias sem lotação', () => {
    it('entre dois períodos com intervalo vem um "vao", entre os dois que ele separa, com o ano só na data do fim', () => {
      const e = eventosDoRastreio([periodo('r1', '2025-03-01', '2025-03-09', '1ª SB', 'ALFA', 'pronto'), periodo('r2', '2025-03-10', '2025-03-10', '1ª SB', 'ALFA', 'pronto'), periodo('r3', '2025-06-01', null, '1ª SB', 'ALFA', 'pronto')], HOJE);
      expect(e.map((x) => x.tipo)).toEqual(['mudanca', 'vao', 'mudanca', 'inicio']);
      expect(e[1]).toEqual({ tipo: 'vao', de: '2025-03-11', ate: '2025-05-31', texto: 'Sem lotação de 11/03 a 31/05/2025' });
    });

    it('períodos colados (o fim num dia e o começo no seguinte) não têm vão', () => {
      const e = eventosDoRastreio([periodo('r1', '2026-03-01', '2026-06-30', '1ª SB', 'ALFA', 'pronto'), periodo('r2', '2026-07-01', null, '1ª SB', 'ALFA', 'pronto')], HOJE);
      expect(e.some((x) => x.tipo === 'vao')).toBe(false);
    });

    it('o vão que atravessa a virada do ano mostra o ano nas duas datas', () => {
      const e = eventosDoRastreio([periodo('r1', '2026-03-01', '2026-12-20', '1ª SB', 'ALFA', 'pronto'), periodo('r2', '2027-01-10', null, '1ª SB', 'ALFA', 'pronto')], HOJE);
      expect(e.find((x) => x.tipo === 'vao')).toMatchObject({ texto: 'Sem lotação de 21/12/2026 a 09/01/2027' });
    });
  });

  it('o autor vem como "por MAJ BARRETO em 10/08/2026 às 09:15"; sem autor, nada', () => {
    const e = eventosDoRastreio(COMUM, HOJE);
    expect(so(e[0], 'mudanca').autor).toBe('por MAJ BARRETO em 10/08/2026 às 09:15');
    expect(so(e[1], 'mudanca').autor).toBeUndefined();
  });

  it('sem rastreio, a lista é vazia', () => {
    expect(eventosDoRastreio([], HOJE)).toEqual([]);
  });
});

describe('ddmmaaaa e textoDoAutor', () => {
  it('formatam a data e o autor', () => {
    expect(ddmmaaaa('2026-08-12')).toBe('12/08/2026');
    expect(textoDoAutor({ alteradoPor: { patente: 'CAP', nomeGuerra: 'LINS' }, alteradoEm: '2025-02-03T14:02:00' })).toBe('por CAP LINS em 03/02/2025 às 14:02');
    expect(textoDoAutor({ alteradoPor: null, alteradoEm: null })).toBeUndefined();
  });
});
