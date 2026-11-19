// Voluntariado lançado à mão por faixa de horário: a disponibilidade do mês como um mapa "aaaa-mm-dd" → faixas do dia (em minutos,
// [início, fim)). Os blocos são os do dia (vêm da API, tirados dos serviços que pedem voluntariado); aqui só se marca, desmarca e conta.
import type { FaixaDeDisponibilidade, MilitarDoVoluntariado } from 'contratos';
import { diaDaSemana, diasDoMes, unirFaixas, type Faixa } from 'dominio';

export type Marcas = Map<string, Faixa[]>;
export type Estado = 'cheio' | 'parcial' | 'vazio';

const DIA = 1440;
const horaDe = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const minutosDe = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

/** As faixas do dia, unidas. */
const doDia = (c: Marcas, dia: string): Faixa[] => unirFaixas(c.get(dia) ?? []);

/** Quanto do bloco está marcado no dia: "cheio" se todo, "parcial" se um pedaço, "vazio" se nada. */
export function estadoDoBloco(c: Marcas, dia: string, bloco: Faixa): Estado {
  const faixas = doDia(c, dia);
  const coberto = (min: number) => faixas.some((f) => f.inicio <= min && min < f.fim);
  let dentro = 0;
  for (let m = bloco.inicio; m < bloco.fim; m++) if (coberto(m)) dentro++;
  if (dentro === 0) return 'vazio';
  return dentro === bloco.fim - bloco.inicio ? 'cheio' : 'parcial';
}

/** As faixas sem o trecho do bloco (o que passa das pontas do bloco fica). */
const semOBloco = (faixas: Faixa[], { inicio, fim }: Faixa): Faixa[] =>
  faixas.flatMap((f) => {
    if (f.fim <= inicio || f.inicio >= fim) return [f];
    const pedacos: Faixa[] = [];
    if (f.inicio < inicio) pedacos.push({ inicio: f.inicio, fim: inicio });
    if (f.fim > fim) pedacos.push({ inicio: fim, fim: f.fim });
    return pedacos;
  });

/** Cheio tira o bloco; vazio ou parcial marca o bloco inteiro. */
export function alternarBloco(c: Marcas, dia: string, bloco: Faixa): Marcas {
  const novo: Marcas = new Map(c);
  const resto = semOBloco(novo.get(dia) ?? [], bloco);
  if (estadoDoBloco(c, dia, bloco) !== 'cheio') resto.push({ inicio: bloco.inicio, fim: bloco.fim });
  novo.set(dia, unirFaixas(resto));
  return novo;
}

/** Tira o bloco, esteja ele cheio ou parcial (arrastar para desmarcar não pode marcar o que estava pela metade). */
export function tirarBloco(c: Marcas, dia: string, bloco: Faixa): Marcas {
  const novo: Marcas = new Map(c);
  novo.set(dia, unirFaixas(semOBloco(novo.get(dia) ?? [], bloco)));
  return novo;
}

/** Marca o dia inteiro (0h–24h). */
export function marcarDias(c: Marcas, dias: string[]): Marcas {
  const novo: Marcas = new Map(c);
  for (const d of dias) novo.set(d, unirFaixas([...(novo.get(d) ?? []), { inicio: 0, fim: DIA }]));
  return novo;
}

/** Os sábados e domingos do mês. */
export const fimDeSemana = (mes: string): string[] => diasDoMes(mes).filter((d) => diaDaSemana(d) === 0 || diaDaSemana(d) === 6);

/** O dia N do mês anterior vira o dia N do mês; dia que não existe no mês (31 de outubro em novembro) é descartado. */
export function copiarDoMes(anterior: FaixaDeDisponibilidade[], mes: string): Marcas {
  const existentes = new Set(diasDoMes(mes));
  const novo: Marcas = new Map();
  for (const f of anterior) {
    const dia = `${mes}-${f.data.slice(8)}`;
    if (existentes.has(dia)) novo.set(dia, unirFaixas([...(novo.get(dia) ?? []), { inicio: minutosDe(f.inicio), fim: minutosDe(f.fim) }]));
  }
  return novo;
}

/** As faixas de cada dia, unidas e em horas "HH:MM" (fim 24h vai como "24:00"). */
export function faixasParaEnviar(c: Marcas): FaixaDeDisponibilidade[] {
  return [...c.keys()].sort().flatMap((data) => doDia(c, data).map((f) => ({ data, inicio: horaDe(f.inicio), fim: horaDe(f.fim) === '00:00' ? '24:00' : horaDe(f.fim) })));
}

/** Horas e dias do mês marcados: "12 horas em 2 dias.", "7 horas e 30 minutos em 1 dia.", "Nenhum horário marcado.". */
export function textoDoRodape(c: Marcas): string {
  let minutos = 0;
  let dias = 0;
  for (const d of c.keys()) {
    const faixas = doDia(c, d);
    if (faixas.length === 0) continue;
    dias++;
    minutos += faixas.reduce((t, f) => t + (f.fim - f.inicio), 0);
  }
  if (minutos === 0) return 'Nenhum horário marcado.';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const partes = [horas > 0 ? `${horas} ${horas === 1 ? 'hora' : 'horas'}` : '', resto > 0 ? `${resto} ${resto === 1 ? 'minuto' : 'minutos'}` : ''].filter(Boolean);
  return `${partes.join(' e ')} em ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;
}

/** Os dias do mês em que a disponibilidade não está marcada no dia (para o atalho de folgas). */
export const diasComHorario = (c: Marcas): string[] => [...c.keys()].filter((d) => doDia(c, d).length > 0).sort();

/** O conjunto de marcas vindo do servidor. */
export function marcasDoServidor(faixas: FaixaDeDisponibilidade[]): Marcas {
  const novo: Marcas = new Map();
  for (const f of faixas) novo.set(f.data, unirFaixas([...(novo.get(f.data) ?? []), { inicio: minutosDe(f.inicio), fim: minutosDe(f.fim) }]));
  return novo;
}

/** O próximo militar que ainda falta lançar, na ordem da lista: o primeiro depois do atual; sem nenhum depois, o primeiro do começo; ninguém, null. */
export function proximoQueFalta(militares: MilitarDoVoluntariado[], atualId: string): string | null {
  const i = militares.findIndex((m) => m.militarId === atualId);
  const faltam = (m: MilitarDoVoluntariado) => !m.lancado && m.militarId !== atualId;
  return [...militares.slice(i + 1), ...militares.slice(0, Math.max(i, 0))].find(faltam)?.militarId ?? null;
}
