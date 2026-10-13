/**
 * CHOQUES DE HORÁRIO — lógica pura (sem SpreadsheetApp), testável fora do Sheets.
 * Depende de pre_escala.gs (numeroDoDia_).
 *
 * Um choque é a sobreposição REAL de horários do mesmo militar: cada alocação
 * vira um intervalo (dia + início do turno, com a duração calculada de início a
 * fim, atravessando a meia-noite quando for o caso) e dois intervalos que se
 * cruzam são um choque. Encostar não é choque: Pronto A (08–20) seguido de
 * Pronto B (20–08) é a rotina.
 *
 * A letra do turno NÃO entra na conta: "A" do Bioma (00–08) e "A" do Pronto
 * (08–20) são horários diferentes. Tudo vem da aba TURNOS.
 *
 * Além da sobreposição, há duas regras:
 *   - EMENDA: o militar não pode tirar JES e emendar com o Pronto (o JES termina na
 *     hora em que o Pronto começa). Pronto seguido de JES pode.
 *   - EXPEDIENTE: quem é do Adm e não cumpre a carga mensal está de expediente em todo
 *     dia útil. Essas alocações "implícitas" (implicito: true) entram só na conferência e
 *     nunca são gravadas; um Saldo no mesmo horário ou um Adm de verdade no mesmo dia
 *     dispensa o expediente daquele dia.
 * Limites de trabalho contínuo e de descanso ficam para quando as regras estiverem definidas.
 */

// emenda proibida: o serviço 'de' terminando exatamente quando o serviço 'para' começa
const EMENDA_PROIBIDA_ = { de: 'JES', para: 'PRONTO' };
// serviços que ocupam o lugar do expediente no dia em que se sobrepõem a ele
const SUBSTITUEM_EXPEDIENTE_ = ['SALDO'];

/** 'HH:mm', 'H:mm', 'HH:mm:ss', '8h', '8h30' -> minutos desde 00:00 (24:00 vira 0). null se ilegível. */
function minutosDoDia_(txt) {
  const m = String(txt == null ? '' : txt).trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]), mn = m[2] === undefined ? 0 : Number(m[2]);
  if (h > 24 || mn > 59 || (h === 24 && mn > 0)) return null;
  const total = h * 60 + mn;
  return total === 1440 ? 0 : total;
}

function horasTexto_(minutos) { return String(Math.round(minutos / 6) / 10).replace('.', ','); }

/** minutos desde 00:00 -> '08h', '20h', '00h', '08h30' (formato curto da legenda). */
function horarioCurto_(minutos) {
  const h = Math.floor(minutos / 60) % 24, m = minutos % 60;
  return (h < 10 ? '0' : '') + h + 'h' + (m ? (m < 10 ? '0' : '') + m : '');
}

/**
 * Legenda de turnos: agrupa o porChave de montarHorarios_ por serviço, na ordem em que
 * aparecem na aba TURNOS. cores = { 'Pronto': ['#fundo', '#texto'], ... } (opcional).
 * Retorna [{ servico, fundo, texto, turnos: [{ turno, inicio:'08h', fim:'20h', horas:'12' }] }].
 */
function montarLegenda_(porChave, cores) {
  cores = cores || {};
  const grupos = [], indice = Object.create(null);
  Object.keys(porChave).forEach(function (k) {
    const p = k.split('|'), h = porChave[k];
    if (!(p[0] in indice)) {
      const c = cores[p[0]] || null;
      indice[p[0]] = grupos.length;
      grupos.push({ servico: p[0], fundo: c ? c[0] : '', texto: c ? c[1] : '', turnos: [] });
    }
    grupos[indice[p[0]]].turnos.push({ turno: p[1], inicio: horarioCurto_(h.ini), fim: horarioCurto_(h.fim), horas: horasTexto_(h.dur) });
  });
  return grupos;
}

/**
 * linhas = [{ servico, turno, inicio, fim, duracao }]  (textos, como aparecem na aba TURNOS)
 * Retorna { porChave: { 'Serviço|Turno': { ini, fim, dur } }, avisos: [texto] }.
 * A duração vem do início e do fim; se a coluna DURAÇÃO discordar, avisa.
 */
function montarHorarios_(linhas) {
  const porChave = Object.create(null), avisos = [];
  linhas.forEach(function (l) {
    if (!l.servico || !l.turno) return;
    const nome = l.servico + ' ' + l.turno;
    const ini = minutosDoDia_(l.inicio), fim = minutosDoDia_(l.fim);
    if (ini === null || fim === null) {
      avisos.push('TURNOS: "' + nome + '" tem início ou fim ilegível ("' + l.inicio + '" / "' + l.fim + '"); esse turno fica fora da checagem.');
      return;
    }
    const dur = (fim - ini + 1440) % 1440 || 1440;
    const declarada = parseFloat(String(l.duracao == null ? '' : l.duracao).replace(',', '.'));
    if (isFinite(declarada) && Math.abs(declarada * 60 - dur) > 1) {
      avisos.push('TURNOS: "' + nome + '" vai de ' + l.inicio + ' a ' + l.fim + ' (' + horasTexto_(dur) + ' h), mas a coluna DURAÇÃO diz ' + declarada + ' h. A checagem usa início e fim.');
    }
    porChave[l.servico + '|' + l.turno] = { ini: ini, fim: fim, dur: dur };
  });
  return { porChave: porChave, avisos: avisos };
}

/**
 * Procura sobreposições entre as alocações de cada militar.
 *
 * alocs    : [{ mat, dia, turno, servico }]  (passe TODOS os meses: assim o dia 31 enxerga o dia 01)
 * horarios : o porChave de montarHorarios_
 * op.mes   : (opcional) 'aaaa-mm' — só relata choques em que pelo menos uma das duas alocações é desse mês
 *
 * Retorna { choques: [{ mat, tipo, a, b, minutos }], semHorario: [{ servico, turno, qtd }] }
 *   tipo 'duplicata'   : a mesma alocação repetida
 *   tipo 'sobreposicao': horários que se cruzam
 *   tipo 'expediente'  : horário que cruza o expediente implícito do Adm (a ou b com implicito: true)
 *   tipo 'emenda'      : JES terminando na hora em que o Pronto começa (a = JES, b = Pronto)
 *   a e b = { dia, turno, servico, chave, implicito }
 */
function detectarChoques_(alocs, horarios, op) {
  op = op || {};
  const porMat = Object.create(null), sem = Object.create(null);
  alocs.forEach(function (a) {
    const k = a.servico + '|' + a.turno;
    const h = horarios[k];
    if (!h) { sem[k] = (sem[k] || 0) + 1; return; }
    const ini = numeroDoDia_(a.dia) * 1440 + h.ini;
    if (!porMat[a.mat]) porMat[a.mat] = [];
    porMat[a.mat].push({ dia: a.dia, turno: a.turno, servico: a.servico, chave: a.mat + '|' + a.dia + '|' + a.turno + (a.implicito ? '|expediente' : ''), ini: ini, fim: ini + h.dur, implicito: !!a.implicito });
  });

  // o expediente implícito de um dia some se o militar tem Adm de verdade nesse dia ou um Saldo no mesmo horário
  Object.keys(porMat).forEach(function (mat) {
    const reais = porMat[mat].filter(function (x) { return !x.implicito; });
    porMat[mat] = porMat[mat].filter(function (x) {
      if (!x.implicito) return true;
      return !reais.some(function (r) {
        if (r.dia === x.dia && r.servico === x.servico) return true;
        return SUBSTITUEM_EXPEDIENTE_.indexOf(normalizar_(r.servico)) >= 0 && r.ini < x.fim && x.ini < r.fim;
      });
    });
  });

  const choques = [];
  Object.keys(porMat).sort().forEach(function (mat) {
    const l = porMat[mat].sort(function (x, y) { return x.ini - y.ini || x.fim - y.fim; });
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length && l[j].ini < l[i].fim; j++) {
        const x = l[i], y = l[j];
        if (op.mes && x.dia.slice(0, 7) !== op.mes && y.dia.slice(0, 7) !== op.mes) continue;
        if (x.implicito && y.implicito) continue;
        choques.push({
          mat: mat,
          tipo: (x.implicito || y.implicito) ? 'expediente' : ((x.chave === y.chave && x.servico === y.servico) ? 'duplicata' : 'sobreposicao'),
          a: { dia: x.dia, turno: x.turno, servico: x.servico, chave: x.chave, implicito: x.implicito },
          b: { dia: y.dia, turno: y.turno, servico: y.servico, chave: y.chave, implicito: y.implicito },
          minutos: Math.min(x.fim, y.fim) - y.ini
        });
      }
      // emenda proibida: o fim de uma alocação encosta no início da outra
      for (let j = i + 1; j < l.length && l[j].ini <= l[i].fim; j++) {
        const x = l[i], y = l[j];
        if (y.ini !== x.fim) continue;
        if (normalizar_(x.servico) !== EMENDA_PROIBIDA_.de || normalizar_(y.servico) !== EMENDA_PROIBIDA_.para) continue;
        if (op.mes && x.dia.slice(0, 7) !== op.mes && y.dia.slice(0, 7) !== op.mes) continue;
        choques.push({
          mat: mat,
          tipo: 'emenda',
          a: { dia: x.dia, turno: x.turno, servico: x.servico, chave: x.chave, implicito: false },
          b: { dia: y.dia, turno: y.turno, servico: y.servico, chave: y.chave, implicito: false },
          minutos: 0
        });
      }
    }
  });

  const semHorario = Object.keys(sem).sort().map(function (k) {
    const p = k.split('|');
    return { servico: p[0], turno: p[1], qtd: sem[k] };
  });
  return { choques: choques, semHorario: semHorario };
}

/**
 * Expediente implícito do Adm: uma alocação do serviço Adm em cada dia útil, para cada militar.
 * op: { mats: [matrículas], dias: ['aaaa-mm-dd' (dias úteis)], servico: 'Adm', turno: 'A' }
 * Retorna [{ mat, dia, turno, servico, implicito: true }]. Não grava nada: serve só para checar choques.
 */
function expedienteImplicito_(op) {
  const lista = [];
  op.mats.forEach(function (mat) {
    op.dias.forEach(function (dia) { lista.push({ mat: mat, dia: dia, turno: op.turno, servico: op.servico, implicito: true }); });
  });
  return lista;
}