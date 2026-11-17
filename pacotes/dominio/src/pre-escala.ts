// Pré-escala do Pronto (porte de prototipo/pre_escala.js), com as remoções do escalante.
//   - quatro equipes em ciclo fixo ALFA -> BRAVO -> CHARLIE -> DELTA -> ALFA;
//   - a equipe de turno trabalha 1 dia a cada 4, nos turnos A e B do serviço "Pronto";
//   - a equipe do dia 01 do mês é descoberta pelo mês anterior (votação).
// Regra nova (adendo de 17/11/2026): o que o escalante removeu não volta quando a pré-escala é
// gerada de novo.
import { diasDoMes, grupoDoMilitar, normalizar, numeroDoDia, type Militar } from './nucleo.ts';

export const CICLO_EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'];
export const PRE_ESCALA = { SERVICO: 'Pronto', TURNOS: ['A', 'B'], JANELA_DIAS: 12 };

/** Militar retirado pelo escalante de um serviço e turno num dia. */
export interface Remocao { mat: string; dia: string; servico: string; turno: string }

export interface AlocPreEscala { mat: string; dia: string; servico: string; turno: string }

export function mesVizinho(mes: string, delta: number): string {
  const p = mes.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mesAnterior(mes: string): string {
  return mesVizinho(mes, -1);
}

export function proximoMes(mes: string): string {
  return mesVizinho(mes, 1);
}

/** Equipe de turno no dia de índice i (0 = dia 01), dado quem trabalha no dia 01. */
export function equipeDoDia(equipeDia1: string, i: number): string {
  return CICLO_EQUIPES[(CICLO_EQUIPES.indexOf(equipeDia1) + i) % 4];
}

/** matrícula -> equipe, só militares do Pronto da seção com equipe do ciclo. */
export function mapaEquipes(militares: Militar[], secao?: string | null): Record<string, string> {
  const secaoN = secao ? normalizar(secao) : '';
  const mapa: Record<string, string> = Object.create(null);
  militares.forEach((m) => {
    if (secaoN && normalizar(m.secao) !== secaoN) return;
    const g = grupoDoMilitar(m);
    if (CICLO_EQUIPES.indexOf(g) >= 0 && !(m.mat in mapa)) mapa[m.mat] = g;
  });
  return mapa;
}

/**
 * Descobre qual equipe trabalha no dia 01 de op.mes olhando o mês anterior: em cada um dos últimos
 * JANELA_DIAS dias, a equipe que mais apareceu no Pronto turno A vota; vence a equipe inicial mais
 * apontada. Empate (no dia ou no total) não decide.
 */
export function detectarEquipeInicial(alocs: AlocPreEscala[], militares: Militar[], op: { mes: string; secao?: string | null }) {
  const anterior = mesAnterior(op.mes);
  const nuloRes = (motivo: string, extra?: Partial<{ votos: Record<string, number>; diasComVoto: number; diasNaJanela: number }>) => ({
    equipe: null as string | null,
    votos: {} as Record<string, number>,
    diasComVoto: 0,
    diasNaJanela: 0,
    concordam: 0,
    divergentes: [] as string[],
    mesAnterior: anterior,
    motivo,
    ...extra,
  });
  const equipeDe = mapaEquipes(militares, op.secao);
  const janela = diasDoMes(anterior).slice(-PRE_ESCALA.JANELA_DIAS);
  const naJanela: Record<string, boolean> = Object.create(null);
  janela.forEach((d) => {
    naJanela[d] = true;
  });

  const vistos: Record<string, boolean> = Object.create(null);
  const porDia: Record<string, Record<string, number>> = Object.create(null);
  alocs.forEach((a) => {
    if (a.servico !== PRE_ESCALA.SERVICO || a.turno !== 'A' || !naJanela[a.dia]) return;
    const eq = equipeDe[a.mat];
    if (!eq) return;
    const k = `${a.mat}|${a.dia}`;
    if (vistos[k]) return;
    vistos[k] = true;
    if (!porDia[a.dia]) porDia[a.dia] = Object.create(null);
    porDia[a.dia][eq] = (porDia[a.dia][eq] || 0) + 1;
  });

  const primeiro = numeroDoDia(`${op.mes}-01`);
  const votos: Record<string, number> = {};
  const implicada: Record<string, string> = {};
  let diasComVoto = 0;
  Object.keys(porDia).sort().forEach((dia) => {
    const c = porDia[dia];
    const ordenadas = Object.keys(c).sort((x, y) => c[y] - c[x]);
    if (ordenadas.length > 1 && c[ordenadas[0]] === c[ordenadas[1]]) return; // empate no dia: não vota
    const delta = primeiro - numeroDoDia(dia);
    const inicial = CICLO_EQUIPES[(CICLO_EQUIPES.indexOf(ordenadas[0]) + delta) % 4];
    votos[inicial] = (votos[inicial] || 0) + 1;
    implicada[dia] = inicial;
    diasComVoto++;
  });

  if (diasComVoto === 0) return nuloRes('sem Pronto turno A no mês anterior', { diasNaJanela: janela.length });
  const ordem = Object.keys(votos).sort((x, y) => votos[y] - votos[x]);
  if (ordem.length > 1 && votos[ordem[0]] === votos[ordem[1]]) {
    return nuloRes(`empate entre ${ordem[0]} e ${ordem[1]}`, { votos, diasComVoto, diasNaJanela: janela.length });
  }
  const equipe = ordem[0];
  return {
    equipe: equipe as string | null,
    votos,
    diasComVoto,
    diasNaJanela: janela.length,
    concordam: votos[equipe],
    divergentes: Object.keys(implicada).filter((d) => implicada[d] !== equipe).sort(),
    mesAnterior: anterior,
    motivo: '',
  };
}

/**
 * Gera as alocações de Pronto do mês. Nunca sobrescreve: uma vaga (matrícula + dia + turno) já
 * ocupada, por qualquer serviço, é pulada; por isso rodar duas vezes não duplica nada.
 * op.remocoes: vagas de Pronto de onde o escalante tirou o militar; não são preenchidas de novo e
 * entram em puladas como { chave, existente: 'removido' }.
 */
export function gerarPreEscala(
  alocsExistentes: AlocPreEscala[],
  militares: Militar[],
  op: { mes: string; secao?: string | null; equipeDia1: string; remocoes?: Remocao[] | null },
) {
  if (CICLO_EQUIPES.indexOf(op.equipeDia1) < 0) throw new Error(`Equipe do dia 01 inválida: "${op.equipeDia1}".`);
  const dias = diasDoMes(op.mes);
  const equipeDe = mapaEquipes(militares, op.secao);
  const porEquipeMats: Record<string, string[]> = {};
  CICLO_EQUIPES.forEach((e) => {
    porEquipeMats[e] = [];
  });
  Object.keys(equipeDe).forEach((mat) => porEquipeMats[equipeDe[mat]].push(mat));
  CICLO_EQUIPES.forEach((e) => porEquipeMats[e].sort());

  const ocupado: Record<string, string> = Object.create(null); // vaga -> serviço que já está lá
  alocsExistentes.forEach((a) => {
    const k = `${a.mat}|${a.dia}|${a.turno}`;
    if (a.dia.slice(0, 7) === op.mes && !(k in ocupado)) ocupado[k] = a.servico;
  });
  const removida: Record<string, boolean> = Object.create(null);
  (op.remocoes || []).forEach((r) => {
    if (normalizar(r.servico) === normalizar(PRE_ESCALA.SERVICO)) removida[`${r.mat}|${r.dia}|${normalizar(r.turno)}`] = true;
  });

  const novas: { mat: string; dia: string; servico: string; turno: string; funcao: string }[] = [];
  const puladas: { chave: string; existente: string }[] = [];
  const porEquipe: Record<string, { militares: number; dias: number; alocacoes: number }> = {};
  CICLO_EQUIPES.forEach((e) => {
    porEquipe[e] = { militares: porEquipeMats[e].length, dias: 0, alocacoes: 0 };
  });
  let diasParciais = 0;
  let removidas = 0;
  const eRemovida: Record<number, boolean> = Object.create(null); // índice em puladas -> é remoção

  dias.forEach((dia, i) => {
    const eq = equipeDoDia(op.equipeDia1, i);
    porEquipe[eq].dias++;
    porEquipeMats[eq].forEach((mat) => {
      let criadas = 0;
      let puladasDoDia = 0;
      PRE_ESCALA.TURNOS.forEach((turno) => {
        const chave = `${mat}|${dia}|${turno}`;
        if (chave in ocupado) {
          puladas.push({ chave, existente: ocupado[chave] });
          puladasDoDia++;
          return;
        }
        if (removida[`${mat}|${dia}|${normalizar(turno)}`]) {
          puladas.push({ chave, existente: 'removido' });
          eRemovida[puladas.length - 1] = true;
          removidas++;
          return;
        }
        novas.push({ mat, dia, servico: PRE_ESCALA.SERVICO, turno, funcao: '' });
        porEquipe[eq].alocacoes++;
        criadas++;
      });
      if (criadas > 0 && puladasDoDia > 0) diasParciais++;
    });
  });

  const avisos: string[] = [];
  CICLO_EQUIPES.forEach((e) => {
    if (porEquipe[e].militares === 0) avisos.push(`A equipe ${e} não tem militares do Pronto na seção "${op.secao}"; nenhum serviço foi gerado para os dias dela.`);
  });
  const ocupadas = puladas.length - removidas;
  if (ocupadas) {
    const outro = puladas.filter((p, i) => !eRemovida[i] && p.existente !== PRE_ESCALA.SERVICO).length;
    avisos.push(`${ocupadas} vaga(s) já estavam ocupadas e foram mantidas (${ocupadas - outro} já eram Pronto, ${outro} eram de outro serviço).`);
  }
  if (removidas) avisos.push(`${removidas} vaga(s) foram mantidas sem o militar porque o escalante o removeu.`);
  if (diasParciais) avisos.push(`${diasParciais} dia(s) de militar ficaram com um turno só, porque o outro já estava ocupado. Vale conferir na matriz.`);

  return {
    novas,
    puladas,
    porEquipe,
    // puladas = vagas já ocupadas; removidas (só quando há) = vagas de onde o escalante tirou o militar.
    // Sem remoções, o resumo é igual ao do protótipo.
    resumo: {
      alocacoes: novas.length,
      militares: Object.keys(equipeDe).length,
      puladas: ocupadas,
      ...(removidas ? { removidas } : {}),
      dias: dias.length,
    },
    avisos,
  };
}
