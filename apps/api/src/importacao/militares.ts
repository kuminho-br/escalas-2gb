// Importação da aba MILITARES (leitura como lerMilitares_ do protótipo, prototipo/matriz.js).
import { Antiguidade, mesParaData, mesPorExtenso, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { categoriasCnh, CICLO_EQUIPES, diasDoMes, normalizar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { coluna } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'MILITARES';
const SIM = ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'];

// rótulos lidos por planejar e escritos no cabeçalho do modelo: uma lista só
const COLUNAS = {
  mat: { rotulo: 'MATRÍCULA', obrigatoria: true, ajuda: '6 dígitos, hífen e 1 dígito (ex.: 123456-7). Sem o hífen, o sistema corrige e avisa.' },
  nome: { rotulo: 'NOME DE GUERRA', obrigatoria: true, ajuda: 'Como o militar aparece na escala.' },
  secao: { rotulo: 'SEÇÃO', obrigatoria: true, ajuda: 'Sigla da seção do militar, igual à da seção que está importando (ex.: 1ª SB). Militar de outra seção é pulado.' },
  posto: { rotulo: 'POSTO/GRAD', obrigatoria: true, ajuda: 'Sigla do posto ou graduação, como na lista abaixo. "SD" vale como "SD BM".' },
  jornada: { rotulo: 'JORNADA', obrigatoria: true, ajuda: 'PRONTO (turnos de 12h) ou ADM (expediente).', opcoes: ['PRONTO', 'ADM'] },
  equipe: { rotulo: 'EQUIPE', obrigatoria: false, ajuda: 'Equipe do pronto (ex.: ALFA). Equipe que ainda não existe é criada. No ADM, deixe vazio.' },
  antig: { rotulo: 'ANTIG', obrigatoria: false, ajuda: 'Número da antiguidade, a partir de 1. Não repita o número entre militares.' },
  motorista: { rotulo: 'MOTORISTA', obrigatoria: false, ajuda: 'SIM se o militar está no quadro de motoristas.', opcoes: ['SIM', 'NÃO'] },
  vjes: { rotulo: 'VOLUNTÁRIO JES', obrigatoria: false, ajuda: 'SIM se o militar é voluntário JES.', opcoes: ['SIM', 'NÃO'] },
  cnh: { rotulo: 'CNH', obrigatoria: false, ajuda: 'Categorias da carteira, juntas (ex.: AD). Só vale para quem está no quadro de motoristas.' },
} satisfies Record<string, ColunaModelo>;

type Dados = {
  matricula: string;
  nomeGuerra: string;
  postoId: string;
  posto: string;
  antiguidade: number | null;
  motorista: boolean;
  cnh: string[];
  voluntarioJes: boolean;
  equipe: string | null;
  jornada: 'pronto' | 'adm';
};
type Lotacao = { acao: 'nova' } | { acao: 'corrigir'; id: string } | { acao: 'transferir'; id: string };
type ItemPlano = { id: string | null; dados: Dados; mudouMilitar: boolean; lotacao: Lotacao | null };
type Plano = { equipesNovas: { nome: string; ordem: number }[]; itens: ItemPlano[]; mes: string };

type Existente = {
  id: string;
  matricula: string;
  posto_grad_id: string;
  posto: string;
  nome_guerra: string;
  antiguidade: number | null;
  motorista: boolean;
  cnh: string[];
  voluntario_jes: boolean;
  ativo: boolean;
  lotacao_id: string | null;
  lotacao_unidade: string | null;
  lotacao_sigla: string | null;
  lotacao_desde: string | null;
  lotacao_aberta: boolean | null;
  /** mês da próxima lotação já registrada depois deste mês (transferência marcada) */
  futura: string | null;
  /** seção de outra unidade em que ele está lotado neste mês ou tem lotação marcada para depois (a mais próxima) */
  outra_sigla: string | null;
  equipe: string | null;
  jornada: 'pronto' | 'adm' | null;
};

/** '9902022' -> '990202-2'; formato certo passa direto; o resto é null. */
function matriculaDe(bruto: string): { valor: string | null; corrigida: boolean } {
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

/** Militares do sistema, com a lotação que cobre o mês e a próxima já marcada (se houver). */
async function existentes(tx: Consulta, mes: string, unidadeId: string): Promise<Map<string, Existente>> {
  const dias = diasDoMes(mes);
  const { rows } = await tx.query<Existente>(
    `select m.id, m.matricula, m.posto_grad_id, p.sigla as posto, m.nome_guerra, m.antiguidade, m.motorista, m.cnh, m.voluntario_jes, m.ativo,
            l.id as lotacao_id, l.unidade_id as lotacao_unidade, un.sigla as lotacao_sigla, to_char(l.desde, 'YYYY-MM') as lotacao_desde,
            l.ate is null as lotacao_aberta, e.nome as equipe, l.jornada,
            (select to_char(min(f.desde), 'YYYY-MM') from lotacao f where f.militar_id = m.id and f.desde > $2) as futura,
            (select ou.sigla from lotacao o join unidade ou on ou.id = o.unidade_id
              where o.militar_id = m.id and o.unidade_id <> $3 and (o.ate is null or o.ate >= $1) order by o.desde limit 1) as outra_sigla
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join lotacao l on l.militar_id = m.id and l.desde <= $2 and (l.ate is null or l.ate >= $1)
       left join unidade un on un.id = l.unidade_id
       left join equipe e on e.id = l.equipe_id`,
    [dias[0], dias[dias.length - 1], unidadeId],
  );
  return new Map(rows.map((r) => [r.matricula, r]));
}

export const importadorMilitares: Importador<Plano> = {
  abas: [ABA],

  modelo: {
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const unidade = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!;
      const postos = (await tx.query<{ sigla: string }>('select sigla from posto_grad order by ordem')).rows;
      const equipes = (await tx.query<{ nome: string }>('select nome from equipe where unidade_id = $1 order by ordem_ciclo', [unidadeId])).rows;
      return [
        { titulo: 'Seção desta importação (coluna SEÇÃO)', itens: [unidade.sigla] },
        { titulo: 'Postos e graduações (coluna POSTO/GRAD)', itens: postos.map((p) => p.sigla) },
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
    const vazio = { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos }, plano: { equipesNovas: [], itens: [], mes: hoje.slice(0, 7) } };
    if (c.mat < 0 || c.nome < 0 || c.secao < 0) {
      problemas.push({ aba: ABA, linha: 1, mensagem: 'Faltam as colunas MATRÍCULA, NOME DE GUERRA ou SEÇÃO.', solucao: 'Confira o cabeçalho da aba na sandbox.' });
      return vazio;
    }

    const mes = hoje.slice(0, 7);
    const unidade = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!;
    const postos = (await tx.query<{ id: string; sigla: string }>('select id, sigla from posto_grad order by ordem')).rows;
    const postoPorChave = new Map(postos.map((p) => [normalizar(p.sigla), p]));
    const equipesExistentes = (await tx.query<{ nome: string; ordem_ciclo: number }>('select nome, ordem_ciclo from equipe where unidade_id = $1', [unidadeId])).rows;
    const equipePorChave = new Map(equipesExistentes.map((e) => [normalizar(e.nome), e.nome]));
    const equipesNovas: Plano['equipesNovas'] = [];
    let proximaOrdem = Math.max(CICLO_EQUIPES.length, ...equipesExistentes.map((e) => e.ordem_ciclo)) + 1;
    const ja = await existentes(tx, mes, unidadeId);

    const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
    const vistos = new Set<string>();
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const itens: ItemPlano[] = [];
    const comAntiguidade: { antiguidade: number | null; nome: string; matricula: string }[] = [];
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

      const secao = pega(cel, c.secao);
      if (normalizar(secao) !== normalizar(unidade.sigla)) {
        problema(`Militar de outra seção (${secao || 'vazia'}).`, 'Ele entra quando a seção dele for importada; aqui não é gravado.');
        continue;
      }
      const postoTxt = pega(cel, c.posto);
      const posto = postoPorChave.get(normalizar(postoTxt)) ?? postoPorChave.get(`${normalizar(postoTxt)}BM`);
      if (!posto) {
        problema(`Posto "${postoTxt}" não existe.`, `Use uma destas siglas: ${postos.map((p) => p.sigla).join(', ')}.`);
        continue;
      }
      const jornadaN = normalizar(pega(cel, c.jornada));
      const jornada = jornadaN === 'ADM' ? 'adm' : jornadaN === 'PRONTO' ? 'pronto' : null;
      if (!jornada) {
        problema(`Jornada "${pega(cel, c.jornada)}" desconhecida.`, 'Use PRONTO ou ADM na coluna JORNADA.');
        continue;
      }
      const nomeGuerra = pega(cel, c.nome).toUpperCase();
      if (!nomeGuerra) {
        problema('Nome de guerra vazio.', 'Preencha o NOME DE GUERRA na sandbox.');
        continue;
      }

      const antigTxt = pega(cel, c.antig);
      let antiguidade: number | null = null;
      if (antigTxt) {
        // o mesmo limite do contrato (1 a 99999): o que a planilha traz, a tela precisa conseguir salvar de novo
        if (/^\d+$/.test(antigTxt) && Antiguidade.safeParse(Number(antigTxt)).success) antiguidade = Number(antigTxt);
        else avisos.push(`${nomeGuerra} (${mat.valor}): antiguidade "${antigTxt}" ignorada (use um número de 1 a 99999).`);
      }
      const motoristaTxt = normalizar(pega(cel, c.motorista));
      const motorista = SIM.includes(motoristaTxt) || motoristaTxt === 'MOTORISTA';
      const cat = categoriasCnh(pega(cel, c.cnh));
      if (cat.invalidas.length) avisos.push(`${nomeGuerra} (${mat.valor}): categoria de CNH "${cat.invalidas.join(', ')}" ignorada.`);
      // sem repetição (o `categoriasCnh` já tira) e em ordem, como o cadastro à mão grava
      let cnh = [...cat.categorias].sort();
      if (!motorista && cnh.length) {
        avisos.push(`${nomeGuerra} (${mat.valor}): CNH ignorada, fora do quadro de motoristas.`);
        cnh = [];
      }

      const equipeTxt = pega(cel, c.equipe);
      let equipe: string | null = null;
      if (equipeTxt) {
        const k = normalizar(equipeTxt);
        equipe = equipePorChave.get(k) ?? null;
        if (!equipe) {
          const noCiclo = CICLO_EQUIPES.indexOf(k);
          equipesNovas.push({ nome: equipeTxt, ordem: noCiclo >= 0 && !equipesExistentes.some((e) => e.ordem_ciclo === noCiclo + 1) ? noCiclo + 1 : proximaOrdem++ });
          equipePorChave.set(k, equipeTxt);
          equipe = equipeTxt;
        }
      }

      const dados: Dados = {
        matricula: mat.valor, nomeGuerra, postoId: posto.id, posto: posto.sigla, antiguidade, motorista, cnh, voluntarioJes: SIM.includes(normalizar(pega(cel, c.vjes))), equipe, jornada,
      };
      const descricao = `${posto.sigla} ${nomeGuerra}`;
      const e = ja.get(mat.valor);
      if (e && e.lotacao_unidade !== unidadeId && e.outra_sigla) {
        // trazer de outra seção exige papel lá: a transferência é registrada por quem cuida dela.
        // Vale também para quem só tem lotação marcada para depois: o mesmo bloqueio que a ficha do militar aplica.
        problema(`${nomeGuerra} (${mat.valor}) está lotado na ${e.outra_sigla}.`, `Ele entra aqui quando a transferência for registrada por quem cuida da ${e.outra_sigla}.`);
        continue;
      }
      comAntiguidade.push({ antiguidade, nome: nomeGuerra, matricula: mat.valor });
      if (!e) {
        novos.push({ chave: mat.valor, descricao });
        itens.push({ id: null, dados, mudouMilitar: true, lotacao: { acao: 'nova' } });
        continue;
      }

      const mudancas: string[] = [];
      if (e.posto_grad_id !== posto.id) mudancas.push(`posto: ${e.posto} → ${posto.sigla}`);
      if (e.nome_guerra !== nomeGuerra) mudancas.push(`nome de guerra: ${e.nome_guerra} → ${nomeGuerra}`);
      if (e.antiguidade !== antiguidade) mudancas.push(`antiguidade: ${e.antiguidade ?? 'vazia'} → ${antiguidade ?? 'vazia'}`);
      if (e.motorista !== motorista) mudancas.push(`motorista: ${e.motorista ? 'sim' : 'não'} → ${motorista ? 'sim' : 'não'}`);
      if (!mesmaLista(e.cnh, cnh)) mudancas.push(`CNH: ${textoCnh(e.cnh)} → ${textoCnh(cnh)}`);
      if (e.voluntario_jes !== dados.voluntarioJes) mudancas.push(`voluntário JES: ${e.voluntario_jes ? 'sim' : 'não'} → ${dados.voluntarioJes ? 'sim' : 'não'}`);
      const mudouMilitar = mudancas.length > 0;

      let lotacao: Lotacao | null = null;
      if (!e.lotacao_id) {
        if (e.futura) avisos.push(`${nomeGuerra} (${mat.valor}): já tem lotação marcada para ${mesPorExtenso(e.futura)}; a lotação não foi mudada.`);
        else {
          mudancas.push('lotação: nova');
          lotacao = { acao: 'nova' };
        }
      } else {
        const mesmaEquipe = normalizar(e.equipe ?? '') === normalizar(equipe ?? '');
        if (!mesmaEquipe || e.jornada !== jornada) {
          if (e.futura) {
            // não sobrescreve a transferência que o escalante já marcou para depois
            avisos.push(`${nomeGuerra} (${mat.valor}): tem transferência marcada para ${mesPorExtenso(e.futura)}; a lotação não foi mudada.`);
          } else if (e.lotacao_desde! >= mes || !e.lotacao_aberta) {
            // lotação que começou neste mês é corrigida; a de antes termina no mês anterior
            mudancas.push(...diferencasDeLotacao(e, equipe, jornada));
            lotacao = { acao: 'corrigir', id: e.lotacao_id };
          } else {
            mudancas.push(...diferencasDeLotacao(e, equipe, jornada));
            lotacao = { acao: 'transferir', id: e.lotacao_id };
          }
        }
      }

      if (!mudancas.length) {
        iguais++;
        continue;
      }
      alterados.push({ chave: mat.valor, descricao, mudancas });
      itens.push({ id: e.id, dados, mudouMilitar, lotacao });
    }

    const porNumero = new Map<number, string[]>();
    for (const x of comAntiguidade) {
      if (x.antiguidade !== null) porNumero.set(x.antiguidade, [...(porNumero.get(x.antiguidade) ?? []), `${x.nome} (${x.matricula})`]);
    }
    for (const [n, quem] of porNumero) {
      if (quem.length > 1) avisos.push(`Antiguidade ${n} repetida na planilha: ${quem.slice(0, -1).join(', ')} e ${quem[quem.length - 1]}.`);
    }
    // a mesma antiguidade de um militar ativo desta seção que não está na planilha (a importação não o muda)
    const foraDaPlanilha = [...ja.values()].filter((e) => e.ativo && e.lotacao_unidade === unidadeId && e.antiguidade !== null && !vistos.has(e.matricula));
    for (const x of comAntiguidade) {
      for (const e of foraDaPlanilha.filter((o) => o.antiguidade === x.antiguidade)) {
        avisos.push(`${x.nome} (${x.matricula}): antiguidade ${x.antiguidade} repetida com ${e.nome_guerra} (já no sistema, fora da planilha).`);
      }
    }
    if (equipesNovas.length) avisos.push(`Equipes novas: ${equipesNovas.map((q) => q.nome).join(', ')}.`);
    const lotadosAqui = [...ja.values()].filter((e) => e.lotacao_unidade === unidadeId && !vistos.has(e.matricula)).length;
    if (lotadosAqui) avisos.push(`${lotadosAqui} militares do sistema não estão na planilha (nada foi apagado).`);

    return { previa: { novos, alterados, iguais, problemas, avisos }, plano: { equipesNovas, itens, mes } };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const q of plano.equipesNovas) {
      await tx.query('insert into equipe (unidade_id, nome, ordem_ciclo) values ($1, $2, $3)', [unidadeId, q.nome, q.ordem]);
    }
    const equipes = new Map(
      (await tx.query<{ id: string; nome: string }>('select id, nome from equipe where unidade_id = $1', [unidadeId])).rows.map((e) => [normalizar(e.nome), e.id]),
    );
    const desde = mesParaData(plano.mes);
    for (const it of plano.itens) {
      const d = it.dados;
      let id = it.id;
      if (!id) {
        id = (await tx.query<{ id: string }>(
          `insert into militar (matricula, posto_grad_id, nome_guerra, antiguidade, motorista, cnh, voluntario_jes)
           values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [d.matricula, d.postoId, d.nomeGuerra, d.antiguidade, d.motorista, d.cnh, d.voluntarioJes],
        )).rows[0]!.id;
      } else if (it.mudouMilitar) {
        await tx.query(
          'update militar set posto_grad_id = $2, nome_guerra = $3, antiguidade = $4, motorista = $5, cnh = $6, voluntario_jes = $7 where id = $1',
          [id, d.postoId, d.nomeGuerra, d.antiguidade, d.motorista, d.cnh, d.voluntarioJes],
        );
      }
      const equipeId = d.equipe ? equipes.get(normalizar(d.equipe)) ?? null : null;
      const l = it.lotacao;
      if (!l) continue;
      if (l.acao === 'corrigir') {
        await tx.query('update lotacao set unidade_id = $2, equipe_id = $3, jornada = $4 where id = $1', [l.id, unidadeId, equipeId, d.jornada]);
        continue;
      }
      if (l.acao === 'transferir') await tx.query("update lotacao set ate = $2::date - interval '1 day' where id = $1", [l.id, desde]);
      await tx.query('insert into lotacao (militar_id, unidade_id, equipe_id, jornada, desde) values ($1, $2, $3, $4, $5)', [id, unidadeId, equipeId, d.jornada, desde]);
    }
    return plano.itens.length;
  },
};
