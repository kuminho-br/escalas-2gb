// Importação da aba GUARNIÇÕES (leitura como cadastro_guarnicoes.js do protótipo, via resolverGuarnicoes).
import { mesPorExtenso, type ItemPrevia, type ProblemaImportacao, type VersaoGuarnicao, type VersaoSalva } from 'contratos';
import { cadgVigencia, categoriasCnh, CNH_HABILITA, normalizar, resolverGuarnicoes, type LinhaGuarnicao as LinhaDaAba } from 'dominio';
import { diferencasDeVersao } from '../cadastros/guarnicoes-regras.ts';
import { funcoesVisiveis, gravarVersao, versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { coluna, mesDaCelula } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'GUARNIÇÕES';

const COLUNAS = {
  vigencia: { rotulo: 'VIGÊNCIA', obrigatoria: false, ajuda: 'Mês a partir do qual a linha vale (aaaa-mm ou mm/aaaa). Vazio vale desde a criação da seção.' },
  guarnicao: { rotulo: 'GUARNIÇÃO', obrigatoria: true, ajuda: 'Nome da guarnição. A atividade não vem da planilha: escolha na tela de Guarnições.' },
  viatura: { rotulo: 'VIATURA', obrigatoria: false, ajuda: 'Sigla da viatura. Só informativa: não muda as vagas.' },
  tipo: { rotulo: 'TIPO', obrigatoria: false, ajuda: 'Tipo da viatura (ex.: Auto Resgate). Só informativo.' },
  ativar: { rotulo: 'ATIVAR', obrigatoria: false, ajuda: 'SIM se a guarnição entra na escala. Vazio vale SIM.', opcoes: ['SIM', 'NÃO'] },
  prioridade: { rotulo: 'PRIORIDADE', obrigatoria: false, ajuda: 'Ordem de ativação: 1 primeiro. Vazio vai por último.' },
  cnh: { rotulo: 'CNH', obrigatoria: false, ajuda: 'Categoria exigida de quem ocupa a função (ex.: D). Com mais de uma, vale a que as outras habilitam (C/D vira C).' },
  funcao: { rotulo: 'FUNÇÃO', obrigatoria: true, ajuda: 'Função na guarnição (ex.: Motorista). Função nova é criada no catálogo da seção.' },
  minimo: { rotulo: 'MÍNIMO', obrigatoria: false, ajuda: 'Vagas obrigatórias da função. Vazio vale 0.' },
  maximo: { rotulo: 'MÁXIMO', obrigatoria: false, ajuda: 'Máximo de vagas. Vazio é sem limite; 0 retira a função naquela vigência.' },
} satisfies Record<string, ColunaModelo>;

type Versao = VersaoSalva & { redundante?: boolean };
type ParaGravar = { nome: string; existenteId: string | null; versoes: Versao[] };
type Plano = { funcoesNovas: string[]; guarnicoes: ParaGravar[] };

/** Uma categoria só: a que todas as outras habilitam pela hierarquia (['C','D'] vira C); senão conflito. */
export function cnhUnica(cats: string[]): { cnh: string | null } | { conflito: true } {
  if (cats.length === 0) return { cnh: null };
  const alvo = cats.find((c) => cats.every((o) => o === c || CNH_HABILITA[o]?.includes(c)));
  return alvo ? { cnh: alvo } : { conflito: true };
}

const capitaliza = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** 'GUARNIÇÕES, linha 5 (Nome, Função): texto (B58, RN-12) ...' -> linha 5, 'Nome: texto ...'. */
function problemaDoAviso(aviso: string): ProblemaImportacao {
  const m = /^GUARNIÇÕES, linha (\d+)(?: \(([^)]*)\))?:?\s*(.*)$/s.exec(aviso);
  const limpo = (t: string) => t.replace(/\s*\([^()]*\b(?:B\d{2}|RN-\d+)\b[^()]*\)/g, '');
  const linha = m ? Number(m[1]) : 1;
  const nome = m?.[2]?.split(',')[0]?.trim();
  const resto = limpo(m ? m[3]! : aviso);
  return { aba: ABA, linha, mensagem: nome ? `${nome}: ${resto}` : capitaliza(resto), solucao: 'Corrija a linha na planilha e importe de novo.' };
}

export const importadorGuarnicoes: Importador<Plano> = {
  abas: [ABA],

  modelo: {
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const funcoes = await funcoesVisiveis(tx, unidadeId);
      const guarnicoes = (await tx.query<{ nome: string }>('select nome from guarnicao where unidade_id = $1 order by nome', [unidadeId])).rows;
      return [
        { titulo: 'Funções cadastradas (coluna FUNÇÃO)', itens: funcoes.length ? funcoes.map((f) => (f.herdada ? `${f.nome} (${f.unidadeSigla})` : f.nome)) : ['Ainda não há funções: a importação cria as que aparecerem na coluna FUNÇÃO.'] },
        { titulo: 'Guarnições já cadastradas (coluna GUARNIÇÃO)', itens: guarnicoes.length ? guarnicoes.map((g) => g.nome) : ['Nenhuma ainda.'] },
      ];
    },
  },

  async planejar(abas, { tx, unidadeId }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<keyof typeof COLUNAS, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const vazio = { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos }, plano: { funcoesNovas: [], guarnicoes: [] } };
    for (const [falta, rotulo] of [[c.guarnicao, COLUNAS.guarnicao.rotulo], [c.funcao, COLUNAS.funcao.rotulo]] as const) {
      if (falta < 0) problemas.push({ aba: ABA, linha: 1, mensagem: `Falta a coluna ${rotulo}.`, solucao: 'Use o modelo desta tela.' });
    }
    if (problemas.length) return vazio;

    const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
    const linhas: LinhaDaAba[] = aba.linhas.map((l) => ({
      linha: l.linha,
      vigencia: mesDaCelula(pega(l.celulas, c.vigencia)),
      guarnicao: pega(l.celulas, c.guarnicao),
      viatura: pega(l.celulas, c.viatura),
      tipo: pega(l.celulas, c.tipo),
      ativar: pega(l.celulas, c.ativar),
      prioridade: pega(l.celulas, c.prioridade),
      cnh: pega(l.celulas, c.cnh),
      funcao: pega(l.celulas, c.funcao),
      minimo: pega(l.celulas, c.minimo),
      maximo: pega(l.celulas, c.maximo),
    }));

    const criacao = (await tx.query<{ mes: string }>("select to_char(desde, 'YYYY-MM') as mes from unidade where id = $1", [unidadeId])).rows[0]!.mes;
    const meses = new Set<string>([criacao]);
    for (const l of linhas) {
      const v = cadgVigencia(l.vigencia);
      if (l.guarnicao && v.ok && v.valor) meses.add(v.valor);
    }

    // estado de cada guarnição em cada vigência; a igual à anterior da própria planilha é redundante (só vale se o sistema já tem versão nesse mês)
    const vistos = new Set<string>();
    const doAviso: ProblemaImportacao[] = [];
    const porGuarnicao = new Map<string, { nome: string; versoes: Versao[] }>();
    const conflitos = new Set<string>();
    for (const mes of [...meses].sort()) {
      const res = resolverGuarnicoes(linhas, mes);
      for (const a of res.avisos) {
        const p = problemaDoAviso(a);
        const k = `${p.linha}|${p.mensagem}`;
        if (!vistos.has(k)) {
          vistos.add(k);
          doAviso.push(p);
        }
      }
      for (const g of res.guarnicoes) {
        const chave = normalizar(g.id);
        const composicao = g.funcoes.map((f) => {
          const cat = categoriasCnh(f.cnh.join(','));
          const unica = cnhUnica(cat.categorias);
          let cnhExigida: string | null = null;
          if ('conflito' in unica) {
            const k = `${chave}|${normalizar(f.funcao)}|${cat.categorias.join('/')}`;
            if (!conflitos.has(k)) {
              conflitos.add(k);
              const primeira = linhas.find((l) => normalizar(l.guarnicao) === chave && normalizar(l.funcao) === normalizar(f.funcao) && String(l.cnh ?? '') !== '');
              problemas.push({
                aba: ABA,
                linha: primeira?.linha ?? 1,
                mensagem: `CNH "${cat.categorias.join('/')}" não cabe numa categoria só (${g.id}, ${f.funcao}).`,
                solucao: 'Escolha a categoria na tela de Guarnições.',
              });
            }
          } else cnhExigida = unica.cnh;
          return { funcaoId: '', funcao: f.funcao, minimo: f.minimo, maximo: f.maximo, cnhExigida };
        });
        const versao: Versao = { vigencia: mes, viatura: g.viatura || null, tipoViatura: g.tipo || null, prioridade: g.prioridade, ativa: g.ativar, composicao };
        const entrada = porGuarnicao.get(chave) ?? { nome: g.id, versoes: [] };
        porGuarnicao.set(chave, entrada);
        const anterior = entrada.versoes[entrada.versoes.length - 1] ?? null;
        versao.redundante = Boolean(anterior) && diferencasDeVersao(anterior, versao).length === 0;
        entrada.versoes.push(versao);
      }
    }
    problemas.push(...doAviso);
    problemas.sort((a, b) => a.linha - b.linha);

    // contra o que já está no sistema
    const existentes = (await tx.query<{ id: string; nome: string; atividade_id: string | null }>('select id, nome, atividade_id from guarnicao where unidade_id = $1', [unidadeId])).rows;
    const porChave = new Map(existentes.map((g) => [normalizar(g.nome), g]));
    const doSistema = await versoesDasGuarnicoes(tx, existentes.map((g) => g.id));
    const funcoes = await funcoesVisiveis(tx, unidadeId);
    const conhecidas = new Set(funcoes.map((f) => f.chave));

    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const plano: Plano = { funcoesNovas: [], guarnicoes: [] };
    let iguais = 0;
    let semAtividade = 0;
    for (const [chave, g] of porGuarnicao) {
      const ex = porChave.get(chave);
      if (!ex || !ex.atividade_id) semAtividade++;
      let paraGravar: Versao[];
      if (!ex) {
        paraGravar = g.versoes.filter((v) => !v.redundante);
        novos.push({ chave: g.nome, descricao: paraGravar.length > 1 ? `${g.nome} (${paraGravar.length} versões)` : g.nome });
      } else {
        const noSistema = doSistema.get(ex.id)!;
        const mudancas: string[] = [];
        paraGravar = [];
        for (const v of g.versoes) {
          const atual = noSistema.find((s) => s.vigencia === v.vigencia);
          if (!atual && v.redundante) continue;
          if (!atual) {
            mudancas.push(`${mesPorExtenso(v.vigencia)}: nova versão`);
            paraGravar.push(v);
            continue;
          }
          const dif = diferencasDeVersao(atual, v);
          if (dif.length) {
            mudancas.push(...dif.map((d) => `${mesPorExtenso(v.vigencia)}: ${d}`));
            paraGravar.push(v);
          }
        }
        if (mudancas.length) alterados.push({ chave: g.nome, descricao: g.nome, mudancas });
        else iguais++;
      }
      if (!paraGravar.length) continue;
      for (const v of paraGravar) {
        for (const f of v.composicao) {
          const k = normalizar(f.funcao);
          if (!conhecidas.has(k)) {
            conhecidas.add(k);
            plano.funcoesNovas.push(f.funcao);
          }
        }
      }
      plano.guarnicoes.push({ nome: g.nome, existenteId: ex?.id ?? null, versoes: paraGravar });
    }

    if (plano.funcoesNovas.length) avisos.push(`Funções novas: ${plano.funcoesNovas.join(', ')}.`);
    if (semAtividade === 1) avisos.push('1 guarnição sem atividade: escolha a atividade dela na tela de Guarnições.');
    else if (semAtividade > 1) avisos.push(`${semAtividade} guarnições sem atividade: escolha a atividade de cada uma na tela de Guarnições.`);
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const nome of plano.funcoesNovas) await tx.query('insert into funcao (unidade_id, nome) values ($1, $2)', [unidadeId, nome]);
    const ids = new Map((await funcoesVisiveis(tx, unidadeId)).map((f) => [f.chave, f.id]));
    for (const g of plano.guarnicoes) {
      const id = g.existenteId ?? (await tx.query<{ id: string }>('insert into guarnicao (unidade_id, nome) values ($1, $2) returning id', [unidadeId, g.nome])).rows[0]!.id;
      for (const v of g.versoes) {
        const versao: VersaoGuarnicao = {
          viatura: v.viatura,
          tipoViatura: v.tipoViatura,
          prioridade: v.prioridade,
          ativa: v.ativa,
          composicao: v.composicao.map((f) => ({
            funcaoId: ids.get(normalizar(f.funcao))!,
            minimo: f.minimo,
            maximo: f.maximo,
            cnhExigida: f.cnhExigida as VersaoGuarnicao['composicao'][number]['cnhExigida'],
          })),
        };
        await gravarVersao(tx, id, v.vigencia, versao);
      }
    }
    return plano.guarnicoes.length;
  },
};
