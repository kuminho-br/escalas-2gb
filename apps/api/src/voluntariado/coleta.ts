// A coleta do voluntariado (fase 7.1): enquanto a unidade tem a coleta de um mês aberta, o militar lotado nela marca o próprio voluntariado.
// Existir a linha em `voluntariado_coleta` é estar aberta; fechar é apagá-la.
import { mesParaData, mesPorExtenso } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';

/** A coleta está aberta: a linha existe e o mês é o atual ou um futuro (uma coleta esquecida em mês que passou não conta). */
export async function coletaAberta(c: Consulta, unidadeId: string, mes: string): Promise<boolean> {
  if (mes < hojeRecife().slice(0, 7)) return false;
  const { rows } = await c.query('select 1 from voluntariado_coleta where unidade_id = $1 and mes = $2::date', [unidadeId, mesParaData(mes)]);
  return rows.length > 0;
}

/** Abre (aberta = true; abrir de novo não muda nada, nem quem abriu) ou fecha (aberta = false) a coleta da unidade no mês. */
export async function mudarColeta(tx: Consulta, unidadeId: string, mes: string, aberta: boolean, usuarioId: string): Promise<void> {
  if (aberta) {
    await tx.query('insert into voluntariado_coleta (unidade_id, mes, aberta_por) values ($1, $2::date, $3) on conflict (unidade_id, mes) do nothing', [unidadeId, mesParaData(mes), usuarioId]);
  } else {
    await tx.query('delete from voluntariado_coleta where unidade_id = $1 and mes = $2::date', [unidadeId, mesParaData(mes)]);
  }
}

// os textos que o militar lê quando não pode marcar (fixos: as telas e os testes os repetem)
export const mensagemColetaFechada = (mes: string) => `A coleta de ${mesPorExtenso(mes)} está fechada. Fale com o escalante da sua seção.`;
export const mensagemSoAPartirDe = (mesAtual: string) => `Só dá para marcar a partir de ${mesPorExtenso(mesAtual)}.`;
export const mensagemNaoLotado = (mes: string) => `Você não está lotado em nenhuma seção em ${mesPorExtenso(mes)}.`;
export const mensagemSemEscala = (mes: string) => `A sua situação em ${mesPorExtenso(mes)} não permite escala. Fale com quem cuida do seu cadastro.`;
