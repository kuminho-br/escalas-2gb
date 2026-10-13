/**
 * PRÉ-ESCALA — lógica pura (sem SpreadsheetApp), testável fora do Google Sheets.
 * Depende de nucleo.gs (normalizar_, diasDoMes_, grupoDoMilitar_).
 *
 * Regra (validada com outubro/2026: reproduz ~95% do Pronto real):
 *   - quatro equipes em ciclo fixo ALFA -> BRAVO -> CHARLIE -> DELTA -> ALFA;
 *   - a equipe de turno trabalha 1 dia a cada 4, nos turnos A e B do serviço "Pronto";
 *   - a equipe do dia 01 do mês é descoberta pelo mês anterior (votação).
 *
 * A pré-escala é um rascunho: não conhece afastamentos nem trocas. Quem está
 * afastado é removido/ajustado depois, na matriz.
 */

const CICLO_EQUIPES_ = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'];
const PRE_ESCALA_ = { SERVICO: 'Pronto', TURNOS: ['A', 'B'], JANELA_DIAS: 12 };

/** Dias corridos desde 1970 de 'aaaa-mm-dd' (aritmética pura, sem fuso). */
function numeroDoDia_(dia) {
  const p = dia.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
}

function mesVizinho_(mes, delta) {
  const p = mes.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1 + delta, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function mesAnterior_(mes) { return mesVizinho_(mes, -1); }
function proximoMes_(mes) { return mesVizinho_(mes, 1); }

/** Equipe de turno no dia de índice i (0 = dia 01), dado quem trabalha no dia 01. */
function equipeDoDia_(equipeDia1, i) {
  return CICLO_EQUIPES_[(CICLO_EQUIPES_.indexOf(equipeDia1) + i) % 4];
}

/** matrícula -> equipe, só militares do Pronto da seção com equipe do ciclo. */
function mapaEquipes_(militares, secao) {
  const secaoN = secao ? normalizar_(secao) : '';
  const mapa = Object.create(null);
  militares.forEach(function (m) {
    if (secaoN && normalizar_(m.secao) !== secaoN) return;
    const g = grupoDoMilitar_(m);
    if (CICLO_EQUIPES_.indexOf(g) >= 0 && !(m.mat in mapa)) mapa[m.mat] = g;
  });
  return mapa;
}

/**
 * Descobre qual equipe trabalha no dia 01 de op.mes olhando o mês anterior.
 *
 * Em cada um dos últimos JANELA_DIAS dias do mês anterior, a equipe que mais
 * apareceu no Pronto turno A "vota" naquele dia. Cada voto, andando o ciclo até
 * o dia 01, aponta uma equipe inicial; vence a mais votada. Trocas e
 * afastamentos pontuais não derrubam o resultado porque um dia só vota pela
 * maioria e o mês tem vários dias.
 *
 * Retorna { equipe (ou null), votos, diasComVoto, diasNaJanela, concordam,
 *           divergentes: [dias], mesAnterior, motivo }.
 */
function detectarEquipeInicial_(alocs, militares, op) {
  const anterior = mesAnterior_(op.mes);
  const nuloRes = function (motivo, extra) {
    return Object.assign({ equipe: null, votos: {}, diasComVoto: 0, diasNaJanela: 0, concordam: 0, divergentes: [], mesAnterior: anterior, motivo: motivo }, extra || {});
  };
  const equipeDe = mapaEquipes_(militares, op.secao);
  const janela = diasDoMes_(anterior).slice(-PRE_ESCALA_.JANELA_DIAS);
  const naJanela = Object.create(null);
  janela.forEach(function (d) { naJanela[d] = true; });

  const vistos = Object.create(null);
  const porDia = Object.create(null);
  alocs.forEach(function (a) {
    if (a.servico !== PRE_ESCALA_.SERVICO || a.turno !== 'A' || !naJanela[a.dia]) return;
    const eq = equipeDe[a.mat];
    if (!eq) return;
    const k = a.mat + '|' + a.dia;
    if (vistos[k]) return;
    vistos[k] = true;
    if (!porDia[a.dia]) porDia[a.dia] = Object.create(null);
    porDia[a.dia][eq] = (porDia[a.dia][eq] || 0) + 1;
  });

  const primeiro = numeroDoDia_(op.mes + '-01');
  const votos = {};
  const implicada = {};
  let diasComVoto = 0;
  Object.keys(porDia).sort().forEach(function (dia) {
    const c = porDia[dia];
    const ordenadas = Object.keys(c).sort(function (x, y) { return c[y] - c[x]; });
    if (ordenadas.length > 1 && c[ordenadas[0]] === c[ordenadas[1]]) return;   // empate no dia: não vota
    const delta = primeiro - numeroDoDia_(dia);
    const inicial = CICLO_EQUIPES_[(CICLO_EQUIPES_.indexOf(ordenadas[0]) + delta) % 4];
    votos[inicial] = (votos[inicial] || 0) + 1;
    implicada[dia] = inicial;
    diasComVoto++;
  });

  if (diasComVoto === 0) return nuloRes('sem Pronto turno A no mês anterior', { diasNaJanela: janela.length });
  const ordem = Object.keys(votos).sort(function (x, y) { return votos[y] - votos[x]; });
  if (ordem.length > 1 && votos[ordem[0]] === votos[ordem[1]]) {
    return nuloRes('empate entre ' + ordem[0] + ' e ' + ordem[1], { votos: votos, diasComVoto: diasComVoto, diasNaJanela: janela.length });
  }
  const equipe = ordem[0];
  return {
    equipe: equipe,
    votos: votos,
    diasComVoto: diasComVoto,
    diasNaJanela: janela.length,
    concordam: votos[equipe],
    divergentes: Object.keys(implicada).filter(function (d) { return implicada[d] !== equipe; }).sort(),
    mesAnterior: anterior,
    motivo: ''
  };
}

/**
 * Gera as alocações de Pronto do mês.
 *
 * op = { mes, secao, equipeDia1 }
 * Nunca sobrescreve: uma chave (matrícula + dia + turno) já ocupada, por
 * qualquer serviço, é pulada. Por isso rodar duas vezes não duplica nada.
 *
 * Retorna { novas, puladas, porEquipe, resumo, avisos }.
 */
function gerarPreEscala_(alocsExistentes, militares, op) {
  if (CICLO_EQUIPES_.indexOf(op.equipeDia1) < 0) throw new Error('Equipe do dia 01 inválida: "' + op.equipeDia1 + '".');
  const dias = diasDoMes_(op.mes);
  const equipeDe = mapaEquipes_(militares, op.secao);
  const porEquipeMats = {};
  CICLO_EQUIPES_.forEach(function (e) { porEquipeMats[e] = []; });
  Object.keys(equipeDe).forEach(function (mat) { porEquipeMats[equipeDe[mat]].push(mat); });
  CICLO_EQUIPES_.forEach(function (e) { porEquipeMats[e].sort(); });

  const ocupado = Object.create(null);   // chave -> serviço que já está lá
  alocsExistentes.forEach(function (a) {
    if (a.dia.slice(0, 7) === op.mes && !(a.mat + '|' + a.dia + '|' + a.turno in ocupado)) ocupado[a.mat + '|' + a.dia + '|' + a.turno] = a.servico;
  });

  const novas = [], puladas = [];
  const porEquipe = {};
  CICLO_EQUIPES_.forEach(function (e) { porEquipe[e] = { militares: porEquipeMats[e].length, dias: 0, alocacoes: 0 }; });
  let diasParciais = 0;

  dias.forEach(function (dia, i) {
    const eq = equipeDoDia_(op.equipeDia1, i);
    porEquipe[eq].dias++;
    porEquipeMats[eq].forEach(function (mat) {
      let criadas = 0, puladasDoDia = 0;
      PRE_ESCALA_.TURNOS.forEach(function (turno) {
        const chave = mat + '|' + dia + '|' + turno;
        if (chave in ocupado) { puladas.push({ chave: chave, existente: ocupado[chave] }); puladasDoDia++; return; }
        novas.push({ mat: mat, dia: dia, servico: PRE_ESCALA_.SERVICO, turno: turno, funcao: '' });
        porEquipe[eq].alocacoes++;
        criadas++;
      });
      if (criadas > 0 && puladasDoDia > 0) diasParciais++;
    });
  });

  const avisos = [];
  CICLO_EQUIPES_.forEach(function (e) {
    if (porEquipe[e].militares === 0) avisos.push('A equipe ' + e + ' não tem militares do Pronto na seção "' + op.secao + '"; nenhum serviço foi gerado para os dias dela.');
  });
  if (puladas.length) {
    const outro = puladas.filter(function (p) { return p.existente !== PRE_ESCALA_.SERVICO; }).length;
    avisos.push(puladas.length + ' vaga(s) já estavam ocupadas e foram mantidas (' + (puladas.length - outro) + ' já eram Pronto, ' + outro + ' eram de outro serviço).');
  }
  if (diasParciais) avisos.push(diasParciais + ' dia(s) de militar ficaram com um turno só, porque o outro já estava ocupado. Vale conferir na matriz.');

  return {
    novas: novas,
    puladas: puladas,
    porEquipe: porEquipe,
    resumo: { alocacoes: novas.length, militares: Object.keys(equipeDe).length, puladas: puladas.length, dias: dias.length },
    avisos: avisos
  };
}