// Importação da aba FERIADOS (DATA, DESCRIÇÃO), lida como a aba do protótipo. O feriado de data móvel entra com
// fixo falso (a descrição diz); o que a unidade de cima já tem não é repetido na seção.
import { type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { normalizar } from 'dominio';
import { coluna, lerData } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'FERIADOS';
const MAX_DESCRICAO = 120;

const COLUNAS = {
  data: { rotulo: 'DATA', obrigatoria: true, ajuda: 'Dia do feriado (dd/mm/aaaa).' },
  descricao: { rotulo: 'DESCRIÇÃO', obrigatoria: true, ajuda: 'Nome do feriado. Carnaval, Cinzas, Paixão, Sexta-feira Santa, Páscoa e Corpus Christi entram como móveis (mudam de data todo ano).' },
} satisfies Record<string, ColunaModelo>;

// descrições (sem acento, caixa nem espaços) dos feriados que não caem no mesmo dia todo ano
const MOVEIS = ['CARNAVAL', 'CINZAS', 'PAIXAO', 'CORPUSCHRISTI', 'SEXTAFEIRASANTA', 'PASCOA'];

type Plano = { novos: { data: string; descricao: string; fixo: boolean }[]; alterados: { id: string; descricao: string }[] };

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** 'dd/mm/aaaa' ou 'aaaa-mm-dd' -> 'aaaa-mm-dd'; null se não for uma data que existe. */
export const importadorFeriados: Importador<Plano> = {
  abas: [ABA],

  modelo: { abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }] },

  async planejar(abas, { tx, unidadeId }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<keyof typeof COLUNAS, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    for (const [falta, rotulo] of [[c.data, COLUNAS.data.rotulo], [c.descricao, COLUNAS.descricao.rotulo]] as const) {
      if (falta < 0) problemas.push({ aba: ABA, linha: 1, mensagem: `Falta a coluna ${rotulo}.`, solucao: 'Use o modelo desta tela.' });
    }
    if (problemas.length) return { previa: { novos, alterados, iguais: 0, problemas, avisos }, plano: { novos: [], alterados: [] } };

    const lidos = new Map<string, { descricao: string }>();
    for (const l of aba.linhas) {
      const bruta = (l.celulas[c.data] ?? '').trim();
      const descricao = (l.celulas[c.descricao] ?? '').trim();
      if (!bruta) {
        problemas.push({ aba: ABA, linha: l.linha, mensagem: `Data vazia em ${descricao || 'feriado'}`, solucao: 'Preencha a coluna DATA (dd/mm/aaaa).' });
        continue;
      }
      const data = lerData(bruta);
      if (!data) {
        problemas.push({ aba: ABA, linha: l.linha, mensagem: `Data "${bruta}" de ${descricao || 'feriado'}`, solucao: 'Use dd/mm/aaaa (ex.: 07/09/2026) na coluna DATA.' });
        continue;
      }
      if (!descricao) {
        problemas.push({ aba: ABA, linha: l.linha, mensagem: `Feriado de ${dataBr(data)} sem descrição`, solucao: 'Preencha a coluna DESCRIÇÃO.' });
        continue;
      }
      // o que a importação aceita, a tela precisa conseguir salvar de novo (o limite do contrato é 120)
      if (descricao.length > MAX_DESCRICAO) {
        problemas.push({ aba: ABA, linha: l.linha, mensagem: `Descrição do feriado de ${dataBr(data)} tem mais de ${MAX_DESCRICAO} caracteres`, solucao: 'Encurte o texto na coluna DESCRIÇÃO.' });
        continue;
      }
      const antes = lidos.get(data);
      if (antes) {
        avisos.push(`${dataBr(data)} aparece mais de uma vez: vale "${antes.descricao}".`);
        continue;
      }
      lidos.set(data, { descricao });
    }

    // o que já existe: o da própria unidade (compara) e o das unidades acima (não repete)
    const { rows } = await tx.query<{ id: string; data: string; descricao: string; proprio: boolean }>(
      `select f.id, to_char(f.data, 'YYYY-MM-DD') as data, f.descricao, f.unidade_id = alvo.id as proprio
         from feriado f join unidade un on un.id = f.unidade_id join unidade alvo on alvo.id = $1
        where un.caminho @> alvo.caminho`,
      [unidadeId],
    );
    const proprios = new Map(rows.filter((r) => r.proprio).map((r) => [r.data, r]));
    const herdados = new Set(rows.filter((r) => !r.proprio).map((r) => r.data));

    const plano: Plano = { novos: [], alterados: [] };
    let iguais = 0;
    let jaHerdados = 0;
    for (const [data, { descricao }] of lidos) {
      const atual = proprios.get(data);
      if (!atual) {
        if (herdados.has(data)) {
          iguais++;
          jaHerdados++;
          continue;
        }
        const fixo = !MOVEIS.some((m) => normalizar(descricao).includes(m));
        if (!fixo) avisos.push(`Marcado como móvel: ${descricao}`);
        plano.novos.push({ data, descricao, fixo });
        novos.push({ chave: data, descricao: `${dataBr(data)}: ${descricao}` });
      } else if (atual.descricao !== descricao) {
        // só a descrição vem da planilha: se o feriado é fixo ou móvel é escolha da tela e não muda aqui
        plano.alterados.push({ id: atual.id, descricao });
        alterados.push({ chave: data, descricao: dataBr(data), mudancas: [`descrição: "${atual.descricao}" → "${descricao}"`] });
      } else iguais++;
    }
    if (jaHerdados) avisos.push(`${jaHerdados} ${jaHerdados === 1 ? 'feriado já vem' : 'feriados já vêm'} de uma unidade acima e não ${jaHerdados === 1 ? 'foi repetido' : 'foram repetidos'}.`);
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const f of plano.novos) await tx.query('insert into feriado (unidade_id, data, descricao, fixo) values ($1, $2::date, $3, $4)', [unidadeId, f.data, f.descricao, f.fixo]);
    for (const a of plano.alterados) await tx.query('update feriado set descricao = $2 where id = $1', [a.id, a.descricao]);
    return plano.novos.length + plano.alterados.length;
  },
};
