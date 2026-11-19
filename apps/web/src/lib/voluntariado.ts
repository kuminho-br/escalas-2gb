// Voluntariado lançado à mão: as marcações do mês como conjunto de chaves "aaaa-mm-dd|A", e o que sai delas.
import type { MarcaDeVoluntariado, MilitarDoVoluntariado } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';

export type Marcas = Set<string>;

export const chaveDaMarca = (m: MarcaDeVoluntariado): string => `${m.data}|${m.turno}`;
export const conjuntoDeMarcas = (marcas: MarcaDeVoluntariado[]): Marcas => new Set(marcas.map(chaveDaMarca));

export function marcasDoConjunto(c: Marcas): MarcaDeVoluntariado[] {
  return [...c].sort().map((k) => ({ data: k.slice(0, 10), turno: k.slice(11) as 'A' | 'B' }));
}

/** Para comparar o que está na tela com o que foi gravado. */
export const serializar = (c: Marcas): string => [...c].sort().join(',');

export function contarMarcas(c: Marcas): { turnos: number; dias: number } {
  return { turnos: c.size, dias: new Set([...c].map((k) => k.slice(0, 10))).size };
}

/** "11 turnos em 8 dias." / "1 turno em 1 dia." / "Nenhum turno marcado." */
export function textoDoRodape(c: Marcas): string {
  const { turnos, dias } = contarMarcas(c);
  if (turnos === 0) return 'Nenhum turno marcado.';
  return `${turnos} ${turnos === 1 ? 'turno' : 'turnos'} em ${dias} ${dias === 1 ? 'dia' : 'dias'}.`;
}

/** Marca (ou desmarca) A e B do dia. */
export function aplicarAoDia(c: Marcas, dia: string, acao: 'marcar' | 'desmarcar'): Marcas {
  const novo = new Set(c);
  for (const t of ['A', 'B']) acao === 'marcar' ? novo.add(`${dia}|${t}`) : novo.delete(`${dia}|${t}`);
  return novo;
}

/** O dia está com os dois turnos marcados? Desmarca os dois; senão marca os dois. */
export const acaoDoDia = (c: Marcas, dia: string): 'marcar' | 'desmarcar' => (c.has(`${dia}|A`) && c.has(`${dia}|B`) ? 'desmarcar' : 'marcar');
export const alternarDia = (c: Marcas, dia: string): Marcas => aplicarAoDia(c, dia, acaoDoDia(c, dia));

/** Os sábados e domingos do mês. */
export const fimDeSemana = (mes: string): string[] => diasDoMes(mes).filter((d) => diaDaSemana(d) === 0 || diaDaSemana(d) === 6);

/** Acrescenta A e B dos dias ao que já está marcado. */
export function marcarDias(c: Marcas, dias: string[]): Marcas {
  return dias.reduce((acc, d) => aplicarAoDia(acc, d, 'marcar'), new Set(c));
}

/** O dia N do mês anterior vira o dia N do mês; dia que não existe no mês (31 de outubro em novembro) é descartado. */
export function copiarDoMes(anterior: MarcaDeVoluntariado[], mes: string): Marcas {
  const existentes = new Set(diasDoMes(mes));
  const marcas: Marcas = new Set();
  for (const m of anterior) {
    const dia = `${mes}-${m.data.slice(8)}`;
    if (existentes.has(dia)) marcas.add(`${dia}|${m.turno}`);
  }
  return marcas;
}

/** O próximo militar que ainda falta lançar, na ordem da lista: o primeiro depois do atual; sem nenhum depois, o primeiro do começo; ninguém, null. */
export function proximoQueFalta(militares: MilitarDoVoluntariado[], atualId: string): string | null {
  const i = militares.findIndex((m) => m.militarId === atualId);
  const faltam = (m: MilitarDoVoluntariado) => !m.lancado && m.militarId !== atualId;
  return [...militares.slice(i + 1), ...militares.slice(0, Math.max(i, 0))].find(faltam)?.militarId ?? null;
}
