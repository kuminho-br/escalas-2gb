// O texto dos cartões dos próximos serviços na tela inicial (6.55): puro, sem React. Datas 'aaaa-mm-dd', horas 'hh:mm'.
import type { MeuServico } from 'contratos';

const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const diaDaSemana = (data: string) => new Date(`${data}T00:00:00Z`).getUTCDay();

/** '2026-11-26' -> 'qui' */
export const diaDaSemanaCurto = (data: string): string => SEMANA_CURTA[diaDaSemana(data)]!;

/** '2026-11-26' -> 'quinta' (sem "-feira": é o que o cartão e a barra dizem) */
export const diaDaSemanaLongo = (data: string): string => SEMANA_LONGA[diaDaSemana(data)]!;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** O dia por extenso do detalhe: '2026-11-26' -> 'quinta-feira, 26 de novembro'; '2026-12-01' -> 'terça-feira, 1º de dezembro'. Segunda a sexta levam "-feira"; sábado e domingo não. */
export function diaPorExtenso(data: string): string {
  const n = diaDaSemana(data);
  const semana = n === 0 || n === 6 ? SEMANA_LONGA[n]! : `${SEMANA_LONGA[n]}-feira`;
  return `${semana}, ${diaDoMes(data)} de ${MESES[Number(data.slice(5, 7)) - 1]}`;
}

/** '2026-12-01' -> '1º'; os outros dias, só o número: '2026-12-02' -> '2' */
export function diaDoMes(data: string): string {
  const dia = Number(data.slice(8, 10));
  return dia === 1 ? '1º' : String(dia);
}

/** '07:00' -> '7h'; '07:30' -> '7h30' */
function horaCurta(hora: string): string {
  const h = Number(hora.slice(0, 2));
  const m = hora.slice(3, 5);
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

/** O horário do turno: '7h às 19h', '7h30 às 19h30'; fim à meia-noite é '24h' ('16h às 24h'); o turno que vira o dia é escrito como é ('19h às 7h'). */
export function horarioCurto(inicio: string, fim: string): string {
  const fimTexto = fim === '00:00' && inicio !== '00:00' ? '24h' : horaCurta(fim);
  return `${horaCurta(inicio)} às ${fimTexto}`;
}

/** O que a leitura de tela diz do cartão: 'quinta, 26, Pronto, das 7h às 19h'. */
export function rotuloDoCartao(s: Pick<MeuServico, 'data' | 'servico' | 'inicio' | 'fim'>): string {
  return `${diaDaSemanaLongo(s.data)}, ${diaDoMes(s.data)}, ${s.servico}, das ${horarioCurto(s.inicio, s.fim)}`;
}

// a tinta do sistema (--color-tinta) e a conta de contraste do texto branco sobre o fundo
const TINTA = [0x1c, 0x24, 0x30] as const;
const luz = (rgb: readonly number[]) => {
  const [r, g, b] = rgb.map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrasteComBranco = (rgb: readonly number[]) => 1.05 / (luz(rgb) + 0.05);

/** A parte da cor do serviço no fundo do cartão: 84% (16% de tinta), e menos se a cor for clara demais para o texto branco chegar a 4,5:1. */
const PARTE_DA_COR = 84;
const PASSO = 4;

/** O fundo do cartão: a cor do serviço misturada com a tinta (84% da cor); a cor clara ganha mais tinta, até o texto branco ler com 4,5:1. */
export function fundoDoCartao(cor: string): string {
  const rgb = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
  let parte = PARTE_DA_COR;
  const mistura = (p: number) => rgb.map((c, i) => Math.round((c * p) / 100 + (TINTA[i]! * (100 - p)) / 100));
  while (parte > 0 && contrasteComBranco(mistura(parte)) < 4.5) parte -= PASSO;
  return `color-mix(in srgb, ${cor} ${Math.max(parte, 0)}%, var(--color-tinta))`;
}
