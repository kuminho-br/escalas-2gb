// As colunas da planilha do Pecúlio, uma peça por coluna: cada uma lê o texto da célula e devolve o valor, "vazio" (o sistema não mexe naquele
// dado) ou o motivo de a célula ser ignorada. Só a MATRÍCULA é obrigatória; uma célula ignorada não recusa a linha.
import { Antiguidade, Cep, COMPORTAMENTOS, Cpf, EmailInstitucional, MSG_CEP, MSG_CPF, MSG_UF, Nascimento, Telefone, Uf } from 'contratos';
import { categoriasCnh, normalizar } from 'dominio';

/** O que uma célula diz: nada (vazia), um valor, ou o motivo de ser ignorada. */
export type Leitura<T> = { vazio: true } | { valor: T } | { motivo: string };
const VAZIO = { vazio: true } as const;
const valor = <T>(v: T): Leitura<T> => ({ valor: v });
const motivo = (m: string): Leitura<never> => ({ motivo: m });

/** '9902022' -> '990202-2'; formato certo passa direto; o resto é null. */
export function matriculaDe(bruto: string): { valor: string | null; corrigida: boolean } {
  const s = bruto.trim();
  if (/^\d{6}-\d$/.test(s)) return { valor: s, corrigida: false };
  if (/^\d{7}$/.test(s)) return { valor: `${s.slice(0, 6)}-${s.slice(6)}`, corrigida: true };
  return { valor: null, corrigida: false };
}

/** Um item com sigla (posto, lotação, quadro), achado pela sigla sem acento nem caixa. */
type ComSigla = { id: string; sigla: string };
const lista = (itens: { sigla: string }[]) => itens.map((i) => i.sigla).join(', ');

/** O posto pela sigla, sem diferenciar maiúsculas nem acentos. O posto não leva "BM" (a sigla antiga "SD BM" não vale mais: a importação é contrato). */
export function lerPosto(texto: string, postos: ComSigla[]): Leitura<ComSigla> {
  if (!texto) return VAZIO;
  const porChave = new Map(postos.map((p) => [normalizar(p.sigla), p]));
  const p = porChave.get(normalizar(texto));
  return p ? valor(p) : motivo(`Posto "${texto}" não existe. Use uma destas siglas: ${lista(postos)}.`);
}

export function lerSigla(texto: string, itens: ComSigla[], oQue: string): Leitura<ComSigla> {
  if (!texto) return VAZIO;
  const achado = itens.find((i) => normalizar(i.sigla) === normalizar(texto));
  return achado ? valor(achado) : motivo(`${oQue} "${texto}" não é desta importação. Use uma destas siglas: ${lista(itens)}.`);
}

/** Texto livre curto (nome completo, boletim, partes do endereço). */
export function lerTexto(texto: string, maximo: number): Leitura<string> {
  if (!texto) return VAZIO;
  return texto.length > maximo ? motivo(`Use no máximo ${maximo} caracteres.`) : valor(texto);
}

export function lerNomeDeGuerra(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  return texto.length > 60 ? motivo('Use no máximo 60 caracteres.') : valor(texto.toUpperCase());
}

export function lerAntiguidade(texto: string): Leitura<number> {
  if (!texto) return VAZIO;
  return /^\d+$/.test(texto) && Antiguidade.safeParse(Number(texto)).success ? valor(Number(texto)) : motivo('Use um número inteiro de 1 a 99999.');
}

export function lerSexo(texto: string): Leitura<'M' | 'F'> {
  if (!texto) return VAZIO;
  const s = normalizar(texto);
  return s === 'M' || s === 'F' ? valor(s) : motivo('Use M ou F.');
}

export const MSG_NASCIMENTO_DO_EXCEL = 'Use dd/mm/aaaa ou dd/mm, em formato de texto.';

/**
 * dd/mm/aaaa (o ano é guardado) ou só dd/mm. A célula que o Excel transformou em data (`ehData`), o número de série dele e o formato
 * aaaa-mm-dd são ignorados: o Excel põe o ano de hoje num "15/03" digitado, e o ano gravado sairia errado.
 */
export function lerNascimento(texto: string, ehData: boolean): Leitura<{ dia: number; mes: number; ano: number | null }> {
  if (!texto) return VAZIO;
  if (ehData || /^\d+([.,]\d+)?$/.test(texto) || /^\d{4}-\d{1,2}-\d{1,2}/.test(texto)) return motivo(MSG_NASCIMENTO_DO_EXCEL);
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(texto);
  const lido = m ? Nascimento.safeParse({ dia: Number(m[1]), mes: Number(m[2]), ano: m[3] ? Number(m[3]) : null }) : null;
  return lido?.success ? valor({ dia: lido.data.dia, mes: lido.data.mes, ano: lido.data.ano ?? null }) : motivo('Use dd/mm/aaaa ou dd/mm, de um dia que exista (ex.: 15/03/1985 ou 15/03).');
}

export function lerTelefone(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const lido = Telefone.safeParse(texto);
  return lido.success ? valor(lido.data) : motivo(lido.error.issues[0]!.message);
}

export function lerEmail(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const lido = EmailInstitucional.safeParse(texto);
  return lido.success ? valor(lido.data) : motivo(lido.error.issues[0]!.message);
}

export function lerComportamento(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const c = COMPORTAMENTOS.find((x) => normalizar(x) === normalizar(texto));
  return c ? valor(c) : motivo(`Use um destes: ${COMPORTAMENTOS.join(', ')}.`);
}

export function lerCpf(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const lido = Cpf.safeParse(texto);
  return lido.success ? valor(lido.data) : motivo(MSG_CPF);
}

export function lerCep(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const lido = Cep.safeParse(texto);
  return lido.success ? valor(lido.data) : motivo(MSG_CEP);
}

export function lerUf(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  const lido = Uf.safeParse(texto);
  return lido.success ? valor(lido.data) : motivo(MSG_UF);
}

export function lerJornada(texto: string): Leitura<'pronto' | 'adm'> {
  if (!texto) return VAZIO;
  const j = normalizar(texto);
  return j === 'PRONTO' ? valor('pronto') : j === 'ADM' ? valor('adm') : motivo('Use PRONTO ou ADM.');
}

const SIM = new Set(['SIM', 'S', 'X', '1']);
const NAO = new Set(['NAO', 'N', '0']);
export function lerSimNao(texto: string): Leitura<boolean> {
  if (!texto) return VAZIO;
  const t = normalizar(texto);
  return SIM.has(t) ? valor(true) : NAO.has(t) ? valor(false) : motivo('Use SIM ou NÃO.');
}

/** As letras da carteira, juntas (ex.: AD). Uma letra que não é categoria faz a célula inteira ser ignorada. */
export function lerCnh(texto: string): Leitura<string[]> {
  if (!texto) return VAZIO;
  const { categorias, invalidas } = categoriasCnh(texto);
  if (invalidas.length || !categorias.length) return motivo('Use as letras da carteira, juntas (ex.: AD): A, B, C, D ou E.');
  return valor([...categorias].sort());
}

/** O nome da equipe, como escrito (a equipe que não existe é criada). */
export function lerEquipe(texto: string): Leitura<string> {
  if (!texto) return VAZIO;
  return texto.length > 40 ? motivo('Use no máximo 40 caracteres.') : valor(texto);
}

/** A situação pelo nome, sem diferenciar maiúsculas nem acentos; só as ativas do catálogo. */
export function lerSituacao(texto: string, ativas: { id: string; nome: string }[]): Leitura<{ id: string; nome: string }> {
  if (!texto) return VAZIO;
  const s = ativas.find((x) => normalizar(x.nome) === normalizar(texto));
  return s ? valor(s) : motivo(`Situação "${texto}" não existe ou está desativada. Use uma destas: ${ativas.map((x) => x.nome).join(', ')}.`);
}

/** O nome de uma função do catálogo, ativa. */
export function lerFuncao(texto: string, ativas: { id: string; nome: string }[]): Leitura<{ id: string; nome: string }> {
  if (!texto) return VAZIO;
  const f = ativas.find((x) => normalizar(x.nome) === normalizar(texto));
  if (f) return valor(f);
  return motivo(
    ativas.length
      ? `Função "${texto}" não existe ou está desativada. Use uma destas: ${ativas.map((x) => x.nome).join(', ')}.`
      : `Função "${texto}" não existe: o catálogo de funções está vazio.`,
  );
}

/** A sigla de um quadro que tenha o posto do militar. */
export function lerQuadro(texto: string, quadros: (ComSigla & { postoGradIds: string[] })[], postoGradId: string, postoSigla: string): Leitura<ComSigla> {
  if (!texto) return VAZIO;
  const servem = quadros.filter((q) => q.postoGradIds.includes(postoGradId));
  const q = quadros.find((x) => normalizar(x.sigla) === normalizar(texto));
  const opcoes = servem.length ? `Use um destes: ${lista(servem)}.` : `Nenhum quadro tem o posto ${postoSigla}.`;
  if (!q) return motivo(`Quadro "${texto}" não existe. ${opcoes}`);
  return q.postoGradIds.includes(postoGradId) ? valor(q) : motivo(`O quadro ${q.sigla} não tem o posto ${postoSigla}. ${opcoes}`);
}

/** O CPF na prévia: só os 4 últimos dígitos (•••.•••.•47-25). */
export const cpfMascarado = (c: string | null) => (c ? `•••.•••.•${c.slice(7, 9)}-${c.slice(9)}` : null);
