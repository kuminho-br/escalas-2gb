// A exportação de militares para Excel (entrega 6.54): POST /api/consulta/militares/exportar. A planilha tem as colunas da importação do Pecúlio (aba PECÚLIO, mesmos rótulos e ordem),
// então dá para exportar, corrigir no Excel e importar de volta. Cada célula segue o que a ficha mostraria a quem exporta (as camadas de visão, 6.11): o que a pessoa não vê sai
// vazio, e na importação célula vazia não muda nada. A MATRÍCULA sai sempre.
import { COLUNAS_DA_EXPORTACAO, LIMITE_DA_EXPORTACAO, mesParaData, type BlocoDaExportacao, type PedidoDeExportacao } from 'contratos';
import ExcelJS from 'exceljs';
import { CADASTRO, ehAdministrador, papeisVigentes, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { COLUNAS, ABA, comRotulo } from '../importacao/peculio.ts';
import { cabecalho } from '../importacao/modelo.ts';
import { buscarComFiltros } from './busca.ts';
import { blocosDaUnidade } from './visao.ts';

export type RespostaDaExportacao = { ok: true; arquivo: ArrayBuffer } | { ok: false; status: 400 | 403 | 404; erro: string };

type Linha = {
  id: string; matricula: string; posto: string; nome_completo: string | null; nome_guerra: string; antiguidade: number | null; sexo: string | null;
  nascimento_dia: number | null; nascimento_mes: number | null; nascimento_ano: number | null; cpf: string | null; cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; telefone: string | null; email: string | null; email_pessoal: string | null;
  comportamento: string | null; comportamento_boletim: string | null; motorista: boolean; cnh: string[]; voluntario_jes: boolean; funcao: string | null; abono_permanencia: boolean;
  unidade_id: string | null; unidade_sigla: string | null; unidade_mae: string | null;
  quadro: string | null; situacao: string | null; jornada: 'pronto' | 'adm' | null; equipe: string | null;
};

const dois = (n: number) => String(n).padStart(2, '0');
const simNao = (b: boolean) => (b ? 'SIM' : 'NÃO');

export async function exportarMilitares(c: Consulta, usuarioId: string, pedido: PedidoDeExportacao, hoje: string): Promise<RespostaDaExportacao> {
  const admin = await ehAdministrador(c, usuarioId, hoje);
  if (!admin && !(await papeisVigentes(c, usuarioId, hoje)).length) return { ok: false, status: 403, erro: 'Só quem tem nível de acesso exporta militares.' };
  if (!pedido.filtros && !pedido.ids?.length) return { ok: false, status: 400, erro: 'Escolha o que exportar.' };

  // quem sai: a busca inteira (sem o corte de 500) e/ou a seleção, sem repetir; a ordem final é a da busca (nome de guerra, matrícula)
  const ids = new Set(pedido.ids ?? []);
  if (pedido.filtros) {
    const busca = await buscarComFiltros(c, usuarioId, pedido.filtros, hoje, { semCorte: true });
    if (!busca.ok) return busca;
    for (const x of busca.resultado.militares) ids.add(x.id);
  }
  if (ids.size > LIMITE_DA_EXPORTACAO) return { ok: false, status: 400, erro: `Mais de ${LIMITE_DA_EXPORTACAO} militares. Afine a busca.` };

  // o que a importação lê (a planilha é o arquivo dela): a lotação do mês de hoje (ou a mais recente) e, do período aberto, a jornada, a equipe, o quadro e a situação. Com uma mudança
  // marcada para depois, saem os valores do período aberto: assim exportar e importar o mesmo arquivo não desfaz a mudança marcada nem cria equipe na seção errada
  const { rows } = await c.query<Linha>(
    `select m.id, m.matricula, p.sigla as posto, m.nome_completo, m.nome_guerra, m.antiguidade, m.sexo, m.nascimento_dia, m.nascimento_mes, m.nascimento_ano, m.cpf, m.cep, m.logradouro,
            m.numero, m.complemento, m.bairro, m.cidade, m.uf, m.telefone, m.email, m.email_pessoal, m.comportamento, m.comportamento_boletim, m.motorista, m.cnh, m.voluntario_jes,
            fm.nome as funcao, m.abono_permanencia, l.unidade_id, un.sigla as unidade_sigla, mae.sigla as unidade_mae,
            aq.sigla as quadro, asm.nome as situacao, a.jornada, ae.nome as equipe
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join funcao_militar fm on fm.id = m.funcao_militar_id
       left join lateral (
         select r.unidade_id from rastreio r where r.militar_id = m.id
          order by (r.desde <= $2::date and (r.ate is null or r.ate >= $2::date)) desc, r.desde desc limit 1
       ) l on true
       left join unidade un on un.id = l.unidade_id
       left join unidade mae on mae.id = un.mae_id
       left join rastreio a on a.militar_id = m.id and a.ate is null
       left join equipe ae on ae.id = a.equipe_id
       left join quadro aq on aq.id = a.quadro_id
       left join situacao_militar asm on asm.id = a.situacao_id
      where m.id = any($1::uuid[])
      order by m.nome_guerra, m.matricula`,
    [[...ids], mesParaData(hoje.slice(0, 7))],
  );

  // o nome da lotação como a importação escreve na AJUDA (a unidade de cima quando a sigla se repete): os rótulos de todas as unidades em vigor, lidos uma vez
  const unidades = comRotulo(
    (await c.query<{ id: string; sigla: string; mae: string | null }>(
      'select u.id, u.sigla, m.sigla as mae from unidade u left join unidade m on m.id = u.mae_id where u.ate is null or u.ate >= $1::date', [hoje],
    )).rows,
  );
  const rotuloDe = new Map(unidades.map((u) => [u.id, u.rotulo]));

  // o que a pessoa vê, por lotação (uma vez por unidade, não por militar)
  const visao = new Map<string, { blocos: Awaited<ReturnType<typeof blocosDaUnidade>>; completa: boolean }>();
  const visaoDe = async (unidadeId: string | null) => {
    const chave = unidadeId ?? '';
    if (!visao.has(chave)) {
      visao.set(chave, {
        blocos: await blocosDaUnidade(c, usuarioId, unidadeId, hoje),
        completa: unidadeId ? await temPapel(c, usuarioId, unidadeId, CADASTRO, hoje) : admin,
      });
    }
    return visao.get(chave)!;
  };

  const pedidas = new Set(['MATRÍCULA', ...pedido.colunas]);
  const colunas = COLUNAS_DA_EXPORTACAO.filter((x) => pedidas.has(x.rotulo));
  const texto = new Set(Object.values(COLUNAS).filter((x) => 'texto' in x && x.texto).map((x) => x.rotulo));
  texto.add('MATRÍCULA');

  const celula = (l: Linha, rotulo: string): string | number => {
    const nasc = l.nascimento_dia !== null && l.nascimento_mes !== null ? `${dois(l.nascimento_dia)}/${dois(l.nascimento_mes)}${l.nascimento_ano ? `/${l.nascimento_ano}` : ''}` : '';
    switch (rotulo) {
      case 'MATRÍCULA': return l.matricula;
      case 'POSTO/GRAD': return l.posto;
      case 'NOME COMPLETO': return l.nome_completo ?? '';
      case 'NOME DE GUERRA': return l.nome_guerra;
      case 'ANTIGUIDADE': return l.antiguidade ?? '';
      case 'SEXO': return l.sexo ?? '';
      case 'NASCIMENTO': return nasc;
      case 'TELEFONE': return l.telefone ?? '';
      case 'E-MAIL': return l.email ?? '';
      case 'E-MAIL PESSOAL': return l.email_pessoal ?? '';
      case 'COMPORTAMENTO': return l.comportamento ?? '';
      case 'BOLETIM DO COMPORTAMENTO': return l.comportamento_boletim ?? '';
      case 'CPF': return l.cpf ?? '';
      case 'CEP': return l.cep ?? '';
      case 'LOGRADOURO': return l.logradouro ?? '';
      case 'NÚMERO': return l.numero ?? '';
      case 'COMPLEMENTO': return l.complemento ?? '';
      case 'BAIRRO': return l.bairro ?? '';
      case 'CIDADE': return l.cidade ?? '';
      case 'UF': return l.uf ?? '';
      case 'LOTAÇÃO': return l.unidade_id ? (rotuloDe.get(l.unidade_id) ?? l.unidade_sigla ?? '') : '';
      case 'QUADRO': return l.quadro ?? '';
      case 'SITUAÇÃO': return l.situacao ?? '';
      case 'JORNADA': return l.jornada ? l.jornada.toUpperCase() : '';
      case 'EQUIPE': return l.equipe ?? '';
      case 'MOTORISTA': return simNao(l.motorista);
      case 'CNH': return [...l.cnh].sort().join('');
      case 'VOLUNTÁRIO JES': return simNao(l.voluntario_jes);
      case 'FUNÇÃO': return l.funcao ?? '';
      case 'ABONO DE PERMANÊNCIA': return simNao(l.abono_permanencia);
      default: return '';
    }
  };
  /** O bloco da ficha que libera a coluna: a identificação sai para toda conta com nível de acesso (a busca já a mostra), os outros pela lotação do militar. */
  const vê = (bloco: BlocoDaExportacao, v: Awaited<ReturnType<typeof visaoDe>>) =>
    bloco === 'identificacao' ? true : bloco === 'ficha_completa' ? v.completa : v.blocos.has(bloco);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ABA);
  cabecalho(ws, colunas.map((x) => ({ rotulo: x.rotulo, texto: texto.has(x.rotulo) })));
  for (const l of rows) {
    const v = await visaoDe(l.unidade_id);
    ws.addRow(colunas.map((x) => (vê(x.bloco, v) ? celula(l, x.rotulo) : '')));
  }
  const buf = await wb.xlsx.writeBuffer();
  return { ok: true, arquivo: new Uint8Array(buf as ArrayBuffer).slice().buffer };
}
