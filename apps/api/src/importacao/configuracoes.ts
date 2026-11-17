// Importação da aba CONFIGURAÇÕES: parâmetros da unidade, por vigência.
import { mesParaData, mesPorExtenso, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { normalizar, paramDef, paramValidarLinhas, type ValorParametro } from 'dominio';
import { ESCREVE_PARAMETRO } from '../acesso.ts';
import { CHAVES_SISTEMA } from '../cadastros/configuracoes.ts';
import { coluna } from './planilha.ts';
import type { Importador } from './tipos.ts';

const ABA = 'CONFIGURAÇÕES';
type Item = { chave: string; vigencia: string; valor: ValorParametro };

// 'Linha 3 de CONFIGURAÇÕES (CHAVE): Use um número inteiro. Linha ignorada.' -> 'CHAVE: Use um número inteiro.'
function mensagemDoAviso(aviso: string): string {
  return aviso
    .replace(/^Linha \d+ de CONFIGURAÇÕES:? ?/, '')
    .replace(/^\(([^)]*)\):/, '$1:')
    .replace(/ Linha ignorada\.$/, '')
    .replace(/; ignorada\.$/, '.');
}

// 'mm/aaaa' digitado na sandbox vira data no Planilhas e chega como '01/mm/aaaa' (como em parametros_painel.js)
const vigenciaDaCelula = (t: string) => t.replace(/^\d{2}\/(\d{2})\/(\d{4})$/, '$2-$1');

// chaves da planilha que o sistema novo não usa: aviso, sem gravar
const FORA_DO_SISTEMA: Record<string, string> = {
  SECAOPADRAO: 'SECAO_PADRAO não é mais usada: o seletor de unidade substitui.',
  LINHASPORMILITAR: 'LINHAS_POR_MILITAR era da planilha e não se aplica ao sistema novo.',
};

const textoValor = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v));

export const importadorConfiguracoes: Importador<Item[]> = {
  abas: [ABA],
  papeis: ESCREVE_PARAMETRO,
  async planejar(abas, { tx, unidadeId }) {
    const aba = abas[ABA]!;
    const c = { chave: coluna(aba, 'CHAVE'), valor: coluna(aba, 'VALOR'), vigencia: coluna(aba, 'VIGENCIA') };
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    if (c.chave < 0 || c.valor < 0) {
      problemas.push({ aba: ABA, linha: 1, mensagem: 'Faltam as colunas CHAVE e VALOR.', solucao: 'Confira o cabeçalho da aba na sandbox.' });
      return { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos }, plano: [] };
    }
    const criacao = (await tx.query<{ mes: string }>("select to_char(desde, 'YYYY-MM') as mes from unidade where id = $1", [unidadeId])).rows[0]!.mes;

    const porChave = new Map<string, Item>();
    for (const l of aba.linhas) {
      const chave = l.celulas[c.chave]!;
      const aviso = FORA_DO_SISTEMA[normalizar(chave)];
      if (aviso) {
        if (!avisos.includes(aviso)) avisos.push(aviso);
        continue;
      }
      const v = paramValidarLinhas([{ linha: l.linha, chave, valor: l.celulas[c.valor], vigencia: c.vigencia < 0 ? '' : vigenciaDaCelula(l.celulas[c.vigencia]!) }]);
      const boa = v.boas[0];
      if (!boa || !CHAVES_SISTEMA.includes(boa.chave)) {
        problemas.push({
          aba: ABA,
          linha: l.linha,
          mensagem: v.avisos[0] ? mensagemDoAviso(v.avisos[0]) : `${chave}: configuração que não existe mais.`,
          solucao: 'Corrija a linha na sandbox e importe de novo.',
        });
        continue;
      }
      const vigencia = boa.vigencia || criacao;
      porChave.set(`${boa.chave}|${vigencia}`, { chave: boa.chave, vigencia, valor: boa.valor });
    }

    const { rows } = await tx.query<{ chave: string; vigencia: string; valor: unknown }>(
      "select chave, to_char(vigencia_desde, 'YYYY-MM') as vigencia, valor from parametro where unidade_id = $1",
      [unidadeId],
    );
    const existentes = new Map(rows.map((r) => [`${r.chave}|${r.vigencia}`, r.valor]));
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const plano: Item[] = [];
    let iguais = 0;
    for (const [k, item] of porChave) {
      const descricao = `${paramDef(item.chave)!.rotulo} a partir de ${mesPorExtenso(item.vigencia)}`;
      if (!existentes.has(k)) {
        novos.push({ chave: k, descricao: `${descricao}: ${textoValor(item.valor)}` });
        plano.push(item);
      } else if (JSON.stringify(existentes.get(k)) !== JSON.stringify(item.valor)) {
        alterados.push({ chave: k, descricao, mudancas: [`valor: ${textoValor(existentes.get(k))} → ${textoValor(item.valor)}`] });
        plano.push(item);
      } else {
        iguais++;
      }
    }
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const p of plano) {
      await tx.query(
        `insert into parametro (chave, unidade_id, vigencia_desde, valor) values ($1, $2, $3, $4::jsonb)
         on conflict (chave, unidade_id, vigencia_desde) do update set valor = excluded.valor`,
        [p.chave, unidadeId, mesParaData(p.vigencia), JSON.stringify(p.valor)],
      );
    }
    return plano.length;
  },
};
