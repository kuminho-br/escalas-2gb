// Voluntariado lançado à mão: as marcações do mês como conjunto de chaves "aaaa-mm-dd|A", e o que sai delas.
import type { MarcaDeVoluntariado, MilitarDoVoluntariado } from 'contratos';

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

/** Os dois turnos marcados no dia? Desmarca os dois; senão marca os dois. */
export function alternarDia(c: Marcas, dia: string): Marcas {
  const novo = new Set(c);
  if (novo.has(`${dia}|A`) && novo.has(`${dia}|B`)) {
    novo.delete(`${dia}|A`);
    novo.delete(`${dia}|B`);
  } else {
    novo.add(`${dia}|A`);
    novo.add(`${dia}|B`);
  }
  return novo;
}

/** O próximo militar que ainda falta lançar, na ordem da lista: o primeiro depois do atual; sem nenhum depois, o primeiro do começo; ninguém, null. */
export function proximoQueFalta(militares: MilitarDoVoluntariado[], atualId: string): string | null {
  const i = militares.findIndex((m) => m.militarId === atualId);
  const faltam = (m: MilitarDoVoluntariado) => !m.lancado && m.militarId !== atualId;
  return [...militares.slice(i + 1), ...militares.slice(0, Math.max(i, 0))].find(faltam)?.militarId ?? null;
}
