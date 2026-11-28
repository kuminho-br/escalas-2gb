// O choque de um lançamento que não passa pela lista "Escolher militar": a escala dos oficiais (6.39) grava a alocação direto e usa esta conferência, que é a mesma
// do choque universal (6.37): as alocações do militar em todas as unidades, o expediente lançado pela pré-escala (6.71) e a decisão de pôr o serviço por cima dele (6.38).
import { chaveAloc, type AlocChoque } from 'dominio';
import { CADASTRO, temPapel } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { somarDias } from '../datas.ts';
import { choqueDoTurno, DE_EXPEDIENTE, JA_ESCALADO } from './elegibilidade.ts';
import { alocacoesDaJanela, horariosDaUnidade, somarOutrasUnidades } from './horarios.ts';

export type ChoqueDoLancamento = {
  motivo: string;
  /** o serviço pode tirar o militar do expediente (a opção do cadastro) e quem pede tem nível de acesso na lotação dele: a tela pode perguntar e repetir o pedido com `resolverChoque` */
  podeResolver: boolean;
  /** o expediente lançado pela pré-escala que está no caminho (6.71): quem resolve o choque o tira antes de gravar, como `escalarResolvendo` */
  expedienteLancadoId?: string;
};

/**
 * Confere o choque de pôr o militar neste turno neste dia: "Já escalado neste horário" (o mesmo horário em outro lugar), "Choque de horário" (sobreposto) ou "De expediente
 * neste dia" (o expediente lançado pela pré-escala, 6.71). `tirarDoExpediente`: o escalante decidiu pôr o serviço por cima do expediente; só vale para o serviço com a opção.
 * Null quando não há choque.
 */
export async function choqueDoLancamento(
  c: Consulta,
  d: { unidadeId: string; militarId: string; data: string; turnoId: string; tirarDoExpediente?: boolean; usuarioId: string; hoje: string },
): Promise<ChoqueDoLancamento | null> {
  const turno = (
    await c.query<{ nome: string; letra: 'A' | 'B' | 'C'; inicio: string; fim: string; tira: boolean }>(
      `select s.nome, t.letra, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, s.tira_do_expediente as tira
         from turno t join servico s on s.id = t.servico_id where t.id = $1`,
      [d.turnoId],
    )
  ).rows[0]!;
  // a lotação do período que vale no dia (onde se confere o poder de tirar do expediente)
  const periodo = (
    await c.query<{ unidade_id: string }>(
      'select unidade_id from rastreio where militar_id = $1 and desde <= $2::date and (ate is null or ate >= $2::date) order by desde desc limit 1',
      [d.militarId, d.data],
    )
  ).rows[0];
  const regras = await horariosDaUnidade(c, d.unidadeId);
  const janela = await alocacoesDaJanela(c, [d.militarId], somarDias(d.data, -1), somarDias(d.data, 1), d.unidadeId);
  if (janela.some((a) => a.data === d.data && a.inicio === turno.inicio && a.fim === turno.fim)) return { motivo: JA_ESCALADO, podeResolver: false };
  somarOutrasUnidades(regras, janela);
  const porChave = new Map(janela.map((a) => [chaveAloc({ mat: a.militarId, dia: a.data, servico: a.servico, turno: a.letra }), a] as const));
  const existentes: AlocChoque[] = janela.map((a) => ({ mat: d.militarId, dia: a.data, turno: a.letra, servico: a.servico }));

  // só passa por cima do expediente quem tem nível de acesso na lotação do militar (o expediente é da lotação dele)
  const poder = turno.tira && !!periodo && (await temPapel(c, d.usuarioId, periodo.unidade_id, CADASTRO, d.hoje));
  const choque = choqueDoTurno({ militarId: d.militarId, data: d.data, turno, existentes, regras, porChave, poePorCima: !!d.tirarDoExpediente && poder });
  if (!choque) return null;
  return {
    motivo: choque.motivo,
    podeResolver: choque.motivo === DE_EXPEDIENTE && !choque.conflito.alocacoes.length && poder,
    ...(choque.conflito.expedienteLancado ? { expedienteLancadoId: choque.conflito.expedienteLancado.id } : {}),
  };
}
