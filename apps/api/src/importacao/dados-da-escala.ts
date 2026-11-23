// Importação "Dados da escala": atualiza, em lote, o que é da escala de quem já está cadastrado (equipe, jornada, motorista, CNH e voluntário JES).
// Nunca cria militar nem muda a lotação: o militar novo entra pelo Pecúlio, e a lotação é do Pecúlio.
import { mesPorExtenso, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { categoriasCnh, CICLO_EQUIPES, diasDoMes, normalizar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { coluna } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'DADOS DA ESCALA';
const SIM = ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'];

// rótulos lidos por planejar e escritos no cabeçalho do modelo: uma lista só
const COLUNAS = {
  mat: { rotulo: 'MATRÍCULA', obrigatoria: true, ajuda: '6 dígitos, hífen e 1 dígito (ex.: 123456-7). Sem o hífen, o sistema corrige e avisa. O militar precisa já estar cadastrado no Pecúlio.' },
  jornada: { rotulo: 'JORNADA', obrigatoria: true, ajuda: 'PRONTO (turnos de 12h) ou ADM (expediente).', opcoes: ['PRONTO', 'ADM'] },
  equipe: { rotulo: 'EQUIPE', obrigatoria: false, ajuda: 'Equipe do pronto (ex.: ALFA). Equipe que ainda não existe é criada. No ADM, deixe vazio.' },
  motorista: { rotulo: 'MOTORISTA', obrigatoria: false, ajuda: 'SIM se o militar está no quadro de motoristas.', opcoes: ['SIM', 'NÃO'] },
  vjes: { rotulo: 'VOLUNTÁRIO JES', obrigatoria: false, ajuda: 'SIM se o militar é voluntário JES.', opcoes: ['SIM', 'NÃO'] },
  cnh: { rotulo: 'CNH', obrigatoria: false, ajuda: 'Categorias da carteira, juntas (ex.: AD). Para a escala, só vale com o militar no quadro de motoristas.' },
} satisfies Record<string, ColunaModelo>;

type Dados = { motorista: boolean; cnh: string[]; voluntarioJes: boolean; equipe: string | null; jornada: 'pronto' | 'adm' };
/** `corrigir`: o período aberto começou neste mês ou depois e é ajustado no lugar; `transferir`: ele termina na véspera do dia 1 e outro abre. */
type Lotacao = { acao: 'corrigir'; id: string } | { acao: 'transferir'; id: string };
type ItemPlano = { id: string; dados: Dados; mudouMilitar: boolean; lotacao: Lotacao | null };
type Plano = { equipesNovas: { nome: string; ordem: number }[]; itens: ItemPlano[]; mes: string };

type Existente = {
  id: string;
  matricula: string;
  posto: string;
  nome_guerra: string;
  motorista: boolean;
  cnh: string[];
  voluntario_jes: boolean;
  lotacao_id: string | null;
  lotacao_unidade: string | null;
  lotacao_desde: string | null;
  /** dia da próxima lotação já registrada depois deste mês (transferência marcada) */
  futura: string | null;
  /** seção de outra unidade em que ele está lotado neste mês ou tem lotação marcada para depois (a mais próxima) */
  outra_sigla: string | null;
  equipe: string | null;
  jornada: 'pronto' | 'adm' | null;
};

/** '9902022' -> '990202-2'; formato certo passa direto; o resto é null. */
export function matriculaDe(bruto: string): { valor: string | null; corrigida: boolean } {
  const s = bruto.trim();
  if (/^\d{6}-\d$/.test(s)) return { valor: s, corrigida: false };
  if (/^\d{7}$/.test(s)) return { valor: `${s.slice(0, 6)}-${s.slice(6)}`, corrigida: true };
  return { valor: null, corrigida: false };
}

function diferencasDeLotacao(e: { equipe: string | null; jornada: string | null }, equipe: string | null, jornada: string): string[] {
  const m: string[] = [];
  if (normalizar(e.equipe ?? '') !== normalizar(equipe ?? '')) m.push(`equipe: ${e.equipe ?? 'sem equipe'} → ${equipe ?? 'sem equipe'}`);
  if (e.jornada !== jornada) m.push(`jornada: ${e.jornada} → ${jornada}`);
  return m;
}

const mesmaLista = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
const textoCnh = (c: string[]) => (c.length ? [...c].sort().join('') : 'nenhuma');

/**
 * Os militares do sistema, com a lotação que cobre o mês e a próxima já marcada (se houver). Com dois períodos no mês, o último de cada
 * militar na lista é o aberto, ou o mais recente: é com ele que a planilha se compara.
 */
async function existentes(tx: Consulta, mes: string, unidadeId: string): Promise<Map<string, Existente>> {
  const dias = diasDoMes(mes);
  const { rows } = await tx.query<Existente>(
    `select m.id, m.matricula, p.sigla as posto, m.nome_guerra, m.motorista, m.cnh, m.voluntario_jes,
            l.id as lotacao_id, l.unidade_id as lotacao_unidade, to_char(l.desde, 'YYYY-MM-DD') as lotacao_desde, e.nome as equipe, l.jornada,
            (select to_char(min(f.desde), 'YYYY-MM') from rastreio f where f.militar_id = m.id and f.desde > $2) as futura,
            (select ou.sigla from rastreio o join unidade ou on ou.id = o.unidade_id
              where o.militar_id = m.id and o.unidade_id <> $3 and (o.ate is null or o.ate >= $1) order by o.desde limit 1) as outra_sigla
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join rastreio l on l.militar_id = m.id and l.desde <= $2 and (l.ate is null or l.ate >= $1)
       left join equipe e on e.id = l.equipe_id
      order by m.id, (l.ate is null), l.desde`,
    [dias[0], dias[dias.length - 1], unidadeId],
  );
  return new Map(rows.map((r) => [r.matricula, r]));
}

export const importadorDadosDaEscala: Importador<Plano> = {
  abas: [ABA],

  modelo: {
    semSandbox: true,
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const equipes = (await tx.query<{ nome: string }>('select nome from equipe where unidade_id = $1 order by ordem_ciclo', [unidadeId])).rows;
      return [
        {
          titulo: 'Equipes da seção (coluna EQUIPE)',
          itens: equipes.length ? equipes.map((e) => e.nome) : ['Ainda não há equipes: a importação cria as que aparecerem na coluna EQUIPE.'],
        },
      ];
    },
  },

  async planejar(abas, { tx, unidadeId, hoje }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<keyof typeof COLUNAS, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const mes = hoje.slice(0, 7);
    const vazio = { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos }, plano: { equipesNovas: [], itens: [], mes } };
    if (c.mat < 0 || c.jornada < 0) {
      problemas.push({ aba: ABA, linha: 1, mensagem: 'Faltam as colunas MATRÍCULA ou JORNADA.', solucao: 'Baixe o modelo na tela de importação e cole os dados nele.' });
      return vazio;
    }

    const primeiroDia = `${mes}-01`;
    const unidade = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!;
    const equipesExistentes = (await tx.query<{ nome: string; ordem_ciclo: number }>('select nome, ordem_ciclo from equipe where unidade_id = $1', [unidadeId])).rows;
    const equipePorChave = new Map(equipesExistentes.map((e) => [normalizar(e.nome), e.nome]));
    const equipesNovas: Plano['equipesNovas'] = [];
    let proximaOrdem = Math.max(CICLO_EQUIPES.length, ...equipesExistentes.map((e) => e.ordem_ciclo)) + 1;
    const ja = await existentes(tx, mes, unidadeId);

    const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
    const vistos = new Set<string>();
    const alterados: ItemPrevia[] = [];
    const itens: ItemPlano[] = [];
    let iguais = 0;

    for (const l of aba.linhas) {
      const cel = l.celulas;
      const bruta = pega(cel, c.mat);
      if (!bruta) continue;
      const problema = (mensagem: string, solucao: string) => problemas.push({ aba: ABA, linha: l.linha, mensagem, solucao });

      const mat = matriculaDe(bruta);
      if (!mat.valor) {
        problema(`Matrícula inválida: "${bruta}".`, 'Use 6 dígitos, hífen e 1 dígito (ex.: 123456-7).');
        continue;
      }
      if (mat.corrigida) avisos.push(`Matrícula ${bruta} corrigida para ${mat.valor} (linha ${l.linha}).`);
      if (vistos.has(mat.valor)) {
        problema(`Matrícula ${mat.valor} repetida na planilha.`, 'Deixe uma linha só por militar.');
        continue;
      }
      vistos.add(mat.valor);

      const e = ja.get(mat.valor);
      if (!e) {
        problema(`A matrícula ${mat.valor} não está cadastrada.`, 'Cadastre o militar no Pecúlio antes.');
        continue;
      }
      const nome = e.nome_guerra;
      if (e.lotacao_unidade !== unidadeId && e.outra_sigla) {
        // os dados da escala de quem é de outra seção são importados por ela (vale também para quem só tem lotação marcada para depois)
        problema(`${nome} está lotado na ${e.outra_sigla}: os dados da escala dele são importados lá.`, `Confira a matrícula ou importe pela ${e.outra_sigla}.`);
        continue;
      }
      const jornadaN = normalizar(pega(cel, c.jornada));
      const jornada = jornadaN === 'ADM' ? 'adm' : jornadaN === 'PRONTO' ? 'pronto' : null;
      if (!jornada) {
        problema(`Jornada "${pega(cel, c.jornada)}" desconhecida.`, 'Use PRONTO ou ADM na coluna JORNADA.');
        continue;
      }
      const motoristaTxt = normalizar(pega(cel, c.motorista));
      const motorista = SIM.includes(motoristaTxt) || motoristaTxt === 'MOTORISTA';
      const cat = categoriasCnh(pega(cel, c.cnh));
      if (cat.invalidas.length) avisos.push(`${nome} (${mat.valor}): categoria de CNH "${cat.invalidas.join(', ')}" ignorada.`);
      // sem repetição (o `categoriasCnh` já tira) e em ordem, como o cadastro à mão grava; a CNH é do militar, esteja ou não no quadro de motoristas
      const cnh = [...cat.categorias].sort();

      // a equipe que ainda não existe só é criada se a linha entrar de fato (linha recusada ou sem mudança não cria equipe)
      const equipeTxt = pega(cel, c.equipe);
      const chaveDaEquipe = normalizar(equipeTxt);
      const equipe: string | null = equipeTxt ? (equipePorChave.get(chaveDaEquipe) ?? equipeTxt) : null;
      const equipeNova = !!equipeTxt && !equipePorChave.has(chaveDaEquipe);
      const registrarEquipeNova = () => {
        if (!equipeNova) return;
        const noCiclo = CICLO_EQUIPES.indexOf(chaveDaEquipe);
        equipesNovas.push({ nome: equipeTxt, ordem: noCiclo >= 0 && !equipesExistentes.some((q) => q.ordem_ciclo === noCiclo + 1) ? noCiclo + 1 : proximaOrdem++ });
        equipePorChave.set(chaveDaEquipe, equipeTxt);
      };
      const dados: Dados = { motorista, cnh, voluntarioJes: SIM.includes(normalizar(pega(cel, c.vjes))), equipe, jornada };
      const descricao = `${e.posto} ${nome}`;

      const mudancas: string[] = [];
      if (e.motorista !== motorista) mudancas.push(`motorista: ${e.motorista ? 'sim' : 'não'} → ${motorista ? 'sim' : 'não'}`);
      if (!mesmaLista(e.cnh, cnh)) mudancas.push(`CNH: ${textoCnh(e.cnh)} → ${textoCnh(cnh)}`);
      if (e.voluntario_jes !== dados.voluntarioJes) mudancas.push(`voluntário JES: ${e.voluntario_jes ? 'sim' : 'não'} → ${dados.voluntarioJes ? 'sim' : 'não'}`);
      const mudouMilitar = mudancas.length > 0;

      let lotacao: Lotacao | null = null;
      if (!e.lotacao_id) {
        // a importação não lota ninguém: sem período neste mês, o que fica é o aviso (ou o problema, se não há lotação nenhuma)
        if (e.futura) avisos.push(`${nome} (${mat.valor}): já tem lotação marcada para ${mesPorExtenso(e.futura)}; a lotação não foi mudada.`);
        else {
          problema(`${nome} não está lotado em nenhuma seção.`, 'Lote o militar pelo Pecúlio antes.');
          continue;
        }
      } else if (normalizar(e.equipe ?? '') !== normalizar(equipe ?? '') || e.jornada !== jornada) {
        if (e.futura) {
          // não sobrescreve a transferência que o escalante já marcou para depois
          avisos.push(`${nome} (${mat.valor}): tem transferência marcada para ${mesPorExtenso(e.futura)}; a lotação não foi mudada.`);
        } else {
          mudancas.push(...diferencasDeLotacao(e, equipe, jornada));
          // o período que começou neste mês (ou depois) é ajustado no lugar; o de antes termina na véspera do dia 1, e outro abre nele
          lotacao = e.lotacao_desde! >= primeiroDia ? { acao: 'corrigir', id: e.lotacao_id } : { acao: 'transferir', id: e.lotacao_id };
        }
      }

      if (!mudancas.length) {
        iguais++;
        continue;
      }
      // a equipe nova entra junto com a linha que a usa (e só se ela vai mudar a lotação)
      if (lotacao) registrarEquipeNova();
      alterados.push({ chave: mat.valor, descricao, mudancas });
      itens.push({ id: e.id, dados, mudouMilitar, lotacao });
    }

    if (equipesNovas.length) avisos.push(`Equipes novas: ${equipesNovas.map((q) => q.nome).join(', ')}.`);
    const lotadosAqui = [...ja.values()].filter((e) => e.lotacao_unidade === unidadeId && !vistos.has(e.matricula)).length;
    if (lotadosAqui) avisos.push(`${lotadosAqui} militares do sistema não estão na planilha (nada foi apagado).`);
    void unidade;

    return { previa: { novos: [], alterados, iguais, problemas, avisos }, plano: { equipesNovas, itens, mes } };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const q of plano.equipesNovas) {
      await tx.query('insert into equipe (unidade_id, nome, ordem_ciclo) values ($1, $2, $3)', [unidadeId, q.nome, q.ordem]);
    }
    const equipes = new Map(
      (await tx.query<{ id: string; nome: string }>('select id, nome from equipe where unidade_id = $1', [unidadeId])).rows.map((e) => [normalizar(e.nome), e.id]),
    );
    const desde = `${plano.mes}-01`;
    for (const it of plano.itens) {
      const d = it.dados;
      if (it.mudouMilitar) {
        await tx.query('update militar set motorista = $2, cnh = $3, voluntario_jes = $4 where id = $1', [it.id, d.motorista, d.cnh, d.voluntarioJes]);
      }
      const equipeId = d.equipe ? equipes.get(normalizar(d.equipe)) ?? null : null;
      const l = it.lotacao;
      if (!l) continue;
      if (l.acao === 'corrigir') {
        await tx.query('update rastreio set equipe_id = $2, jornada = $3 where id = $1', [l.id, equipeId, d.jornada]);
        continue;
      }
      await tx.query("update rastreio set ate = $2::date - interval '1 day' where id = $1", [l.id, desde]);
      await tx.query('insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [it.id, unidadeId, equipeId, d.jornada, desde]);
    }
    return plano.itens.length;
  },
};
