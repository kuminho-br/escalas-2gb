// Distribuição das cotas das operações (porte de prototipo/distribuicao_cotas.js), com as remoções
// do escalante. Regras: RN-23 (choque), RN-24 (JES não emenda com Pronto), RN-25 (expediente do
// Adm), RN-33/34/35 (cotas e origem), RN-36 (uma diária por dia), RN-37 (dobradinha), RN-40/41
// (voluntária e compulsória), RN-42 (equilíbrio), RN-51 (contagens por cota), RN-81 (vagas),
// RN-82 (custo da vaga). Determinístico: os mesmos dados dão sempre a mesma distribuição.
import { detectarChoques, type Horarios } from './choques.ts';
import { chaveAloc, normalizar, numeroDoDia, TIPO_DIARIA } from './nucleo.ts';
import type { Remocao } from './pre-escala.ts';
import { exigeVoluntarioJes } from './regras.ts';

export { TIPO_DIARIA };

// peso de cada critério na escolha entre candidatos (menor pontuação ganha)
export const COTAS_PESO = { equilibrio: 1, boa: 0.5 };
// textos dos motivos de uma vaga que ficou vazia
export const COTAS_MOTIVOS = {
  semVoluntario: 'sem voluntário para esse dia e turno',
  semFormulario: 'ninguém preencheu o formulário do mês',
  choque: 'choque de horário',
  emenda: 'JES não pode emendar com Pronto',
  expediente: 'choca com o expediente do Adm',
  diaria: 'o militar já tem diária nesse dia',
  naoVoluntarioJes: 'JES só para militar com VOLUNTÁRIO JES = sim (RN-46)',
  semHorario: 'turno sem horário legível na aba TURNOS',
  removido: 'o escalante removeu o militar dessa vaga',
};
type Motivo = keyof typeof COTAS_MOTIVOS;

/**
 * O serviço que as alocações de uma operação recebem (RN-100): com um serviço na escala, é ele;
 * com vários, o informado nas linhas da cota (um só, o mesmo em todas).
 */
export function servicoDaOperacao(esc: { nome: string; servicos: string[] }, linhasCota?: { servico?: unknown }[] | null): { servico: string } | { problema: string } {
  if (esc.servicos.length === 1) return { servico: esc.servicos[0] };
  const achados = (linhasCota || []).map((c) => esc.servicos.filter((s) => normalizar(s) === normalizar(c.servico))[0] || '');
  const distintos = achados.filter((s, i) => s && achados.indexOf(s) === i);
  if (distintos.length === 1 && achados.indexOf('') < 0) return { servico: distintos[0] };
  return {
    problema: `"${esc.nome}" agrupa ${esc.servicos.length} serviços (${esc.servicos.join(', ')}). Escreva na coluna SERVIÇO da aba COTAS qual deles a cota paga (um só, o mesmo em todas as linhas da operação).`,
  };
}

/** RN-82: quanto de cota uma vaga preenchida consome (hoje, 1 por militar por turno). */
export function custoDaVaga(_operacao?: unknown, _vaga?: unknown): number {
  return 1;
}

export interface Operacao { nome: string; servico: string; prioridade?: number | string | null; dias: string[]; turnos: { turno: string; vagas: number | string }[] }
export interface Cota { id: string; operacao: string; quantidade: number | string; origem?: string }
interface AlocCota { mat: string; dia: string; servico: string; turno: string }

export interface EntradaCotas {
  mes: string;
  operacoes: Operacao[];
  /** na ordem em que consomem */
  cotas: Cota[];
  /** a seção; a ordem desempata */
  militares: { mat: string }[];
  /** servico '' ou 'todos' = qualquer serviço */
  voluntariado: { mat: string; dia: string; turno: string; servico?: string }[];
  /** todas as da tabela, de todos os meses */
  alocacoes: AlocCota[];
  /** expediente implícito do Adm (só para checar choques) */
  expediente?: AlocCota[] | null;
  horarios?: Horarios | null;
  tipos?: Record<string, string> | null;
  /** quem tem VOLUNTÁRIO JES = sim, ou null (ninguém é barrado); só barra as vagas de JES */
  voluntariosJes?: Record<string, unknown> | null;
  /** vagas de onde o escalante tirou o militar (regra nova): ele não volta para elas */
  remocoes?: Remocao[] | null;
}

interface Registro extends AlocCota { implicito: boolean; ini: number | null; fim: number | null }
interface EstadoOp {
  def: Operacao;
  cotas: Cota[];
  recebidas: number;
  existentes: number;
  novasN: number;
  restante: number;
  ocup: Record<string, number>;
  porMilitar: Record<string, number>;
  slots: Vaga[];
}
interface Vaga { op: EstadoOp; dia: string; turno: string; total: number; need: number; preenchidas: number; rej: Partial<Record<Motivo, number>>; tentou: boolean; semVol: boolean; fase: string }

export function distribuirCotas(e: EntradaCotas) {
  const avisos: string[] = [];
  const horarios: Horarios = e.horarios || {};
  const tipos = e.tipos || {};
  const eDiaria = (servico: string) => normalizar(tipos[servico] || '') === TIPO_DIARIA;
  const removida: Record<string, boolean> = Object.create(null);
  (e.remocoes || []).forEach((r) => {
    removida[`${r.mat}|${r.dia}|${normalizar(r.servico)}|${r.turno}`] = true;
  });

  // posição de cada militar da seção (desempate) e quem preencheu o formulário do mês (RN-41)
  const ordem: Record<string, number> = Object.create(null);
  e.militares.forEach((m, i) => {
    if (!(m.mat in ordem)) ordem[m.mat] = i;
  });
  const noFormulario: Record<string, boolean> = Object.create(null);
  const vol: Record<string, { mat: string; servico: string }[]> = Object.create(null);
  e.voluntariado.forEach((v) => {
    if (!(v.mat in ordem)) return;
    noFormulario[v.mat] = true;
    const k = `${v.dia}|${v.turno}`;
    (vol[k] = vol[k] || []).push({ mat: v.mat, servico: normalizar(v.servico || '') });
  });

  // alocações de cada militar (reais e expediente implícito)
  const A: Record<string, Registro[]> = Object.create(null);
  const guarda = (a: AlocCota, implicito: boolean) => {
    const h = horarios[`${a.servico}|${a.turno}`];
    const x: Registro = { mat: a.mat, dia: a.dia, servico: a.servico, turno: a.turno, implicito: !!implicito, ini: null, fim: null };
    if (h) {
      x.ini = numeroDoDia(a.dia) * 1440 + h.ini;
      x.fim = x.ini + h.dur;
    }
    (A[a.mat] = A[a.mat] || []).push(x);
  };
  e.alocacoes.forEach((a) => guarda(a, false));
  (e.expediente || []).forEach((a) => guarda(a, true));

  // quantas alocações de operação cada militar tem no mês (base do equilíbrio)
  const servicosDeCota: Record<string, boolean> = Object.create(null);
  e.operacoes.forEach((o) => {
    servicosDeCota[o.servico] = true;
  });
  const usados: Record<string, number> = Object.create(null);
  e.alocacoes.forEach((a) => {
    if (a.dia.slice(0, 7) === e.mes && servicosDeCota[a.servico]) usados[a.mat] = (usados[a.mat] || 0) + 1;
  });

  // estado de cada operação
  const prioridade = (o: Operacao) => (o.prioridade == null || o.prioridade === '' ? 1e9 : Number(o.prioridade));
  const ops: EstadoOp[] = e.operacoes
    .slice()
    .sort((x, y) => prioridade(x) - prioridade(y) || (x.nome < y.nome ? -1 : x.nome > y.nome ? 1 : 0))
    .map((o) => {
      const cotas = e.cotas.filter((c) => c.operacao === o.nome);
      const recebidas = cotas.reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
      const ocup: Record<string, number> = Object.create(null);
      const porMilitar: Record<string, number> = Object.create(null);
      let existentes = 0;
      e.alocacoes.forEach((a) => {
        if (a.servico !== o.servico || a.dia.slice(0, 7) !== e.mes) return;
        const k = `${a.dia}|${a.turno}`;
        ocup[k] = (ocup[k] || 0) + 1;
        existentes += custoDaVaga(o, a);
        porMilitar[a.mat] = (porMilitar[a.mat] || 0) + 1;
      });
      if (existentes > recebidas) avisos.push(`"${o.nome}": a tabela já tem ${existentes} alocações do mês, mais que a cota recebida (${recebidas}).`);
      if (!cotas.length) avisos.push(`"${o.nome}": não há cota cadastrada para o mês; nada será distribuído.`);
      return { def: o, cotas, recebidas, existentes, novasN: 0, restante: Math.max(0, recebidas - existentes), ocup, porMilitar, slots: [] };
    });

  // vagas de cada operação, em ordem de dia e de turno
  ops.forEach((op) => {
    op.def.dias.slice().sort().forEach((dia) => {
      op.def.turnos.forEach((t) => {
        const ja = op.ocup[`${dia}|${t.turno}`] || 0;
        const total = Math.max(0, Number(t.vagas) || 0);
        if (!horarios[`${op.def.servico}|${t.turno}`]) return;
        op.slots.push({ op, dia, turno: t.turno, total, need: Math.max(0, total - ja), preenchidas: ja, rej: Object.create(null), tentou: false, semVol: false, fase: '' });
      });
    });
    op.def.turnos.forEach((t) => {
      if (!horarios[`${op.def.servico}|${t.turno}`]) avisos.push(`"${op.def.nome}": ${COTAS_MOTIVOS.semHorario} (${op.def.servico} ${t.turno}); turno ignorado.`);
    });
  });

  const novas: { mat: string; dia: string; servico: string; turno: string; operacao: string; fase: string }[] = [];

  /** null se o militar pode ficar na vaga; senão o motivo da recusa. */
  function recusa(mat: string, slot: Vaga): Motivo | 'jaNaVaga' | null {
    const h = horarios[`${slot.op.def.servico}|${slot.turno}`];
    const cand = { mat, dia: slot.dia, servico: slot.op.def.servico, turno: slot.turno };
    const lista = A[mat] || [];
    const ini = numeroDoDia(slot.dia) * 1440 + h.ini;
    for (const x of lista) {
      if (!x.implicito && x.dia === cand.dia && x.servico === cand.servico && x.turno === cand.turno) return 'jaNaVaga';
      if (!x.implicito && x.dia === cand.dia && eDiaria(cand.servico) && eDiaria(x.servico)) return 'diaria';
    }
    if (removida[`${mat}|${cand.dia}|${normalizar(cand.servico)}|${cand.turno}`]) return 'removido';
    const perto = lista.filter((x) => x.ini !== null && Math.abs(x.ini - ini) < 3 * 1440);
    const r = detectarChoques(perto.concat([cand as Registro]), horarios, { tipos });
    const minha = chaveAloc(cand);
    const achou = r.choques.filter((c) => c.a.chave === minha || c.b.chave === minha);
    if (!achou.length) return null;
    const tipo = achou[0].tipo;
    return tipo === 'emenda' ? 'emenda' : tipo === 'expediente' ? 'expediente' : 'choque';
  }

  /** Quanto menor, melhor: quem tem menos cotas consumidas; combinação boa (RN-42) desempata. */
  function pontuacao(mat: string, slot: Vaga): number {
    const h = horarios[`${slot.op.def.servico}|${slot.turno}`];
    const ini = numeroDoDia(slot.dia) * 1440 + h.ini;
    const fim = ini + h.dur;
    let boa = 0;
    (A[mat] || []).forEach((x) => {
      if (x.implicito || x.ini === null) return;
      const encosta = x.fim === ini || x.ini === fim;
      if (!encosta) return;
      if (eDiaria(slot.op.def.servico) && eDiaria(x.servico)) boa = 1; // dobradinha
      else if (x.fim === ini && normalizar(x.servico) === 'PRONTO' && eDiaria(slot.op.def.servico)) boa = 1; // saída do Pronto
    });
    return COTAS_PESO.equilibrio * (usados[mat] || 0) - COTAS_PESO.boa * boa;
  }

  function candidatos(slot: Vaga, fase: string): string[] {
    // vaga de JES só para voluntário JES; as demais (diárias) aceitam quem preencheu o formulário (RN-46)
    const soJes = e.voluntariosJes && exigeVoluntarioJes(slot.op.def.servico);
    const pode = (mat: string) => {
      if (!soJes || e.voluntariosJes?.[mat]) return true;
      slot.rej.naoVoluntarioJes = (slot.rej.naoVoluntarioJes || 0) + 1;
      return false;
    };
    if (fase === 'voluntaria') {
      const l = vol[`${slot.dia}|${slot.turno}`] || [];
      const serv = normalizar(slot.op.def.servico);
      const mats: string[] = [];
      l.forEach((v) => {
        if ((v.servico === '' || v.servico === 'TODOS' || v.servico === serv) && mats.indexOf(v.mat) < 0) mats.push(v.mat);
      });
      return mats.filter(pode);
    }
    return Object.keys(noFormulario).filter(pode);
  }

  function preencher(slot: Vaga, fase: string) {
    const op = slot.op;
    slot.tentou = true;
    while (slot.need > 0 && op.restante > 0) {
      const cands = candidatos(slot, fase);
      if (fase === 'voluntaria' && !cands.length) slot.semVol = true;
      let melhor: string | null = null;
      let melhorPt = 0;
      cands.forEach((mat) => {
        const r = recusa(mat, slot);
        if (r) {
          if (r !== 'jaNaVaga') slot.rej[r] = (slot.rej[r] || 0) + 1;
          return;
        }
        const pt = pontuacao(mat, slot);
        if (melhor === null || pt < melhorPt || (pt === melhorPt && ordem[mat] < ordem[melhor])) {
          melhor = mat;
          melhorPt = pt;
        }
      });
      if (melhor === null) break;
      const escolhido: string = melhor;
      guarda({ mat: escolhido, dia: slot.dia, servico: op.def.servico, turno: slot.turno }, false);
      usados[escolhido] = (usados[escolhido] || 0) + 1;
      op.porMilitar[escolhido] = (op.porMilitar[escolhido] || 0) + 1;
      op.restante -= custoDaVaga(op.def, slot);
      op.novasN++;
      slot.need--;
      slot.preenchidas++;
      novas.push({ mat: escolhido, dia: slot.dia, servico: op.def.servico, turno: slot.turno, operacao: op.def.nome, fase });
    }
  }

  // fase voluntária (RN-40): todas as operações, na ordem de prioridade
  ops.forEach((op) => op.slots.forEach((s) => preencher(s, 'voluntaria')));
  // fase compulsória (RN-40, RN-41): só quem preencheu o formulário; completa primeiro as guarnições já começadas
  ops.forEach((op) => {
    const comeco = op.slots.filter((s) => s.need > 0 && s.preenchidas > 0);
    const vazios = op.slots.filter((s) => s.need > 0 && s.preenchidas === 0);
    comeco.concat(vazios).forEach((s) => preencher(s, 'compulsoria'));
  });

  // vagas que ficaram vazias, com o motivo
  const vazias: { operacao: string; servico: string; dia: string; turno: string; faltam: number; motivo: string }[] = [];
  const semCota: Record<string, number> = Object.create(null);
  ops.forEach((op) => {
    op.slots.forEach((s) => {
      if (s.need <= 0) return;
      if (op.restante <= 0 && !s.tentou) return;
      if (op.restante <= 0) {
        semCota[op.def.nome] = (semCota[op.def.nome] || 0) + s.need;
        return;
      }
      let motivo: string;
      const rej = (Object.keys(s.rej) as Motivo[]).sort((a, b) => (s.rej[b] as number) - (s.rej[a] as number));
      if (!Object.keys(noFormulario).length) motivo = COTAS_MOTIVOS.semFormulario;
      else if (rej.length) motivo = COTAS_MOTIVOS[rej[0]];
      else motivo = COTAS_MOTIVOS.semVoluntario;
      vazias.push({ operacao: op.def.nome, servico: op.def.servico, dia: s.dia, turno: s.turno, faltam: s.need, motivo });
    });
    // vagas que nem foram olhadas porque a cota acabou antes
    op.slots.forEach((s) => {
      if (s.need > 0 && !s.tentou) semCota[op.def.nome] = (semCota[op.def.nome] || 0) + s.need;
    });
  });

  // contagens por cota (RN-51): o consumo preenche as cotas na ordem em que foram cadastradas
  const porCota: { id: string; operacao: string; servico: string; origem: string; recebidas: number; distribuidas: number; restantes: number }[] = [];
  const porOperacao: Record<string, { servico: string; recebidas: number; distribuidas: number; restantes: number; novas: number; porMilitar: Record<string, number> }> =
    Object.create(null);
  ops.forEach((op) => {
    let resta = op.existentes + op.novasN;
    op.cotas.forEach((c) => {
      const q = Number(c.quantidade) || 0;
      const d = Math.min(q, resta);
      resta -= d;
      porCota.push({ id: c.id, operacao: op.def.nome, servico: op.def.servico, origem: c.origem || 'interna', recebidas: q, distribuidas: d, restantes: q - d });
    });
    if (resta > 0 && op.cotas.length) porCota[porCota.length - 1].distribuidas += resta;
    porOperacao[op.def.nome] = {
      servico: op.def.servico,
      recebidas: op.recebidas,
      distribuidas: op.existentes + op.novasN,
      restantes: Math.max(0, op.recebidas - op.existentes - op.novasN),
      novas: op.novasN,
      porMilitar: op.porMilitar,
    };
  });

  return { novas, porCota, porOperacao, vazias, semCota, avisos };
}

export interface EntradaDiagnostico {
  mes: string;
  secao?: string;
  operacoes?: (Operacao & { problema?: string })[] | null;
  res: ReturnType<typeof distribuirCotas>;
  horarios: Horarios;
  voluntariado?: { linhasMes: number; linhasSecao: number; ignoradasJes: number } | null;
}

/**
 * Por que uma operação com cota restante não gera nenhuma alocação, e o que fazer (RN-81, RN-40,
 * RN-41). Só fala das operações com cota restante e nenhuma alocação nova.
 */
export function diagnosticarOperacoes(e: EntradaDiagnostico): { operacao: string; texto: string }[] {
  const res: { operacao: string; texto: string }[] = [];
  const vol = e.voluntariado || { linhasMes: 0, linhasSecao: 0, ignoradasJes: 0 };
  (e.operacoes || []).forEach((o) => {
    const p = e.res.porOperacao[o.nome];
    if (!p || p.novas > 0 || p.restantes <= 0) return;
    const nome = `"${o.nome}"`;
    if (o.problema) {
      res.push({ operacao: o.nome, texto: o.problema });
      return;
    }
    if (!o.dias.length) {
      res.push({ operacao: o.nome, texto: `${nome} sem dias: a escala só usa os dias já escalados (ESCALAS, coluna DIAS) e a tabela não tem nenhum em ${e.mes}. Escale esses dias ou mude DIAS para TODOS.` });
      return;
    }
    const vagasPorDia = o.turnos.reduce((n, t) => (e.horarios[`${o.servico}|${t.turno}`] ? n + (Number(t.vagas) || 0) : n), 0);
    if (vagasPorDia <= 0) {
      res.push({ operacao: o.nome, texto: `${nome} sem vagas: vincule as guarnições de cada turno em GUARNIÇÕES POR ESCALA, com as funções em GUARNIÇÕES (e confira se os turnos têm horário na aba TURNOS).` });
      return;
    }
    // há vagas: ninguém pôde ocupá-las. O motivo que mais se repete explica o resto.
    const mine = e.res.vazias.filter((v) => v.operacao === o.nome);
    const faltam = mine.reduce((n, v) => n + v.faltam, 0);
    if (!mine.length) return;
    const cont: Record<string, number> = Object.create(null);
    mine.forEach((v) => {
      cont[v.motivo] = (cont[v.motivo] || 0) + v.faltam;
    });
    const motivo = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0];
    let causa: string;
    if (motivo === COTAS_MOTIVOS.semFormulario) {
      if (vol.linhasMes === 0) causa = `A aba VOLUNTARIADO não tem nenhuma linha de ${e.mes}.`;
      else causa = `A aba VOLUNTARIADO tem ${vol.linhasMes} linha(s) de ${e.mes}, mas nenhuma de militar da ${e.secao} (confira a matrícula e a SEÇÃO em MILITARES).`;
      causa += ' Preencha o VOLUNTARIADO (uma linha por militar, dia e turno) e analise de novo.';
    } else if (motivo === COTAS_MOTIVOS.semVoluntario) {
      causa = 'Ninguém se voluntariou para esses dias e turnos. Cadastre mais voluntários no VOLUNTARIADO.';
    } else {
      causa = `Motivo mais comum: ${motivo}. Libere horários dos militares ou cadastre mais voluntários.`;
    }
    res.push({ operacao: o.nome, texto: `${nome}: ${faltam} vaga(s) sem ninguém e nenhuma alocação a gerar. ${causa}` });
  });
  return res;
}
