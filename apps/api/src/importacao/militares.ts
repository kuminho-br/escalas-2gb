// Importação da aba MILITARES (leitura como lerMilitares_ do protótipo, prototipo/matriz.js).
import { mesParaData, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { categoriasCnh, CICLO_EQUIPES, normalizar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { coluna } from './planilha.ts';
import type { Importador } from './tipos.ts';

const ABA = 'MILITARES';
const SIM = ['SIM', 'S', 'X', '1', 'TRUE', 'VERDADEIRO'];

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
  lotacao_id: string | null;
  lotacao_unidade: string | null;
  lotacao_desde: string | null;
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

const mesmaLista = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();
const textoCnh = (c: string[]) => (c.length ? [...c].sort().join('') : 'nenhuma');

async function existentes(tx: Consulta): Promise<Map<string, Existente>> {
  const { rows } = await tx.query<Existente>(
    `select m.id, m.matricula, m.posto_grad_id, p.sigla as posto, m.nome_guerra, m.antiguidade, m.motorista, m.cnh, m.voluntario_jes,
            l.id as lotacao_id, l.unidade_id as lotacao_unidade, to_char(l.desde, 'YYYY-MM') as lotacao_desde, e.nome as equipe, l.jornada
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join lotacao l on l.militar_id = m.id and l.ate is null
       left join equipe e on e.id = l.equipe_id`,
    [],
  );
  return new Map(rows.map((r) => [r.matricula, r]));
}

export const importadorMilitares: Importador<Plano> = {
  abas: [ABA],

  async planejar(abas, { tx, unidadeId, hoje }) {
    const aba = abas[ABA]!;
    const col = (r: string) => coluna(aba, r);
    const c = {
      mat: col('MATRÍCULA'), nome: col('NOME DE GUERRA'), secao: col('SEÇÃO'), posto: col('POSTO/GRAD'), jornada: col('JORNADA'),
      equipe: col('EQUIPE'), antig: col('ANTIG'), motorista: col('MOTORISTA'), vjes: col('VOLUNTÁRIO JES'), cnh: col('CNH'),
    };
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
    const ja = await existentes(tx);

    const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
    const vistos = new Set<string>();
    const novos: ItemPrevia[] = [];
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
        if (/^\d+$/.test(antigTxt) && Number(antigTxt) >= 1) antiguidade = Number(antigTxt);
        else avisos.push(`${nomeGuerra} (${mat.valor}): antiguidade "${antigTxt}" ignorada (use um número a partir de 1).`);
      }
      const motoristaTxt = normalizar(pega(cel, c.motorista));
      const motorista = SIM.includes(motoristaTxt) || motoristaTxt === 'MOTORISTA';
      const cat = categoriasCnh(pega(cel, c.cnh));
      if (cat.invalidas.length) avisos.push(`${nomeGuerra} (${mat.valor}): categoria de CNH "${cat.invalidas.join(', ')}" ignorada.`);
      let cnh = cat.categorias;
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
        mudancas.push('lotação: nova');
        lotacao = { acao: 'nova' };
      } else {
        const mesmaEquipe = normalizar(e.equipe ?? '') === normalizar(equipe ?? '');
        if (e.lotacao_unidade !== unidadeId) mudancas.push(`lotação: outra unidade → ${unidade.sigla}`);
        if (!mesmaEquipe) mudancas.push(`equipe: ${e.equipe ?? 'sem equipe'} → ${equipe ?? 'sem equipe'}`);
        if (e.jornada !== jornada) mudancas.push(`jornada: ${e.jornada} → ${jornada}`);
        if (e.lotacao_unidade !== unidadeId || !mesmaEquipe || e.jornada !== jornada) {
          // lotação aberta que começou neste mês (ou depois) é corrigida; a de antes termina no mês anterior
          lotacao = e.lotacao_desde! >= mes ? { acao: 'corrigir', id: e.lotacao_id } : { acao: 'transferir', id: e.lotacao_id };
        }
      }

      if (!mudancas.length) {
        iguais++;
        continue;
      }
      alterados.push({ chave: mat.valor, descricao, mudancas });
      itens.push({ id: e.id, dados, mudouMilitar, lotacao });
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
