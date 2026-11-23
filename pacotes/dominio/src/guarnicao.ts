// Guarnições (porte das regras de prototipo/guarnicao.js; o desenho da grade na planilha fica de fora).
// Cada ESCALA tem um molde: quais postos (guarnição e função) existem em cada turno. O molde sai do
// cadastro de guarnições (composição) e do vínculo ESCALA/TURNO -> GUARNIÇÃO. Quem ocupa o posto fica
// gravado na própria alocação (função e unidade).
//   MILITARES = ESCALADOS: só entram nos postos militares que já têm alocação naquele serviço, dia e turno.
//   MILITARES = TODOS    : qualquer militar pode ser posto; preencher o posto cria a alocação.
import { bloquearPorChoque, type BloqueioPorChoque, type Horarios, type InclusaoSincronia } from './choques.ts';
import { cadgVigencia, cnhAtende, type Guarnicoes } from './cnh.ts';
import { antigNum, chaveAloc, normalizar, ordemDoPosto, type Militar } from './nucleo.ts';

const GUARN_VINCULO_ABA = 'GUARNIÇÕES POR ESCALA';
const texto = (v: unknown) => String(v == null ? '' : v).trim();

/** Chave de um militar num bloco da grade (dia + letra do turno, sem o serviço). */
export function chaveBloco(a: { mat: string; dia: string; turno: string }): string {
  return `${a.mat}|${a.dia}|${a.turno}`;
}

export function chaveSlot(unidade: unknown, funcao: unknown): string {
  return `${normalizar(unidade)}|${normalizar(funcao)}`;
}

/* ------------------------------------------------------------ modelos */

export interface Vinculo { linha: number; vigencia?: unknown; escala?: unknown; turno?: unknown; guarnicao?: unknown }
export interface LinhaPosto { escala: string; turno: string; unidade: string; funcao: string; vagas: number; exigeCnh: boolean; cnh: string[]; guarnicao: string }

/**
 * Do vínculo ESCALA/TURNO -> GUARNIÇÃO para as linhas de posto (RN-09, RN-93, RN-10 a RN-12).
 * Vigência por escala: vale o conjunto de linhas da vigência mais recente que não passa do mês.
 * Cada função da guarnição vira uma linha de posto (vagas = máximo; sem máximo, o mínimo, e pelo menos 1).
 */
export function vinculosParaModelo(vinculos: Vinculo[] | null | undefined, cadastro: Guarnicoes | null | undefined, mes: string) {
  const avisos: string[] = [];
  const linhas: LinhaPosto[] = [];
  const onde = (l: Vinculo) => `${GUARN_VINCULO_ABA}, linha ${l.linha}`;
  const validas: { l: Vinculo; vig: string; esc: string }[] = [];
  (vinculos || []).forEach((l) => {
    if (!texto(l.escala) && !texto(l.guarnicao)) return; // linha vazia
    if (!texto(l.escala)) {
      avisos.push(`${onde(l)}: GUARNIÇÃO "${texto(l.guarnicao)}" sem ESCALA; linha ignorada.`);
      return;
    }
    if (!texto(l.guarnicao)) {
      avisos.push(`${onde(l)}: a escala "${texto(l.escala)}" está sem GUARNIÇÃO; linha ignorada.`);
      return;
    }
    const vig = cadgVigencia(l.vigencia);
    if (!vig.ok) {
      avisos.push(`${onde(l)}: vigência "${texto(l.vigencia)}" inválida (use aaaa-mm); linha ignorada.`);
      return;
    }
    if (vig.valor !== '' && vig.valor > mes) return; // ainda não vale (RN-93)
    validas.push({ l, vig: vig.valor, esc: normalizar(l.escala) });
  });
  // a vigência mais recente de cada escala
  const vigDaEscala: Record<string, string> = Object.create(null);
  validas.forEach((v) => {
    if (!(v.esc in vigDaEscala) || v.vig > vigDaEscala[v.esc]) vigDaEscala[v.esc] = v.vig;
  });

  const vistos: Record<string, boolean> = Object.create(null);
  validas
    .filter((v) => v.vig === vigDaEscala[v.esc])
    .forEach((v) => {
      const l = v.l;
      const turno = texto(l.turno) || 'TODOS';
      const k = `${v.esc}|${normalizar(turno)}|${normalizar(l.guarnicao)}`;
      if (vistos[k]) {
        avisos.push(`${onde(l)}: "${texto(l.guarnicao)}" já está vinculada à escala "${texto(l.escala)}" no turno ${turno}; a repetição foi ignorada.`);
        return;
      }
      vistos[k] = true;
      const g = cadastro && cadastro.porId ? cadastro.porId[normalizar(l.guarnicao)] : null;
      if (!g) {
        avisos.push(`${onde(l)}: a guarnição "${texto(l.guarnicao)}" não está na aba GUARNIÇÕES em ${mes} (confira se o nome é igual ao da coluna GUARNIÇÃO de lá). Ela não gera posto na escala "${texto(l.escala)}".`);
        return;
      }
      if (!g.ativar) {
        avisos.push(`${onde(l)}: a guarnição "${g.id}" está com ATIVAR = NÃO em ${mes} (RN-07); ela não gera posto na escala "${texto(l.escala)}".`);
        return;
      }
      if (!g.funcoes.length) {
        avisos.push(`${onde(l)}: a guarnição "${g.id}" não tem nenhuma função cadastrada em GUARNIÇÕES; ela não gera posto.`);
        return;
      }
      g.funcoes.forEach((f) => {
        const vagas = f.maximo !== null ? f.maximo : Math.max(f.minimo, 1);
        linhas.push({ escala: texto(l.escala), turno, unidade: g.id, funcao: f.funcao, vagas, exigeCnh: f.cnh.length > 0, cnh: f.cnh.slice(), guarnicao: g.id });
      });
    });
  return { linhas, avisos };
}

export interface Slot { unidade: string; funcao: string; vagas: number; exigeCnh: boolean; cnh: string[] | null }
export interface Escala {
  nome: string;
  servicos: string[];
  titulo: string;
  militares: 'TODOS' | 'ESCALADOS';
  dias: 'TODOS' | 'ESCALADOS';
  turnos: string[];
  slots: Record<string, Slot[]>;
  usaUnidade: boolean;
}
export interface Modelos { escalas: Record<string, Escala>; ordem: string[]; avisos: string[] }

export interface LinhaEscala { escala?: unknown; servicos?: unknown; titulo?: unknown; militares?: unknown; dias?: unknown }
export interface LinhaModelo { escala?: unknown; turno?: unknown; unidade?: unknown; funcao?: unknown; vagas?: unknown; exigeCnh?: unknown; cnh?: unknown }

/**
 * Os moldes das escalas (RN-09, RN-100, RN-13, RN-83). Uma escala agrupa N serviços (da coluna
 * SERVIÇOS, numa linha separados por vírgula ou em várias linhas); o 1º é o que uma alocação nova
 * recebe. Escala com problema grave (serviço inexistente, sem molde) é descartada com aviso.
 * turnosPorServico: { 'Pronto': ['A','B'], ... } na ordem do cadastro de turnos.
 */
export function montarModelosGuarnicao(
  linhasEscalas: LinhaEscala[],
  linhasModelo: LinhaModelo[],
  turnosPorServico: Record<string, string[]>,
  opcoes?: { aba?: string } | null,
): Modelos {
  const ABA = (opcoes && opcoes.aba) || GUARN_VINCULO_ABA;
  const avisos: string[] = [];
  const escalas: Record<string, Escala> = Object.create(null);
  const ordem: string[] = [];
  const servicoPorNome: Record<string, string> = Object.create(null);
  Object.keys(turnosPorServico).forEach((s) => {
    servicoPorNome[normalizar(s)] = s;
  });

  type Grupo = { nome: string; pedidos: string[]; titulo: string; militares: string; dias: string; linhas: number; semServicos: number };
  const grupos: Grupo[] = [];
  const porChave: Record<string, Grupo> = Object.create(null);
  linhasEscalas.forEach((l) => {
    const nome = texto(l.escala);
    if (!nome) return;
    const k = normalizar(nome);
    let g = porChave[k];
    if (!g) {
      g = porChave[k] = { nome, pedidos: [], titulo: '', militares: '', dias: '', linhas: 0, semServicos: 0 };
      grupos.push(g);
    }
    g.linhas++;
    const pedidos = texto(l.servicos).split(/[,;]/).map(texto).filter(Boolean);
    if (pedidos.length === 0) g.semServicos++;
    pedidos.forEach((p) => {
      if (g.pedidos.indexOf(p) < 0) g.pedidos.push(p);
    });
    ([['titulo', 'TÍTULO'], ['militares', 'MILITARES'], ['dias', 'DIAS']] as const).forEach(([campo, rotulo]) => {
      const v = texto(l[campo]);
      if (!v) return;
      if (!g[campo]) g[campo] = v;
      else if (normalizar(g[campo]) !== normalizar(v)) avisos.push(`ESCALAS: "${nome}" tem ${rotulo} diferente em linhas diferentes ("${g[campo]}" e "${v}"); vale o primeiro.`);
    });
  });

  grupos.forEach((g) => {
    const nome = g.nome;
    // sem nenhum serviço escrito, vale o serviço com o nome da escala
    const pedidos = g.pedidos.length ? g.pedidos : [nome];
    const servicos: string[] = [];
    const faltando: string[] = [];
    pedidos.forEach((p) => {
      const c = servicoPorNome[normalizar(p)];
      if (!c) faltando.push(p);
      else if (servicos.indexOf(c) < 0) servicos.push(c);
    });
    if (faltando.length) {
      const soONome = !g.pedidos.length;
      avisos.push(`ESCALAS: "${nome}" ignorada: ${
        soONome
          ? `a coluna SERVIÇOS está vazia e não existe serviço "${nome}" na aba TURNOS. Escreva em SERVIÇOS os serviços que compõem a escala (ex.: "Pronto, JES, Saldo"), numa linha só ou numa linha por serviço.`
          : `o serviço ${faltando.map((x) => `"${x}"`).join(', ')} não existe na aba TURNOS.`
      }`);
      return;
    }
    if (g.semServicos && g.pedidos.length) avisos.push(`ESCALAS: "${nome}" tem ${g.semServicos} linha(s) com SERVIÇOS vazio; valem os serviços das outras linhas (${servicos.join(', ')}).`);

    const militares = normalizar(g.militares) === 'TODOS' ? 'TODOS' : 'ESCALADOS';
    if (g.militares !== '' && ['TODOS', 'ESCALADOS'].indexOf(normalizar(g.militares)) < 0) {
      avisos.push(`ESCALAS: "${nome}": MILITARES deve ser TODOS ou ESCALADOS (achei "${g.militares}"); usando ESCALADOS.`);
    }
    const dias = normalizar(g.dias).indexOf('SO') === 0 ? 'ESCALADOS' : 'TODOS';

    const turnos: string[] = [];
    servicos.forEach((s) => turnosPorServico[s].forEach((x) => {
      if (turnos.indexOf(x) < 0) turnos.push(x);
    }));
    const slots: Record<string, Slot[]> = Object.create(null);
    turnos.forEach((x) => {
      slots[x] = [];
    });

    escalas[nome] = { nome, servicos, titulo: g.titulo || `ESCALA ${nome.toUpperCase()}`, militares, dias, turnos, slots, usaUnidade: false };
    ordem.push(nome);
  });

  const achar = (nome: string): Escala | null => {
    if (escalas[nome]) return escalas[nome];
    const n = normalizar(nome);
    const k = Object.keys(escalas).filter((e) => normalizar(e) === n)[0];
    return k ? escalas[k] : null;
  };

  linhasModelo.forEach((l) => {
    const nomeEsc = texto(l.escala);
    if (!nomeEsc && !texto(l.funcao)) return; // linha vazia
    const esc = achar(nomeEsc);
    if (!esc) {
      avisos.push(`${ABA}: a escala "${nomeEsc}" não existe (ou foi ignorada) na aba ESCALAS; essa linha foi ignorada.`);
      return;
    }
    const funcao = texto(l.funcao);
    if (!funcao) {
      avisos.push(`${ABA}: linha sem FUNÇÃO na escala "${esc.nome}"; ignorada.`);
      return;
    }

    const bruto = texto(l.turno);
    const alvo = bruto === '' || normalizar(bruto) === 'TODOS' ? esc.turnos.slice() : bruto.split(/[,;/\s]+/).map(texto).filter(Boolean);

    let vagas = parseInt(texto(l.vagas), 10);
    if (!(vagas >= 1)) {
      if (texto(l.vagas) !== '') avisos.push(`${ABA}: VAGAS inválido ("${texto(l.vagas)}") em "${esc.nome} / ${funcao}"; usando 1.`);
      vagas = 1;
    }
    if (vagas > 20) vagas = 20;

    // se a função exige habilitação é cadastro (RN-94): booleano do vínculo novo, ou texto do formato antigo
    const exigeCnh = typeof l.exigeCnh === 'boolean' ? l.exigeCnh : ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'].indexOf(normalizar(l.exigeCnh)) >= 0;
    const cnh = Array.isArray(l.cnh) ? (l.cnh.slice() as string[]) : null; // null = formato antigo

    alvo.forEach((turno) => {
      if (!esc.slots[turno]) {
        avisos.push(`${ABA}: o turno "${turno}" não existe nos serviços da escala "${esc.nome}"; ignorado.`);
        return;
      }
      esc.slots[turno].push({ unidade: texto(l.unidade), funcao, vagas, exigeCnh, cnh });
      if (texto(l.unidade)) esc.usaUnidade = true;
    });
  });

  Object.keys(escalas).forEach((nome) => {
    const e = escalas[nome];
    const total = e.turnos.reduce((n, x) => n + e.slots[x].length, 0);
    if (total === 0) {
      avisos.push(`ESCALAS: "${nome}" ignorada: não há linhas para ela na aba ${ABA}.`);
      delete escalas[nome];
      ordem.splice(ordem.indexOf(nome), 1);
    }
  });
  return { escalas, ordem, avisos };
}

/** As funções de um serviço (RN-94), do cadastro; com turno, só as daquele turno. Sem repetir. */
export function funcoesPorServico(mod: Pick<Modelos, 'escalas'> | null | undefined, servico: unknown, turno?: string | null) {
  const out: { funcao: string; unidade: string; exigeCnh: boolean; escala: string }[] = [];
  const vistos: Record<string, boolean> = Object.create(null);
  const alvo = normalizar(servico);
  const escalas = (mod && mod.escalas) || {};
  Object.keys(escalas).forEach((nome) => {
    const e = escalas[nome];
    if (!e.servicos.some((s) => normalizar(s) === alvo)) return;
    let turnos: string[];
    if (turno) {
      if (!e.slots[turno]) return; // esse turno não existe nesta escala
      turnos = [turno];
    } else {
      turnos = e.turnos;
    }
    turnos.forEach((x) => (e.slots[x] || []).forEach((s) => {
      const k = chaveSlot(s.unidade, s.funcao);
      if (vistos[k]) return;
      vistos[k] = true;
      out.push({ funcao: s.funcao, unidade: s.unidade, exigeCnh: !!s.exigeCnh, escala: e.nome });
    }));
  });
  return out;
}

/** { FUNÇÃO normalizada: true } das funções que exigem CNH no cadastro (RN-94, RN-12). */
export function funcoesQueExigemCnh(mod: Pick<Modelos, 'escalas'> | null | undefined): Record<string, true> {
  const out: Record<string, true> = Object.create(null);
  const escalas = (mod && mod.escalas) || {};
  Object.keys(escalas).forEach((nome) => {
    const e = escalas[nome];
    e.turnos.forEach((x) => (e.slots[x] || []).forEach((s) => {
      if (s.exigeCnh) out[normalizar(s.funcao)] = true;
    }));
  });
  return out;
}

export interface MotivoListaEntrada {
  funcao?: string;
  unidade?: string;
  exigeCnh?: boolean;
  escalaTodos?: boolean;
  candidatos?: number;
  motoristas?: number;
  habilitados?: number;
  exigida?: string[];
  temColunaCnh?: boolean;
  cadastrada?: boolean;
}

/**
 * Por que a lista de militares de um posto está vazia ou curta (RN-12, RN-81). Lista vazia não
 * pode ser silenciosa. '' quando não há nada a explicar.
 */
export function motivoDaLista(entrada?: MotivoListaEntrada | null): string {
  const p = entrada || {};
  const quem = p.escalaTodos ? 'nenhum militar na aba MILITARES' : 'nenhum militar está escalado neste serviço, dia e turno';
  const comoEscalar = p.escalaTodos ? '' : ' Escale alguém (Escala Automática ou Mostrar Grade Geral) e monte a grade de novo.';
  if (!p.exigeCnh) {
    if ((p.candidatos as number) > 0) return '';
    return `Sem lista: ${quem}.${comoEscalar}`;
  }
  // posto de condutor: a lista é sempre restrita, então sempre explica a restrição
  let regra = `Posto de condutor: a lista só traz quem está no quadro de motoristas (coluna MOTORISTA em MILITARES)${
    p.exigida && p.exigida.length ? ` e tem CNH ${p.exigida.join('/')}, exigida pela guarnição ${p.unidade}` : ''
  }.`;
  if (!p.exigida || !p.exigida.length) {
    if (p.unidade && p.cadastrada === false) {
      regra += ` A guarnição "${p.unidade}" do posto não está na aba GUARNIÇÕES: confira se o nome em GUARNIÇÕES POR ESCALA é igual à coluna GUARNIÇÃO do cadastro. Sem isso, nenhuma categoria de CNH é exigida aqui.`;
    } else if (!p.unidade) {
      regra += ' O posto não tem guarnição (a aba GUARNIÇÕES POR ESCALA ainda está no formato antigo, com a UNIDADE vazia), então não há categoria a exigir. Converta a aba pelo painel Escalas de Serviço.';
    }
  }
  if ((p.habilitados as number) > 0) return `${regra} ${p.habilitados} habilitado(s) neste turno.`;
  let porque: string;
  if (!p.candidatos) porque = `${quem}.${comoEscalar}`;
  else if (!p.motoristas) porque = `dos ${p.candidatos} militares disponíveis neste turno, nenhum está marcado como motorista em MILITARES.`;
  else if (p.exigida && p.exigida.length) {
    porque = `dos ${p.motoristas} motorista(s) disponíveis neste turno, nenhum tem CNH ${p.exigida.join('/')}${
      p.temColunaCnh ? '' : ' (a aba MILITARES não tem a coluna CNH, então ninguém tem categoria cadastrada)'
    }.`;
  } else porque = 'nenhum motorista disponível neste turno.';
  return `Sem lista: ${porque} ${regra}`;
}

/** A regra de condutor de cada posto, pelo vínculo novo: { 'UNIDADE|FUNÇÃO': { exigeCnh, cnh } }. */
export function postosDoModelo(mod: Pick<Modelos, 'escalas'> | null | undefined): Record<string, { exigeCnh: boolean; cnh: string[] }> {
  const out: Record<string, { exigeCnh: boolean; cnh: string[] }> = Object.create(null);
  const escalas = (mod && mod.escalas) || {};
  Object.keys(escalas).forEach((nome) => {
    const e = escalas[nome];
    e.turnos.forEach((x) => (e.slots[x] || []).forEach((s) => {
      if (s.cnh === null || s.cnh === undefined) return;
      out[chaveSlot(s.unidade, s.funcao)] = { exigeCnh: !!s.exigeCnh, cnh: [...s.cnh] };
    }));
  });
  return out;
}

export interface ContextoCnh {
  postos?: Record<string, { exigeCnh: boolean; cnh: string[] }> | null;
  funcoesComCnh?: Record<string, unknown> | null;
  cnhPorUnidade?: Record<string, string[]> | null;
}

/** O posto (guarnição + função) é de condutor, e que categoria exige? (RN-12) */
export function regraDoPosto(ctx: ContextoCnh | null | undefined, unidade: unknown, funcao: unknown): { exigeCnh: boolean; exigida: string[] } {
  const c = ctx || {};
  const p = c.postos ? c.postos[chaveSlot(unidade, funcao)] : null;
  if (p) return { exigeCnh: p.exigeCnh, exigida: p.cnh || [] };
  return {
    exigeCnh: funcaoExigeCnh(funcao, c.funcoesComCnh),
    exigida: (c.cnhPorUnidade || {})[normalizar(unidade)] || [],
  };
}

/** A função exige habilitação? Vale o cadastro; sem nada marcado, o nome contém MOTORISTA. */
export function funcaoExigeCnh(funcao: unknown, funcoesComCnh?: Record<string, unknown> | null): boolean {
  const n = normalizar(funcao);
  if (funcoesComCnh && Object.keys(funcoesComCnh).length) return !!funcoesComCnh[n];
  return /MOTORISTA/.test(n);
}

/** Postos de um turno, um por vaga: [{ unidade, funcao, k, chave }] (k = 1, 2... entre postos iguais). */
export function expandirSlots(esc: Pick<Escala, 'slots'>, turno: string) {
  const out: { unidade: string; funcao: string; k: number; chave: string }[] = [];
  const cont: Record<string, number> = Object.create(null);
  (esc.slots[turno] || []).forEach((s) => {
    for (let i = 0; i < s.vagas; i++) {
      const c = chaveSlot(s.unidade, s.funcao);
      cont[c] = (cont[c] || 0) + 1;
      out.push({ unidade: s.unidade, funcao: s.funcao, k: cont[c], chave: c });
    }
  });
  return out;
}

/** A posição do posto na hierarquia (menor = mais antigo): pela ordem do cadastro, quando vem; senão, pela sigla. */
const posicaoDoPosto = (m: Militar) => (typeof m.postoOrdem === 'number' ? -m.postoOrdem : ordemDoPosto(m.posto));

/**
 * Do mais antigo para o mais moderno (RN-02, RN-81): posto/graduação, depois a antiguidade, depois
 * a ordem do cadastro. Militar fora do cadastro vai para o fim, pela matrícula.
 */
export function compararAntiguidade(x: { mat: string; m?: Militar | null }, y: { mat: string; m?: Militar | null }): number {
  const px = x.m ? posicaoDoPosto(x.m) : Infinity;
  const py = y.m ? posicaoDoPosto(y.m) : Infinity;
  if (px !== py) return px < py ? -1 : 1;
  const ax = x.m ? antigNum(x.m.antig) : null;
  const ay = y.m ? antigNum(y.m.antig) : null;
  const nx = ax === null ? Infinity : ax;
  const ny = ay === null ? Infinity : ay;
  if (nx !== ny) return nx < ny ? -1 : 1;
  // quem não tem ordem vai por último (sem isso, comparar um com ordem e um sem dava 1 nos dois sentidos e a ordem dependia da posição de entrada)
  const ox = x.m?.ordem ?? Infinity;
  const oy = y.m?.ordem ?? Infinity;
  if (ox !== oy) return ox < oy ? -1 : 1;
  return x.mat < y.mat ? -1 : x.mat > y.mat ? 1 : 0;
}

/* ------------------------------------------------------------ diferenças */

interface EstadoPosto { f: string; u: string; outro?: boolean; servico?: string }
export interface AlocBase { mat: string; dia: string; turno: string; servico: string; funcao?: string; unidade?: string; fora?: boolean }
export interface LinhaGrade { linha?: number; dia: string; turno: string; unidade: string; funcao: string; texto?: string; mat: string }
export interface AlocTabela { mat: string; dia: string; turno: string; servico: string; funcao?: string; unidade?: string; linha: number }
export interface OpcoesGuarnicao extends ContextoCnh {
  horarios?: Horarios | null;
  todas?: { mat: string; dia: string; turno: string; servico: string; linha?: unknown; implicito?: boolean }[] | null;
  tipos?: Record<string, string> | null;
  motoristas?: Record<string, unknown> | null;
  cnh?: Record<string, string[]> | null;
}
export interface Aplicada { chave: string; estado: EstadoPosto | null; servico: string }

/**
 * Compara a grade de guarnições (base = como foi desenhada; grade = como está agora; tabelaMes = a
 * tabela agora, só o mês) e devolve o que gravar, em três vias: só grava o que a pessoa mudou; se
 * outra pessoa mexeu na mesma alocação, vira conflito. opcoes.horarios + opcoes.todas ativam o
 * bloqueio por choque nas inclusões; opcoes.motoristas ativa os avisos de condutor (RN-12).
 */
export function calcularGuarnicao(base: AlocBase[], grade: LinhaGrade[], tabelaMes: AlocTabela[], esc: Pick<Escala, 'militares' | 'servicos'>, opcoes?: OpcoesGuarnicao | null) {
  const o = opcoes || {};
  const cria = esc.militares === 'TODOS';
  const est = (f?: string, u?: string): EstadoPosto => ({ f: f || '', u: u || '' });
  const igual = (a: EstadoPosto | null | undefined, b: EstadoPosto | null | undefined) => {
    if (a == null || b == null) return a == null && b == null;
    return !!a.outro === !!b.outro && normalizar(a.f) === normalizar(b.f) && normalizar(a.u) === normalizar(b.u);
  };

  const B: Record<string, { servico: string; e: EstadoPosto; fora: boolean }> = Object.create(null);
  base.forEach((a) => {
    const k = chaveBloco(a);
    if (!(k in B)) B[k] = { servico: a.servico, e: est(a.funcao, a.unidade), fora: !!a.fora };
  });

  // uma pessoa pode ter dois serviços na mesma letra de turno: vale o da escala; sem ele, o primeiro da tabela
  const T: Record<string, { servico: string; f?: string; u?: string; linhas: number[] }> = Object.create(null);
  const foraDaEscala = (a: AlocTabela) => (esc.servicos.indexOf(a.servico) >= 0 ? 0 : 1);
  tabelaMes
    .slice()
    .sort((x, y) => foraDaEscala(x) - foraDaEscala(y))
    .forEach((a) => {
      const k = chaveBloco(a);
      if (!T[k]) T[k] = { servico: a.servico, f: a.funcao, u: a.unidade, linhas: [] };
      if (T[k].servico === a.servico) T[k].linhas.push(a.linha);
    });
  const estadoTabela = (k: string): EstadoPosto | null => {
    const t = T[k];
    if (!t) return null;
    if (esc.servicos.indexOf(t.servico) < 0) return { outro: true, servico: t.servico, f: '', u: '' };
    return est(t.f, t.u);
  };

  type Item = { chave: string; mat: string; dia: string; turno: string; [campo: string]: unknown };
  const res = {
    inserir: [] as (InclusaoSincronia & { funcao: string; unidade: string })[],
    atualizar: [] as { chave: string; linhas: number[]; funcao: string; unidade: string }[],
    remover: [] as { chave: string; linhas: number[] }[],
    conflitos: [] as Item[],
    invalidas: [] as Record<string, unknown>[],
    choques: [] as BloqueioPorChoque[],
    jaAplicadas: [] as Item[],
    aplicadas: [] as Aplicada[],
    avisosMotorista: [] as { mat: string; dia: string; turno: string; funcao: string }[],
    avisosCnh: [] as { mat: string; dia: string; turno: string; funcao: string; unidade: string; exigida: string }[],
    resumo: {} as Record<string, number>,
  };
  const G: Record<string, EstadoPosto> = Object.create(null);
  const ocup: Record<string, LinhaGrade[]> = Object.create(null);
  grade.forEach((r) => {
    if (!r.mat) {
      if (r.texto) res.invalidas.push({ motivo: 'ilegivel', chave: '', mat: '', dia: r.dia, turno: r.turno, funcao: r.funcao, unidade: r.unidade, texto: r.texto });
      return;
    }
    const k = chaveBloco({ mat: r.mat, dia: r.dia, turno: r.turno });
    if (!ocup[k]) ocup[k] = [];
    ocup[k].push(r);
  });
  Object.keys(ocup).forEach((k) => {
    if (ocup[k].length === 1) G[k] = est(ocup[k][0].funcao, ocup[k][0].unidade);
    if (o.motoristas) {
      const motoristas = o.motoristas;
      ocup[k].forEach((r) => {
        const regra = regraDoPosto(o, r.unidade, r.funcao);
        if (!regra.exigeCnh) return;
        // quem está numa função de condutor sem estar no quadro de motoristas
        if (!motoristas[r.mat]) {
          res.avisosMotorista.push({ mat: r.mat, dia: r.dia, turno: r.turno, funcao: r.funcao });
          return;
        }
        // e quem está no quadro mas sem CNH compatível com a guarnição (RN-12)
        const exigida = regra.exigida;
        if (exigida.length && !cnhAtende((o.cnh || {})[r.mat] || [], exigida)) {
          res.avisosCnh.push({ mat: r.mat, dia: r.dia, turno: r.turno, funcao: r.funcao, unidade: r.unidade, exigida: exigida.join('/') });
        }
      });
    }
  });

  const item = (k: string, extra?: Record<string, unknown>): Item => {
    const p = k.split('|');
    return { chave: k, mat: p[0], dia: p[1], turno: p[2], ...(extra || {}) };
  };

  const chaves = Object.keys({ ...B, ...G, ...ocup }).sort();
  chaves.forEach((k) => {
    const b = B[k] ? B[k].e : null;
    if (ocup[k] && ocup[k].length > 1) {
      const r = ocup[k][0];
      res.invalidas.push(item(k, { motivo: 'duplicado', funcao: ocup[k].map((x) => x.funcao).join(' e '), unidade: r.unidade }));
      return;
    }
    let g: EstadoPosto | null;
    if (G[k]) g = G[k];
    else if (b) {
      if (B[k].fora) return; // fora da grade: só muda se a pessoa for colocada num posto
      g = b.f === '' && b.u === '' ? b : cria ? null : est('', '');
    } else return;
    if (igual(g, b)) return;

    const t = estadoTabela(k);
    const extra: Record<string, unknown> = { de: b, para: g, funcao: g ? g.f : '', unidade: g ? g.u : '' };
    if (igual(t, g)) {
      res.jaAplicadas.push(item(k, extra));
      res.aplicadas.push({ chave: k, estado: g, servico: T[k] ? T[k].servico : esc.servicos[0] });
      return;
    }
    if (!igual(t, b)) {
      const tabela = !t ? '(sem alocação)' : t.outro ? `já escalado em ${t.servico}` : (t.f || 'sem função') + (t.u ? ` / ${t.u}` : '');
      res.conflitos.push(item(k, { ...extra, tabela }));
      return;
    }

    if (g === null) {
      res.remover.push({ chave: k, linhas: T[k].linhas.slice() });
      res.aplicadas.push({ chave: k, estado: null, servico: T[k].servico });
    } else if (b === null) {
      if (!cria) {
        res.invalidas.push(item(k, { ...extra, motivo: 'nao-escalado' }));
        return;
      }
      const p = k.split('|');
      res.inserir.push({ mat: p[0], dia: p[1], turno: p[2], servico: esc.servicos[0], funcao: g.f, unidade: g.u, chave: k });
      res.aplicadas.push({ chave: k, estado: g, servico: esc.servicos[0] });
    } else {
      res.atualizar.push({ chave: k, linhas: T[k].linhas.slice(), funcao: g.f, unidade: g.u });
      res.aplicadas.push({ chave: k, estado: g, servico: T[k].servico });
    }
  });

  // choque de horário: só as inclusões criam alocação nova (trocar a função não muda horário)
  if (o.horarios && o.todas && res.inserir.length) {
    // a checagem de choque usa a chave completa (serviço incluído); aqui a chave é a do bloco
    const posto: Record<string, { funcao: string; unidade: string }> = Object.create(null);
    const cheia: Record<string, string> = Object.create(null);
    res.inserir.forEach((i) => {
      const c = chaveAloc(i);
      cheia[i.chave] = c;
      posto[c] = { funcao: i.funcao, unidade: i.unidade };
    });
    const r2 = {
      inserir: res.inserir.map((i) => ({ ...i, chave: cheia[i.chave], troca: '' })),
      remover: res.remover,
      choques: [] as BloqueioPorChoque[],
      aplicadas: res.aplicadas.map((a) => cheia[a.chave] || a.chave),
    };
    bloquearPorChoque(r2, o.todas, o.horarios, o.tipos);
    const passou: Record<string, boolean> = Object.create(null);
    r2.inserir.forEach((i) => {
      passou[i.chave] = true;
    });
    res.inserir = res.inserir.filter((i) => passou[cheia[i.chave]]);
    res.choques = r2.choques;
    res.choques.forEach((c) => {
      const p = posto[c.chave];
      if (p) {
        c.funcao = p.funcao;
        c.unidade = p.unidade;
      }
    });
    const ok: Record<string, boolean> = Object.create(null);
    r2.aplicadas.forEach((k) => {
      ok[k] = true;
    });
    res.aplicadas = res.aplicadas.filter((a) => ok[cheia[a.chave] || a.chave]);
  }

  res.resumo = {
    inclusoes: res.inserir.length,
    funcoes: res.atualizar.length,
    exclusoes: res.remover.length,
    conflitos: res.conflitos.length,
    invalidas: res.invalidas.length,
    choques: res.choques.length,
    jaAplicadas: res.jaAplicadas.length,
    motoristas: res.avisosMotorista.length,
    cnh: res.avisosCnh.length,
  };
  return res;
}

/** Nova referência depois de salvar: só as chaves aplicadas avançam; conflitos e inválidas continuam pendentes. */
export function novaBaseGuarnicao(base: AlocBase[], res: { aplicadas: Aplicada[] }): AlocBase[] {
  const B: Record<string, AlocBase> = Object.create(null);
  base.forEach((a) => {
    const k = chaveBloco(a);
    if (!(k in B)) B[k] = a;
  });
  res.aplicadas.forEach((a) => {
    if (a.estado === null) {
      delete B[a.chave];
      return;
    }
    const p = a.chave.split('|');
    B[a.chave] = { mat: p[0], dia: p[1], turno: p[2], servico: a.servico, funcao: a.estado.f, unidade: a.estado.u };
  });
  return Object.keys(B).sort().map((k) => B[k]);
}
