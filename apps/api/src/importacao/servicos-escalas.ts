// Importação das abas TURNOS, ESCALAS e GUARNIÇÕES POR ESCALA, em ordem e numa transação só: as escalas
// dependem dos serviços, e os vínculos dependem das escalas e das guarnições (entrega 3).
// ESCALAS é lida como no protótipo (prototipo/guarnicao.js): "SÓ ESCALADOS", MILITARES vazio = ESCALADOS,
// TÍTULO vazio = "ESCALA <NOME>" e serviço desconhecido descarta a escala. TURNOS nunca apaga nada.
import {
  CORES_SERVICO,
  COR_PADRAO_SERVICO,
  mesPorExtenso,
  textoFaixa,
  tipoDoServicoFixo,
  tituloPadraoEscala,
  type ItemPrevia,
  type LetraTurno,
  type ProblemaImportacao,
  type TipoServico,
} from 'contratos';
import { normalizar, normalizarHora } from 'dominio';
import { faixasDosTurnos } from '../cadastros/escalas-regras.ts';
import { gravarServicosDaEscala, gravarVinculos, mensagemServicoComAlocacao, servicoComAlocacaoQueSai } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { coluna, lerMes, type Aba } from './planilha.ts';
import type { ColunaModelo, Contexto, Importador } from './tipos.ts';

const ABA_T = 'TURNOS';
const ABA_E = 'ESCALAS';
const ABA_V = 'GUARNIÇÕES POR ESCALA';
const LETRAS: LetraTurno[] = ['A', 'B', 'C'];

const COLUNAS_T = {
  servico: { rotulo: 'SERVIÇO', obrigatoria: true, ajuda: 'Nome do serviço (ex.: Pronto). Uma linha por turno.' },
  turno: { rotulo: 'TURNO', obrigatoria: true, ajuda: 'Letra do turno: A, B ou C. Serviço de um turno só usa A.', opcoes: ['A', 'B', 'C'] },
  inicio: { rotulo: 'HORÁRIO INÍCIO', obrigatoria: true, ajuda: 'Hora de início (HH:MM, ex.: 08:00).' },
  fim: { rotulo: 'HORÁRIO FIM', obrigatoria: true, ajuda: 'Hora de fim (HH:MM). Menor que o início atravessa a meia-noite; igual dá 24h.' },
  tipo: { rotulo: 'TIPO DE SERVIÇO', obrigatoria: false, ajuda: 'ORDINÁRIO, PJES ou DIÁRIA. Vazio, o tipo sai do nome do serviço.', opcoes: ['ORDINÁRIO', 'PJES', 'DIÁRIA'] },
  origem: { rotulo: 'ORIGEM', obrigatoria: false, ajuda: 'Nome do serviço no documento impresso, quando for diferente (ex.: PJES para o JES).' },
} satisfies Record<string, ColunaModelo>;

const COLUNAS_E = {
  escala: { rotulo: 'ESCALA', obrigatoria: true, ajuda: 'Nome da escala.' },
  servicos: { rotulo: 'SERVIÇOS', obrigatoria: false, ajuda: 'Serviços da escala, na ordem de preenchimento, separados por vírgula (ex.: Pronto, JES, Saldo). Vazio vale o serviço com o nome da escala.' },
  titulo: { rotulo: 'TÍTULO', obrigatoria: false, ajuda: 'Título no documento. Vazio vale "ESCALA <NOME>".' },
  militares: { rotulo: 'MILITARES', obrigatoria: false, ajuda: 'TODOS ou ESCALADOS: quem aparece no documento. Vazio vale ESCALADOS.', opcoes: ['TODOS', 'ESCALADOS'] },
  dias: { rotulo: 'DIAS', obrigatoria: false, ajuda: 'TODOS ou SÓ ESCALADOS: quais dias aparecem no documento. Vazio vale TODOS.', opcoes: ['TODOS', 'SÓ ESCALADOS'] },
} satisfies Record<string, ColunaModelo>;

const COLUNAS_V = {
  vigencia: { rotulo: 'VIGÊNCIA', obrigatoria: false, ajuda: 'Mês a partir do qual a linha vale (aaaa-mm ou mm/aaaa). Vazio vale desde a criação da seção.' },
  escala: { rotulo: 'ESCALA', obrigatoria: true, ajuda: 'Nome da escala (aba ESCALAS ou já cadastrada).' },
  turno: { rotulo: 'TURNO', obrigatoria: false, ajuda: 'Vazio ou TODOS: todas as faixas da escala. Letra (A, B, C) quando ela tem um horário só na escala, ou a faixa (ex.: 08:00-20:00). Várias, separadas por vírgula.' },
  guarnicao: { rotulo: 'GUARNIÇÃO', obrigatoria: true, ajuda: 'Nome da guarnição, como na tela de Guarnições.' },
} satisfies Record<string, ColunaModelo>;

type TurnoPlano = { letra: LetraTurno; inicio: string; fim: string; existenteId: string | null };
type ServicoPlano = { chave: string; nome: string; existenteId: string | null; tipo: TipoServico; rotulo: string | null; cor: string; mudarDados: boolean; turnos: TurnoPlano[] };
type EscalaPlano = {
  chave: string;
  nome: string;
  existenteId: string | null;
  titulo: string;
  militaresDoc: 'todos' | 'escalados';
  diasDoc: 'todos' | 'com_escalados';
  mudarDados: boolean;
  /** chaves dos serviços, na ordem; null mantém a lista */
  servicos: string[] | null;
};
type VinculoPlano = { escalaChave: string; vigencia: string; itens: { guarnicaoId: string; inicio: string; fim: string }[] };
type Plano = { servicos: ServicoPlano[]; escalas: EscalaPlano[]; vinculos: VinculoPlano[] };

const TIPO_POR_TERMO: Record<string, TipoServico> = {
  ORDINARIO: 'ordinario', PRONTO: 'ordinario', SALDO: 'ordinario', EXPEDIENTE: 'ordinario',
  JES: 'pjes', PJES: 'pjes',
  DIARIA: 'diaria',
};

function corDoNome(nome: string): string {
  const k = Object.keys(CORES_SERVICO).find((n) => normalizar(n) === normalizar(nome));
  return k ? CORES_SERVICO[k]! : COR_PADRAO_SERVICO;
}

function letraDe(texto: string): LetraTurno | null {
  const n = normalizar(texto);
  if (n === 'U' || n === 'UNICO') return 'A';
  return (LETRAS as string[]).includes(n) ? (n as LetraTurno) : null;
}

const colunasDe = <K extends string>(aba: Aba, cols: Record<K, ColunaModelo>) =>
  Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, coluna(aba, (v as ColunaModelo).rotulo)])) as Record<K, number>;
const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
const NOME_TIPO: Record<TipoServico, string> = { ordinario: 'Ordinário', pjes: 'PJES', diaria: 'Diária' };
/** Limites dos campos na tela (contratos `Nome` e o nome na impressão): o que entra pela planilha precisa caber neles. */
const MAX_NOME = 120;
const MAX_ROTULO = 60;
const curto = (t: string) => (t.length > 30 ? `${t.slice(0, 30)}…` : t);
const intervalo = (t: { inicio: string; fim: string }) => `${t.inicio}–${t.fim}`;
const NOME_MILITARES = { todos: 'todos os militares', escalados: 'só os escalados' };
const NOME_DIAS = { todos: 'todos os dias', com_escalados: 'só os dias com escalados' };

async function guarnicoesDaUnidade(ctx: Contexto) {
  const rows = (await ctx.tx.query<{ id: string; nome: string }>('select id, nome from guarnicao where unidade_id = $1', [ctx.unidadeId])).rows;
  const versoes = await versoesDasGuarnicoes(ctx.tx, rows.map((g) => g.id));
  return rows.map((g) => ({ ...g, versoes: versoes.get(g.id)! }));
}

export const importadorServicosEscalas: Importador<Plano> = {
  abas: [ABA_T, ABA_E, ABA_V],

  modelo: {
    abas: [
      { nome: ABA_T, colunas: Object.values(COLUNAS_T) },
      { nome: ABA_E, colunas: Object.values(COLUNAS_E) },
      { nome: ABA_V, colunas: Object.values(COLUNAS_V) },
    ],
    async valores(ctx) {
      const servicos = (await ctx.tx.query<{ nome: string; tipo: TipoServico }>('select nome, tipo from servico where unidade_id = $1 order by nome', [ctx.unidadeId])).rows;
      const escalas = (await ctx.tx.query<{ nome: string }>('select nome from escala where unidade_id = $1 order by nome', [ctx.unidadeId])).rows;
      const mes = ctx.hoje.slice(0, 7);
      const ativas = (await guarnicoesDaUnidade(ctx)).filter((g) => versaoNoMes(g.versoes, mes)?.ativa).map((g) => g.nome).sort();
      return [
        { titulo: 'Serviços cadastrados (coluna SERVIÇO e SERVIÇOS)', itens: servicos.length ? servicos.map((s) => `${s.nome} (${NOME_TIPO[s.tipo]})`) : ['Nenhum ainda.'] },
        { titulo: 'Escalas cadastradas (coluna ESCALA)', itens: escalas.length ? escalas.map((e) => e.nome) : ['Nenhuma ainda.'] },
        { titulo: 'Guarnições ativas (coluna GUARNIÇÃO)', itens: ativas.length ? ativas : ['Nenhuma ainda: importe a aba GUARNIÇÕES na tela de Guarnições.'] },
      ];
    },
  },

  async planejar(abas, ctx) {
    const { tx, unidadeId } = ctx;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    let iguais = 0;
    const plano: Plano = { servicos: [], escalas: [], vinculos: [] };

    const aT = abas[ABA_T]!;
    const aE = abas[ABA_E]!;
    const aV = abas[ABA_V]!;
    const cT = colunasDe(aT, COLUNAS_T);
    const cE = colunasDe(aE, COLUNAS_E);
    const cV = colunasDe(aV, COLUNAS_V);
    for (const [aba, cols, idx] of [[ABA_T, COLUNAS_T, cT], [ABA_E, COLUNAS_E, cE], [ABA_V, COLUNAS_V, cV]] as const) {
      for (const [k, col] of Object.entries(cols) as [string, ColunaModelo][]) {
        if (col.obrigatoria && (idx as Record<string, number>)[k]! < 0) problemas.push({ aba, linha: 1, mensagem: `Falta a coluna ${col.rotulo}.`, solucao: 'Use o modelo desta tela.' });
      }
    }
    if (problemas.length) return { previa: { novos, alterados, iguais, problemas, avisos }, plano };

    // ---------- TURNOS ----------
    type ServicoLido = { nome: string; tipoTexto: string; origem: string; temOrigem: boolean; turnos: Map<LetraTurno, { inicio: string; fim: string; linha: number }> };
    const lidos = new Map<string, ServicoLido>();
    for (const l of aT.linhas) {
      const nome = pega(l.celulas, cT.servico);
      if (!nome) continue;
      if (nome.length > MAX_NOME) {
        problemas.push({ aba: ABA_T, linha: l.linha, mensagem: `Serviço "${curto(nome)}" tem mais de ${MAX_NOME} caracteres`, solucao: 'Encurte o nome na coluna SERVIÇO.' });
        continue;
      }
      const origemDaLinha = pega(l.celulas, cT.origem);
      if (origemDaLinha.length > MAX_ROTULO) {
        problemas.push({ aba: ABA_T, linha: l.linha, mensagem: `ORIGEM de ${nome} tem mais de ${MAX_ROTULO} caracteres`, solucao: 'Encurte o texto na coluna ORIGEM.' });
        continue;
      }
      const bruta = pega(l.celulas, cT.turno);
      const letra = letraDe(bruta);
      if (!letra) {
        problemas.push({ aba: ABA_T, linha: l.linha, mensagem: `Turno "${bruta}" de ${nome}`, solucao: 'Use A, B ou C na coluna TURNO.' });
        continue;
      }
      const ini = pega(l.celulas, cT.inicio);
      const fim = pega(l.celulas, cT.fim);
      const inicio = normalizarHora(ini);
      const termino = normalizarHora(fim);
      if (!inicio || !termino) {
        problemas.push({ aba: ABA_T, linha: l.linha, mensagem: `Horário "${!inicio ? ini : fim}" de ${nome} ${letra}`, solucao: 'Use HH:MM (ex.: 08:00).' });
        continue;
      }
      // o serviço só entra com pelo menos uma linha válida: linha com problema não cria nada
      const k = normalizar(nome);
      const s = lidos.get(k) ?? { nome, tipoTexto: '', origem: '', temOrigem: cT.origem >= 0, turnos: new Map() };
      lidos.set(k, s);
      for (const [campo, rotulo, valor] of [['tipoTexto', 'TIPO DE SERVIÇO', pega(l.celulas, cT.tipo)], ['origem', 'ORIGEM', origemDaLinha]] as const) {
        if (!valor) continue;
        if (!s[campo]) s[campo] = valor;
        else if (normalizar(s[campo]) !== normalizar(valor)) avisos.push(`${nome}: ${rotulo} diferente em linhas diferentes ("${s[campo]}" e "${valor}"); vale o primeiro.`);
      }
      if (s.turnos.has(letra)) {
        avisos.push(`${nome}: o turno ${letra} aparece em mais de uma linha; vale o primeiro.`);
        continue;
      }
      s.turnos.set(letra, { inicio, fim: termino, linha: l.linha });
    }

    const servicosSistema = (
      await tx.query<{ id: string; nome: string; tipo: TipoServico; rotulo_impressao: string | null }>('select id, nome, tipo, rotulo_impressao from servico where unidade_id = $1', [unidadeId])
    ).rows;
    const turnosSistema = servicosSistema.length
      ? (
          await tx.query<{ id: string; servico_id: string; letra: LetraTurno; inicio: string; fim: string }>(
            `select id, servico_id, letra, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where servico_id = any($1)`,
            [servicosSistema.map((s) => s.id)],
          )
        ).rows
      : [];
    const sistemaPorChave = new Map(servicosSistema.map((s) => [normalizar(s.nome), s]));
    // cota só existe para PJES e diária: o serviço com cotas não vira ordinário pela planilha
    const cotasDoServico = new Map(
      (await tx.query<{ servico_id: string; n: number }>('select servico_id, count(*)::int as n from cota where unidade_id = $1 group by servico_id', [unidadeId])).rows.map((r) => [r.servico_id, r.n] as const),
    );
    /** letras de cada serviço depois da importação, pela chave normalizada */
    const turnosDoServico = new Map<string, Map<LetraTurno, { inicio: string; fim: string }>>();
    for (const s of servicosSistema) {
      turnosDoServico.set(normalizar(s.nome), new Map(turnosSistema.filter((t) => t.servico_id === s.id).map((t) => [t.letra, { inicio: t.inicio, fim: t.fim }] as const)));
    }

    for (const [chave, s] of lidos) {
      const ex = sistemaPorChave.get(chave);
      const doTexto = s.tipoTexto ? TIPO_POR_TERMO[normalizar(s.tipoTexto)] : undefined;
      const doNome = TIPO_POR_TERMO[normalizar(s.nome)];
      // serviço fixo: o tipo é o dele, e pedir outro é problema na linha (o banco recusaria na gravação)
      const tipoFixo = tipoDoServicoFixo(s.nome);
      if (tipoFixo && doTexto && doTexto !== tipoFixo) {
        const linhasDoFixo = [...s.turnos.values()].map((t) => t.linha);
        problemas.push({
          aba: ABA_T,
          linha: linhasDoFixo.length ? Math.min(...linhasDoFixo) : 1,
          mensagem: `${ex?.nome ?? s.nome}: o serviço é fixo e o tipo não muda`,
          solucao: `Deixe o TIPO DE SERVIÇO de ${ex?.nome ?? s.nome} como ${NOME_TIPO[tipoFixo]} (ou em branco).`,
        });
        continue;
      }
      const rotulo = s.origem && normalizar(s.origem) !== chave ? s.origem : null;
      const turnos: TurnoPlano[] = [];
      const mudancas: string[] = [];
      const horarios = turnosDoServico.get(chave) ?? new Map<LetraTurno, { inicio: string; fim: string }>();
      turnosDoServico.set(chave, horarios);
      for (const [letra, t] of [...s.turnos].sort((a, b) => LETRAS.indexOf(a[0]) - LETRAS.indexOf(b[0]))) {
        horarios.set(letra, { inicio: t.inicio, fim: t.fim });
        const atual = ex ? turnosSistema.find((x) => x.servico_id === ex.id && x.letra === letra) : undefined;
        if (!atual) {
          turnos.push({ letra, ...t, existenteId: null });
          if (ex) mudancas.push(`Turno ${letra} novo: ${intervalo(t)}`);
        } else if (atual.inicio !== t.inicio || atual.fim !== t.fim) {
          turnos.push({ letra, ...t, existenteId: atual.id });
          mudancas.push(`Turno ${letra}: de ${intervalo(atual)} para ${intervalo(t)}`);
        }
      }
      if (!ex) {
        const tipo = doTexto ?? tipoFixo ?? doNome ?? 'diaria';
        if (s.tipoTexto && !doTexto) avisos.push(`Serviço ${s.nome}: TIPO DE SERVIÇO "${s.tipoTexto}" não reconhecido; vale ${NOME_TIPO[tipo]}.`);
        else if (!doTexto && !doNome) avisos.push(`Confira o tipo do serviço ${s.nome}: entrou como diária.`);
        const letrasTxt = [...s.turnos.keys()].sort((a, b) => LETRAS.indexOf(a) - LETRAS.indexOf(b)).join(', ');
        novos.push({ chave: `Serviço ${s.nome}`, descricao: letrasTxt ? `${s.nome} (turnos ${letrasTxt})` : s.nome });
        plano.servicos.push({ chave, nome: s.nome, existenteId: null, tipo, rotulo, cor: corDoNome(s.nome), mudarDados: false, turnos });
        continue;
      }
      // serviço que já existe: o tipo só muda pela coluna TIPO DE SERVIÇO, e o rótulo só pela ORIGEM
      const tipo = doTexto ?? ex.tipo;
      const cotas = cotasDoServico.get(ex.id) ?? 0;
      if (tipo === 'ordinario' && ex.tipo !== 'ordinario' && cotas > 0) {
        const linhasDoServico = [...s.turnos.values()].map((t) => t.linha);
        problemas.push({
          aba: ABA_T,
          linha: linhasDoServico.length ? Math.min(...linhasDoServico) : 1,
          mensagem: `${ex.nome}: o serviço tem ${cotas} ${cotas === 1 ? 'cota' : 'cotas'} de operações e não pode virar Ordinário`,
          solucao: `Apague ${cotas === 1 ? 'a cota' : 'as cotas'} na tela de Cotas antes de mudar o tipo.`,
        });
        continue;
      }
      if (s.tipoTexto && !doTexto) avisos.push(`Serviço ${s.nome}: TIPO DE SERVIÇO "${s.tipoTexto}" não reconhecido; vale ${NOME_TIPO[tipo]}.`);
      const novoRotulo = s.temOrigem ? rotulo : ex.rotulo_impressao;
      const mudarDados = tipo !== ex.tipo || novoRotulo !== ex.rotulo_impressao;
      if (tipo !== ex.tipo) mudancas.unshift(`Tipo: de ${NOME_TIPO[ex.tipo]} para ${NOME_TIPO[tipo]}`);
      if (novoRotulo !== ex.rotulo_impressao) mudancas.unshift(`Nome na impressão: de "${ex.rotulo_impressao ?? ''}" para "${novoRotulo ?? ''}"`);
      if (mudancas.length) {
        alterados.push({ chave: `Serviço ${ex.nome}`, descricao: ex.nome, mudancas });
        plano.servicos.push({ chave, nome: ex.nome, existenteId: ex.id, tipo, rotulo: novoRotulo, cor: '', mudarDados, turnos });
      } else iguais++;
    }
    const nomeDoServico = new Map<string, string>([...servicosSistema.map((s) => [normalizar(s.nome), s.nome] as const), ...[...lidos].map(([k, s]) => [k, s.nome] as const)]);

    // ---------- ESCALAS ----------
    /** escalas cuja linha em ESCALAS virou problema: os vínculos delas dizem que ficaram de fora */
    const descartadas = new Set<string>();
    type Grupo = { nome: string; linha: number; pedidos: string[]; titulo: string; militares: string; dias: string };
    const grupos = new Map<string, Grupo>();
    for (const l of aE.linhas) {
      const nome = pega(l.celulas, cE.escala);
      if (!nome) continue;
      const titulo = pega(l.celulas, cE.titulo);
      if (nome.length > MAX_NOME || titulo.length > MAX_NOME) {
        problemas.push({
          aba: ABA_E,
          linha: l.linha,
          mensagem: nome.length > MAX_NOME ? `Escala "${curto(nome)}" tem mais de ${MAX_NOME} caracteres` : `TÍTULO de ${nome} tem mais de ${MAX_NOME} caracteres`,
          solucao: nome.length > MAX_NOME ? 'Encurte o nome na coluna ESCALA.' : 'Encurte o texto na coluna TÍTULO.',
        });
        descartadas.add(normalizar(nome));
        continue;
      }
      const k = normalizar(nome);
      const g = grupos.get(k) ?? { nome, linha: l.linha, pedidos: [], titulo: '', militares: '', dias: '' };
      grupos.set(k, g);
      for (const p of pega(l.celulas, cE.servicos).split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
        if (!g.pedidos.some((x) => normalizar(x) === normalizar(p))) g.pedidos.push(p);
      }
      for (const [campo, rotulo, valor] of [['titulo', 'TÍTULO', pega(l.celulas, cE.titulo)], ['militares', 'MILITARES', pega(l.celulas, cE.militares)], ['dias', 'DIAS', pega(l.celulas, cE.dias)]] as const) {
        if (!valor) continue;
        if (!g[campo]) g[campo] = valor;
        else if (normalizar(g[campo]) !== normalizar(valor)) avisos.push(`Escala ${nome}: ${rotulo} diferente em linhas diferentes ("${g[campo]}" e "${valor}"); vale o primeiro.`);
      }
    }

    const escalasSistema = (
      await tx.query<{ id: string; nome: string; titulo: string; militares_doc: 'todos' | 'escalados'; dias_doc: 'todos' | 'com_escalados' }>(
        'select id, nome, titulo, militares_doc, dias_doc from escala where unidade_id = $1',
        [unidadeId],
      )
    ).rows;
    const servicosDasEscalas = escalasSistema.length
      ? (
          await tx.query<{ escala_id: string; servico_id: string; nome: string }>(
            'select es.escala_id, es.servico_id, s.nome from escala_servico es join servico s on s.id = es.servico_id where es.escala_id = any($1) order by es.ordem',
            [escalasSistema.map((e) => e.id)],
          )
        ).rows
      : [];
    const escalaSistemaPorChave = new Map(escalasSistema.map((e) => [normalizar(e.nome), e]));
    /** serviços (chaves) de cada escala depois da importação; serve para as letras dos vínculos */
    const servicosDaEscala = new Map<string, string[]>();
    for (const e of escalasSistema) servicosDaEscala.set(normalizar(e.nome), servicosDasEscalas.filter((x) => x.escala_id === e.id).map((x) => normalizar(x.nome)));

    for (const [chave, g] of grupos) {
      const pedidos = g.pedidos.length ? g.pedidos : [g.nome];
      const faltando = pedidos.filter((p) => !nomeDoServico.has(normalizar(p)));
      if (faltando.length) {
        descartadas.add(chave);
        problemas.push({
          aba: ABA_E,
          linha: g.linha,
          mensagem: `Escala ${g.nome}: ${faltando.length > 1 ? 'os serviços' : 'o serviço'} ${faltando.join(', ')} ${faltando.length > 1 ? 'não existem' : 'não existe'}`,
          solucao: 'Cadastre o serviço na aba TURNOS ou corrija o nome em SERVIÇOS.',
        });
        continue;
      }
      const servicos = pedidos.map((p) => normalizar(p));
      const nm = normalizar(g.militares);
      if (g.militares && nm !== 'TODOS' && nm !== 'ESCALADOS') avisos.push(`Escala ${g.nome}: MILITARES deve ser TODOS ou ESCALADOS (achei "${g.militares}"); vale ESCALADOS.`);
      const militaresDoc = nm === 'TODOS' ? 'todos' : 'escalados';
      const nd = normalizar(g.dias);
      // normalizar tira os espaços: "SÓ ESCALADOS" vira SOESCALADOS e "COM ESCALADOS" vira COMESCALADOS
      const diasDoc = nd.startsWith('SO') || nd.startsWith('COM') ? 'com_escalados' : 'todos';
      const titulo = g.titulo || tituloPadraoEscala(g.nome);
      const ex = escalaSistemaPorChave.get(chave);
      if (!ex) {
        servicosDaEscala.set(chave, servicos);
        novos.push({ chave: `Escala ${g.nome}`, descricao: `${g.nome} (${servicos.map((s) => nomeDoServico.get(s)).join(', ')})` });
        plano.escalas.push({ chave, nome: g.nome, existenteId: null, titulo, militaresDoc, diasDoc, mudarDados: true, servicos });
        continue;
      }
      const mudancas: string[] = [];
      if (titulo !== ex.titulo) mudancas.push(`Título: de "${ex.titulo}" para "${titulo}"`);
      if (militaresDoc !== ex.militares_doc) mudancas.push(`Militares: de ${NOME_MILITARES[ex.militares_doc]} para ${NOME_MILITARES[militaresDoc]}`);
      if (diasDoc !== ex.dias_doc) mudancas.push(`Dias: de ${NOME_DIAS[ex.dias_doc]} para ${NOME_DIAS[diasDoc]}`);
      const antes = servicosDaEscala.get(chave) ?? [];
      let novosServicos: string[] | null = null;
      if (antes.join('|') !== servicos.join('|')) {
        const ids = servicos.map((s) => sistemaPorChave.get(s)?.id).filter((x): x is string => Boolean(x));
        const sai = await servicoComAlocacaoQueSai(tx, ex.id, ids);
        if (sai) {
          problemas.push({ aba: ABA_E, linha: g.linha, mensagem: `Escala ${g.nome}: ${mensagemServicoComAlocacao(sai)}`, solucao: 'Mantenha o serviço em SERVIÇOS ou tire os militares dele antes.' });
          continue;
        }
        novosServicos = servicos;
        servicosDaEscala.set(chave, servicos);
        mudancas.push(`Serviços: de ${antes.map((s) => nomeDoServico.get(s)).join(', ') || 'nenhum'} para ${servicos.map((s) => nomeDoServico.get(s)).join(', ')}`);
      }
      if (mudancas.length) {
        alterados.push({ chave: `Escala ${ex.nome}`, descricao: ex.nome, mudancas });
        plano.escalas.push({ chave, nome: ex.nome, existenteId: ex.id, titulo, militaresDoc, diasDoc, mudarDados: mudancas.some((m) => !m.startsWith('Serviços')), servicos: novosServicos });
      } else iguais++;
    }

    // ---------- GUARNIÇÕES POR ESCALA ----------
    const criacao = (await tx.query<{ mes: string }>("select to_char(desde, 'YYYY-MM') as mes from unidade where id = $1", [unidadeId])).rows[0]!.mes;
    const guarnicoes = await guarnicoesDaUnidade(ctx);
    const guarnicaoPorChave = new Map(guarnicoes.map((g) => [normalizar(g.nome), g]));
    const nomeDaEscala = new Map<string, string>([...escalasSistema.map((e) => [normalizar(e.nome), e.nome] as const), ...[...grupos].map(([k, g]) => [k, g.nome] as const)]);
    /** faixas da escala depois da importação: os turnos dos serviços dela, do sistema e da planilha */
    const faixasDaEscalaImportada = (chave: string) =>
      faixasDosTurnos(
        (servicosDaEscala.get(chave) ?? []).flatMap((sv) =>
          [...(turnosDoServico.get(sv) ?? new Map<LetraTurno, { inicio: string; fim: string }>())].map(([letra, h]) => ({ servico: nomeDoServico.get(sv) ?? sv, letra, ...h })),
        ),
      ).faixas;
    const versoes = new Map<string, Map<string, Map<string, { guarnicaoId: string; inicio: string; fim: string; nome: string }>>>();
    const avisosDesativada = new Set<string>();
    /** guarnições cuja linha tem problema, por (escala, vigência): ficam com o que já tinham gravado, em vez de perder o vínculo */
    const preservar = new Map<string, Map<string, string>>();
    for (const l of aV.linhas) {
      const nomeEsc = pega(l.celulas, cV.escala);
      const nomeG = pega(l.celulas, cV.guarnicao);
      if (!nomeEsc && !nomeG) continue;
      const chave = normalizar(nomeEsc);
      if (nomeEsc && descartadas.has(chave)) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `Escala ${nomeEsc} ficou de fora`, solucao: 'Resolva o problema dessa escala na aba ESCALAS.' });
        continue;
      }
      if (!nomeEsc || !servicosDaEscala.has(chave)) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `Escala ${nomeEsc || '(vazia)'} não cadastrada`, solucao: 'Confira a aba ESCALAS.' });
        continue;
      }
      const vigBruta = pega(l.celulas, cV.vigencia);
      const vigLida = lerMes(vigBruta);
      if (vigLida === null) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `Vigência "${vigBruta}" de ${nomeDaEscala.get(chave)}`, solucao: 'Use aaaa-mm ou mm/aaaa.' });
        continue;
      }
      // como na tela: o mês que já passou não muda (vigência vazia vale desde a criação da seção e não entra nesta conferência)
      if (vigLida && vigLida < ctx.hoje.slice(0, 7)) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `Mês já passou na linha ${l.linha}: ${nomeDaEscala.get(chave)}, ${mesPorExtenso(vigLida)}`, solucao: 'Use o mês atual ou um mês futuro.' });
        continue;
      }
      const vigencia = vigLida || criacao;
      const g = guarnicaoPorChave.get(normalizar(nomeG));
      if (!g) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `Guarnição ${nomeG || '(vazia)'} não cadastrada`, solucao: 'Importe a aba GUARNIÇÕES (tela de Guarnições) e depois esta.' });
        continue;
      }
      // a célula TURNO: vazia ou TODOS = todas as faixas da escala; senão faixas ("08:00-20:00") ou letras ("A", "A/B"), várias separadas por vírgula
      const nomeEsc2 = nomeDaEscala.get(chave)!;
      const faixasEscala = faixasDaEscalaImportada(chave);
      if (!faixasEscala.length) {
        problemas.push({ aba: ABA_V, linha: l.linha, mensagem: `A escala ${nomeEsc2} não tem turnos`, solucao: 'Cadastre os turnos dos serviços na aba TURNOS.' });
        continue;
      }
      const turnoBruto = pega(l.celulas, cV.turno);
      const partes = turnoBruto.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      let escolhidas = faixasEscala.map((f) => ({ inicio: f.inicio, fim: f.fim }));
      let invalida: { mensagem: string; solucao: string } | null = null;
      if (partes.length && !partes.some((p) => normalizar(p) === 'TODOS')) {
        escolhidas = [];
        for (const parte of partes) {
          // faixa: "08:00-20:00", "08-20", "08h às 20h", "8 as 20", "8 a 20"
          const m = /^(.+?)(?:\s*[-–]\s*|\s+(?:às|as|a)\s+)(.+)$/i.exec(parte);
          const hora = (x: string) => normalizarHora(/^\d{1,2}$/.test(x.trim()) ? `${x.trim()}:00` : x);
          const ini = m ? hora(m[1]!) : null;
          const fim = m ? hora(m[2]!) : null;
          if (/\d/.test(parte) && !(ini && fim)) {
            // tem número mas não forma uma faixa: horário que não existe ou escrito de um jeito que não se lê
            invalida = { mensagem: `Horário "${parte}" de ${nomeEsc2}`, solucao: 'Escreva a faixa como 08:00-20:00.' };
            break;
          }
          if (ini && fim) {
            if (!faixasEscala.some((f) => f.inicio === ini && f.fim === fim)) {
              invalida = { mensagem: `Faixa ${textoFaixa(ini, fim)} não existe nos serviços da escala ${nomeEsc2}`, solucao: 'Confira a coluna TURNO ou os horários na aba TURNOS.' };
              break;
            }
            escolhidas.push({ inicio: ini, fim });
            continue;
          }
          for (const letraTexto of parte.split(/[\s/]+/).filter(Boolean)) {
            const letra = letraDe(letraTexto);
            const dela = letra ? faixasEscala.filter((f) => f.letras.includes(letra)) : [];
            if (dela.length === 0) {
              invalida = { mensagem: `Turno ${letraTexto} não existe nos serviços da escala ${nomeEsc2}`, solucao: 'Confira a coluna TURNO ou os SERVIÇOS da escala.' };
              break;
            }
            if (dela.length > 1) {
              invalida = {
                mensagem: `Turno ${letra} tem horários diferentes nos serviços da escala ${nomeEsc2} (${dela.map((f) => textoFaixa(f.inicio, f.fim)).join(', ')})`,
                solucao: 'Escreva a faixa na coluna TURNO (ex.: 08:00-20:00).',
              };
              break;
            }
            escolhidas.push({ inicio: dela[0]!.inicio, fim: dela[0]!.fim });
          }
          if (invalida) break;
        }
      }
      if (invalida) {
        const k = `${chave}|${vigencia}`;
        preservar.set(k, (preservar.get(k) ?? new Map<string, string>()).set(g.id, g.nome));
        problemas.push({ aba: ABA_V, linha: l.linha, ...invalida });
        continue;
      }
      if (versaoNoMes(g.versoes, vigencia)?.ativa === false) avisosDesativada.add(`${g.nome} está desativada em ${mesPorExtenso(vigencia)}; o vínculo fica gravado.`);
      const porVig = versoes.get(chave) ?? new Map();
      versoes.set(chave, porVig);
      const itens = porVig.get(vigencia) ?? new Map();
      porVig.set(vigencia, itens);
      for (const f of escolhidas) {
        const k = `${g.id}|${f.inicio}|${f.fim}`;
        if (itens.has(k)) {
          avisos.push(`${nomeEsc2}: ${g.nome} já está na faixa ${textoFaixa(f.inicio, f.fim)} em ${mesPorExtenso(vigencia)}; a repetição foi ignorada.`);
          continue;
        }
        itens.set(k, { guarnicaoId: g.id, inicio: f.inicio, fim: f.fim, nome: g.nome });
      }
    }
    avisos.push(...avisosDesativada);

    const versoesSistema = escalasSistema.length
      ? (
          await tx.query<{ escala_id: string; vigencia: string; guarnicao_id: string | null; inicio: string | null; fim: string | null }>(
            `select v.escala_id, to_char(v.vigencia_desde, 'YYYY-MM') as vigencia, eg.guarnicao_id, to_char(eg.inicio, 'HH24:MI') as inicio, to_char(eg.fim, 'HH24:MI') as fim
               from escala_vinculo_versao v left join escala_guarnicao eg on eg.versao_id = v.id
              where v.escala_id = any($1)`,
            [escalasSistema.map((e) => e.id)],
          )
        ).rows
      : [];
    const assinatura = (itens: { guarnicaoId: string; inicio: string; fim: string }[]) => itens.map((i) => `${i.guarnicaoId}|${i.inicio}|${i.fim}`).sort().join(',');
    for (const [chave, porVig] of versoes) {
      const ex = escalaSistemaPorChave.get(chave);
      const nome = nomeDaEscala.get(chave)!;
      const mudancas: string[] = [];
      let anterior: string | null = null;
      for (const vigencia of [...porVig.keys()].sort()) {
        const doMes = ex ? versoesSistema.filter((v) => v.escala_id === ex.id && v.vigencia === vigencia) : [];
        // a linha com problema não apaga o que já estava gravado: a guarnição mantém as faixas do sistema naquele mês
        const mapa = porVig.get(vigencia)!;
        for (const [gid, gnome] of preservar.get(`${chave}|${vigencia}`) ?? []) {
          if ([...mapa.values()].some((i) => i.guarnicaoId === gid)) continue; // tem outra linha válida: vale a planilha
          const dela = doMes.filter((v) => v.guarnicao_id === gid);
          for (const r of dela) mapa.set(`${gid}|${r.inicio}|${r.fim}`, { guarnicaoId: gid, inicio: r.inicio!, fim: r.fim!, nome: gnome });
          if (dela.length) avisos.push(`${nome}: ${gnome} manteve os horários que já tinha em ${mesPorExtenso(vigencia)}, porque a linha dela tem problema.`);
        }
        const itens = [...mapa.values()];
        const ass = assinatura(itens);
        // a igual à anterior da própria planilha é redundante: só vale se o sistema já tem versão nesse mês
        const redundante = anterior === ass;
        anterior = ass;
        if (!doMes.length && redundante) continue;
        if (doMes.length && assinatura(doMes.filter((v) => v.guarnicao_id).map((v) => ({ guarnicaoId: v.guarnicao_id!, inicio: v.inicio!, fim: v.fim! }))) === ass) continue;
        const porGuarnicao = new Map<string, string[]>();
        for (const i of itens) porGuarnicao.set(i.nome, [...(porGuarnicao.get(i.nome) ?? []), textoFaixa(i.inicio, i.fim)]);
        mudancas.push(`${mesPorExtenso(vigencia)}: ${[...porGuarnicao].map(([n, fs]) => `${n} (${fs.join(', ')})`).join(', ')}`);
        plano.vinculos.push({ escalaChave: chave, vigencia, itens: itens.map(({ guarnicaoId, inicio, fim }) => ({ guarnicaoId, inicio, fim })) });
      }
      if (!mudancas.length) iguais++;
      else if (!ex || !versoesSistema.some((v) => v.escala_id === ex.id)) novos.push({ chave: `Guarnições de ${nome}`, descricao: `Guarnições de ${nome}: ${mudancas.join('; ')}` });
      else alterados.push({ chave: `Guarnições de ${nome}`, descricao: `Guarnições de ${nome}`, mudancas });
    }

    problemas.sort((a, b) => [ABA_T, ABA_E, ABA_V].indexOf(a.aba) - [ABA_T, ABA_E, ABA_V].indexOf(b.aba) || a.linha - b.linha);
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano };
  },

  async aplicar(plano, { tx, unidadeId }) {
    const servicoId = new Map<string, string>(
      (await tx.query<{ id: string; nome: string }>('select id, nome from servico where unidade_id = $1', [unidadeId])).rows.map((s) => [normalizar(s.nome), s.id]),
    );
    let gravados = 0;
    for (const s of plano.servicos) {
      let id = s.existenteId;
      if (!id) {
        id = (
          await tx.query<{ id: string }>('insert into servico (unidade_id, nome, tipo, rotulo_impressao, cor) values ($1, $2, $3, $4, $5) returning id', [unidadeId, s.nome, s.tipo, s.rotulo, s.cor])
        ).rows[0]!.id;
        servicoId.set(s.chave, id);
      } else if (s.mudarDados) {
        // operação só existe em diária: trocar o tipo para outro limpa a operação
        await tx.query("update servico set tipo = $2, rotulo_impressao = $3, operacao = case when $2 = 'diaria' then operacao else null end where id = $1", [id, s.tipo, s.rotulo]);
      }
      for (const t of s.turnos) {
        if (t.existenteId) await tx.query('update turno set inicio = $2, fim = $3 where id = $1', [t.existenteId, t.inicio, t.fim]);
        else await tx.query('insert into turno (servico_id, letra, inicio, fim) values ($1, $2, $3, $4)', [id, t.letra, t.inicio, t.fim]);
      }
      gravados++;
    }
    const escalaId = new Map<string, string>(
      (await tx.query<{ id: string; nome: string }>('select id, nome from escala where unidade_id = $1', [unidadeId])).rows.map((e) => [normalizar(e.nome), e.id]),
    );
    for (const e of plano.escalas) {
      let id = e.existenteId;
      if (!id) {
        id = (
          await tx.query<{ id: string }>('insert into escala (unidade_id, nome, titulo, militares_doc, dias_doc) values ($1, $2, $3, $4, $5) returning id', [unidadeId, e.nome, e.titulo, e.militaresDoc, e.diasDoc])
        ).rows[0]!.id;
        escalaId.set(e.chave, id);
      } else if (e.mudarDados) {
        await tx.query('update escala set titulo = $2, militares_doc = $3, dias_doc = $4 where id = $1', [id, e.titulo, e.militaresDoc, e.diasDoc]);
      }
      if (e.servicos) await gravarServicosDaEscala(tx, id, e.servicos.map((s) => servicoId.get(s)!));
      gravados++;
    }
    const escalasComVinculo = new Set<string>();
    for (const v of plano.vinculos) {
      await gravarVinculos(tx, escalaId.get(v.escalaChave)!, v.vigencia, v.itens);
      escalasComVinculo.add(v.escalaChave);
    }
    return gravados + escalasComVinculo.size;
  },
};
