// Testes de caracterização do motor: pré-escala, distribuição do Adm e parâmetros.
// Essas funções eram validadas só na planilha; aqui elas são chamadas com dados fictícios
// para que `pnpm casos:gravar` grave o que o protótipo responde (casos compartilhados com
// o sistema novo). Uso: node testes/teste_motor.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const fontes = ['nucleo.js', 'choques.js', 'regras_escala.js', 'pre_escala.js', 'parametros.js', 'distribuicao_adm.js', 'distribuicao_cotas.js']
  .map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const L = new Function(fontes + '\nreturn {normalizar_, diasDoMes_, diaDaSemana_, grupoDoMilitar_, antigNum_, minutosDoDia_, exigeVoluntarioJes_, custoDaVaga_,' +
  ' numeroDoDia_, equipeDoDia_, mapaEquipes_, detectarEquipeInicial_, gerarPreEscala_, distribuirAdm_,' +
  ' paramConverter_, paramValidarLinhas_, resolverParametros_, historicoParametro_, diasUteisDoMes_, calcularCargaAdm_, horasDoSaldo_, PARAM_CATALOGO_};')();
const militares = require('./militares_sandbox.json');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 600) : '')); } };
const lanca = (fn, msg) => { try { fn(); return false; } catch (e) { return e.message.indexOf(msg) >= 0; } };

console.log('== núcleo');
{
  ver('domingo = 0', L.diaDaSemana_('2026-11-15') === 0);
  ver('17/11/2026 é terça', L.diaDaSemana_('2026-11-17') === 2);
  ver('29/02/2028 é terça', L.diaDaSemana_('2028-02-29') === 2);
  ver('normalizar tira acento e caixa', L.normalizar_('Eleições') === L.normalizar_('ELEICOES') && L.normalizar_('pe seguro') === 'PESEGURO');
  ver('normalizar de null é vazio', L.normalizar_(null) === '');
  ver('grupo do Adm', L.grupoDoMilitar_({ jornada: 'adm', equipe: 'ALFA' }) === 'ADM');
  ver('grupo do Pronto é a equipe', L.grupoDoMilitar_({ jornada: 'Pronto', equipe: 'charlie' }) === 'CHARLIE');
  ver('Pronto sem equipe válida', L.grupoDoMilitar_({ jornada: 'PRONTO', equipe: 'ECHO' }) === 'SEM EQUIPE' && L.grupoDoMilitar_({}) === 'SEM EQUIPE');
  ver('antiguidade com vírgula', L.antigNum_('12,5') === 12.5 && L.antigNum_(7) === 7);
  ver('antiguidade vazia é null', L.antigNum_('') === null && L.antigNum_(null) === null && L.antigNum_('abc') === null);
  ver('minutos de 08:00', L.minutosDoDia_('08:00') === 480 && L.minutosDoDia_('20h') === 1200 && L.minutosDoDia_('7h30') === 450);
  ver('24:00 é meia-noite', L.minutosDoDia_('24:00') === 0);
  ver('hora inválida é null', L.minutosDoDia_('25:00') === null && L.minutosDoDia_('abc') === null && L.minutosDoDia_('') === null);
  ver('JES exige voluntário; Diária não', L.exigeVoluntarioJes_('JES') === true && L.exigeVoluntarioJes_('Diária') === false);
  ver('custo da vaga é 1', L.custoDaVaga_({ nome: 'Bioma' }, { turno: 'A' }) === 1);
}

console.log('== pré-escala: dias e ciclo');
{
  ver('número do dia de 1970-01-01 é 0', L.numeroDoDia_('1970-01-01') === 0);
  ver('30/11 e 01/12 são dias seguidos', L.numeroDoDia_('2026-12-01') - L.numeroDoDia_('2026-11-30') === 1);
  ver('fevereiro bissexto', L.numeroDoDia_('2028-03-01') - L.numeroDoDia_('2028-02-28') === 2);
  ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA'].forEach(e => {
    const seq = [0, 1, 2, 3, 4, 7, 28, 29, 30].map(i => L.equipeDoDia_(e, i));
    ver('ciclo a partir de ' + e, seq[0] === e && seq[4] === e && seq[6] === e);
  });
  ver('ALFA no dia 01: o dia 12 é DELTA', L.equipeDoDia_('ALFA', 11) === 'DELTA');
}

console.log('== pré-escala: equipes');
{
  const m1 = L.mapaEquipes_(militares, '1ª SB');
  const contagem = e => Object.keys(m1).filter(k => m1[k] === e).length;
  ver('1ª SB: 9 ALFA, 10 BRAVO, 8 CHARLIE, 6 DELTA', contagem('ALFA') === 9 && contagem('BRAVO') === 10 && contagem('CHARLIE') === 8 && contagem('DELTA') === 6, m1);
  ver('seção escrita diferente casa igual', JSON.stringify(L.mapaEquipes_(militares, '1ª sb')) === JSON.stringify(m1));
  const m2 = L.mapaEquipes_(militares, '2ª SB');
  ver('2ª SB só tem CHARLIE e DELTA', Object.keys(m2).length === 2);
  ver('sem seção: todas as seções', Object.keys(L.mapaEquipes_(militares, '')).length === 36);
  ver('sem militares: vazio', Object.keys(L.mapaEquipes_([], '1ª SB')).length === 0);
  ver('matrícula repetida fica com a primeira equipe', L.mapaEquipes_([
    { mat: 'X1', jornada: 'PRONTO', equipe: 'ALFA', secao: 'S' }, { mat: 'X1', jornada: 'PRONTO', equipe: 'BRAVO', secao: 'S' }], 'S').X1 === 'ALFA');
}

console.log('== pré-escala: geração');
{
  const op = { mes: '2026-11', secao: '1ª SB', equipeDia1: 'ALFA' };
  const r = L.gerarPreEscala_([], militares, op);
  ver('30 dias', r.resumo.dias === 30);
  ver('33 militares do Pronto', r.resumo.militares === 33);
  ver('sem nada existente, nada pulado', r.puladas.length === 0 && r.avisos.length === 0);
  ver('ALFA trabalha 8 dias (1, 5, ..., 29)', r.porEquipe.ALFA.dias === 8 && r.porEquipe.BRAVO.dias === 8 && r.porEquipe.CHARLIE.dias === 7);
  ver('dois turnos por militar e dia', r.novas.length === 2 * (9 * 8 + 10 * 8 + 8 * 7 + 6 * 7), r.novas.length);

  const mat = r.novas[0].mat;
  const existentes = [
    { mat, dia: '2026-11-01', servico: 'Pronto', turno: 'A' },
    { mat, dia: '2026-11-05', servico: 'Bioma', turno: 'B' },
    { mat, dia: '2026-10-29', servico: 'Pronto', turno: 'A' },
    { mat: 'OUTRO', dia: '2026-11-01', servico: 'Pronto', turno: 'A' },
  ];
  const r2 = L.gerarPreEscala_(existentes, militares, op);
  ver('pula o que já existe no mês (2 vagas)', r2.puladas.length === 2, r2.puladas);
  ver('avisos de vagas mantidas e de dia parcial', r2.avisos.length === 2, r2.avisos);
  ver('rodar de novo sobre o resultado não gera nada', L.gerarPreEscala_(r.novas, militares, op).novas.length === 0);

  const r3 = L.gerarPreEscala_([], militares, { mes: '2026-11', secao: '2ª SB', equipeDia1: 'CHARLIE' });
  ver('2ª SB: aviso das equipes sem militares', r3.avisos.length === 2, r3.avisos);
  const r4 = L.gerarPreEscala_([], [], op);
  ver('sem militares: nada, com 4 avisos', r4.novas.length === 0 && r4.avisos.length === 4);
  const r5 = L.gerarPreEscala_([], militares, { mes: '2028-02', secao: '1ª SB', equipeDia1: 'DELTA' });
  ver('fevereiro de 2028 tem 29 dias', r5.resumo.dias === 29);
  ver('equipe inválida lança', lanca(() => L.gerarPreEscala_([], militares, { mes: '2026-11', secao: '1ª SB', equipeDia1: 'ECHO' }), 'Equipe do dia 01 inválida'));
}

console.log('== pré-escala: equipe do dia 01');
{
  const outubro = L.gerarPreEscala_([], militares, { mes: '2026-10', secao: '1ª SB', equipeDia1: 'BRAVO' }).novas;
  const d = L.detectarEquipeInicial_(outubro, militares, { mes: '2026-11', secao: '1ª SB' });
  // outubro tem 31 dias: BRAVO no dia 01 -> dia 31 (índice 30) é DELTA -> 01/11 é ALFA
  ver('outubro começando em BRAVO: novembro começa em ALFA', d.equipe === 'ALFA', d);
  ver('todos os 12 dias da janela concordam', d.diasComVoto === 12 && d.concordam === 12 && d.divergentes.length === 0);

  // um dia trocado por outra equipe não derruba o resultado
  const ruido = outubro.filter(a => a.dia !== '2026-10-25').concat(
    Object.keys(L.mapaEquipes_(militares, '1ª SB')).filter(m => militares.find(x => x.mat === m).equipe === 'ALFA')
      .map(mat => ({ mat, dia: '2026-10-25', servico: 'Pronto', turno: 'A' })));
  const d2 = L.detectarEquipeInicial_(ruido, militares, { mes: '2026-11', secao: '1ª SB' });
  ver('um dia divergente não muda a equipe', d2.equipe === 'ALFA' && d2.divergentes.length === 1, d2);

  const vazio = L.detectarEquipeInicial_([], militares, { mes: '2026-11', secao: '1ª SB' });
  ver('sem mês anterior: equipe null, com motivo', vazio.equipe === null && vazio.motivo !== '');

  // empate: metade da janela aponta uma equipe, metade outra
  const metade = outubro.filter(a => a.dia >= '2026-10-26');
  const outra = L.gerarPreEscala_([], militares, { mes: '2026-10', secao: '1ª SB', equipeDia1: 'CHARLIE' }).novas.filter(a => a.dia >= '2026-10-20' && a.dia < '2026-10-26');
  const d3 = L.detectarEquipeInicial_(metade.concat(outra), militares, { mes: '2026-11', secao: '1ª SB' });
  ver('empate: equipe null e motivo de empate', d3.equipe === null && d3.motivo.indexOf('empate') === 0, d3);

  const jan = L.gerarPreEscala_([], militares, { mes: '2026-12', secao: '1ª SB', equipeDia1: 'ALFA' }).novas;
  ver('virada do ano: dezembro -> janeiro', L.detectarEquipeInicial_(jan, militares, { mes: '2027-01', secao: '1ª SB' }).equipe === 'DELTA');
}

console.log('== parâmetros');
{
  const def = chave => L.PARAM_CATALOGO_.find(d => d.chave === chave);
  const inteiro = def('CARGA_MENSAL_HORAS'), simnao = def('ADM_CUMPRE_CARGA'), texto = def('SECAO_PADRAO');
  const decimal = { chave: 'X', tipo: 'decimal', min: 0, max: 10 };
  ver('inteiro', L.paramConverter_(inteiro, '160').valor === 160 && L.paramConverter_(inteiro, 160).ok);
  ver('inteiro com ,0', L.paramConverter_(inteiro, '160,0').valor === 160);
  ver('inteiro com fração é erro', !L.paramConverter_(inteiro, '1,5').ok);
  ver('inteiro abaixo do mínimo e acima do máximo', !L.paramConverter_(inteiro, '0').ok && !L.paramConverter_(inteiro, '800').ok);
  ver('vazio é erro', !L.paramConverter_(inteiro, '').ok && !L.paramConverter_(inteiro, null).ok && !L.paramConverter_(texto, '   ').ok);
  ver('decimal com vírgula', L.paramConverter_(decimal, '2,5').valor === 2.5 && !L.paramConverter_(decimal, 'abc').ok && !L.paramConverter_(decimal, '11').ok);
  ver('sim/não', L.paramConverter_(simnao, 'Sim').valor === true && L.paramConverter_(simnao, 'não').valor === false && L.paramConverter_(simnao, 'x').valor === true);
  ver('sim/não inválido', !L.paramConverter_(simnao, 'talvez').ok);
  ver('texto', L.paramConverter_(texto, ' 2ª SB ').valor === '2ª SB' && !L.paramConverter_(texto, 'a'.repeat(121)).ok);

  const linhas = [
    { linha: 2, chave: 'CARGA_MENSAL_HORAS', valor: '160', vigencia: '' },
    { linha: 3, chave: 'CARGA_MENSAL_HORAS', valor: '150', vigencia: '2026-11' },
    { linha: 4, chave: 'CARGA_MENSAL_HORAS', valor: '140', vigencia: '01/2027' },
    { linha: 5, chave: 'carga mensal horas', valor: '145', vigencia: '2026-11' },
    { linha: 6, chave: 'ADM_CUMPRE_CARGA', valor: 'sim', vigencia: '2026-12' },
    { linha: 7, chave: 'NAO_EXISTE', valor: '1', vigencia: '' },
    { linha: 8, chave: 'SALDOS_ADM_POR_MILITAR', valor: '6', vigencia: '13/2026' },
    { linha: 9, chave: 'SALDOS_ADM_POR_MILITAR', valor: 'seis', vigencia: '' },
    { linha: 10, chave: 'SECAO_PADRAO', valor: '2ª SB', vigencia: '2026-01' },
  ];
  const v = L.paramValidarLinhas_(linhas);
  ver('3 linhas ruins viram aviso', v.avisos.length === 3 && v.boas.length === 6, v.avisos);
  const out = L.resolverParametros_(linhas, '2026-10');
  ver('outubro: 160 (desde sempre)', out.valores.CARGA_MENSAL_HORAS === 160 && out.origem.CARGA_MENSAL_HORAS.linha === 2);
  const nov = L.resolverParametros_(linhas, '2026-11');
  ver('novembro: mesma vigência, vale a linha de baixo (145)', nov.valores.CARGA_MENSAL_HORAS === 145, nov.valores);
  ver('novembro: Adm não cumpre carga (padrão)', nov.valores.ADM_CUMPRE_CARGA === false && nov.origem.ADM_CUMPRE_CARGA.padrao === true);
  const jan = L.resolverParametros_(linhas, '2027-01');
  ver('janeiro de 2027: 140, Adm cumpre carga', jan.valores.CARGA_MENSAL_HORAS === 140 && jan.valores.ADM_CUMPRE_CARGA === true);
  ver('sem linhas: padrões', L.resolverParametros_([], '2026-11').valores.SALDOS_ADM_POR_MILITAR === 6);
  ver('mês inválido lança', lanca(() => L.resolverParametros_(linhas, '2026-13'), 'Mês inválido') && lanca(() => L.resolverParametros_([], '11/2026'), 'Mês inválido'));
  ver('histórico da carga em ordem de vigência', L.historicoParametro_(linhas, 'CARGA_MENSAL_HORAS').map(h => h.valor).join(',') === '160,150,145,140');
  ver('histórico de chave sem linhas', L.historicoParametro_(linhas, 'LINHAS_POR_MILITAR').length === 0);

  ver('dias úteis de novembro/2026', L.diasUteisDoMes_('2026-11').length === 21);
  const fer = { '2026-11-02': true, '2026-11-15': true, '2026-11-20': true };
  ver('menos os feriados em dia útil', L.diasUteisDoMes_('2026-11', fer).length === 19);
  ver('fevereiro de 2028', L.diasUteisDoMes_('2028-02').length === 21);

  const c1 = L.calcularCargaAdm_({ carga: 160, saldos: 6, horasSaldo: 12, horasTurnoAdm: 8, diasUteis: 19 });
  ver('160h - 6 saldos de 12h = 88h = 11 turnos', c1.horasNormais === 88 && c1.turnosAdm === 11 && c1.cabe);
  ver('arredonda para cima', L.calcularCargaAdm_({ carga: 160, saldos: 5, horasSaldo: 12, horasTurnoAdm: 8, diasUteis: 19 }).turnosAdm === 13);
  ver('saldos demais', L.calcularCargaAdm_({ carga: 60, saldos: 6, horasSaldo: 12, horasTurnoAdm: 8, diasUteis: 19 }).saldosDemais === true);
  ver('não cabe nos dias úteis', L.calcularCargaAdm_({ carga: 200, saldos: 0, horasSaldo: 12, horasTurnoAdm: 8, diasUteis: 19 }).cabe === false);
  ver('turno de 0h: 0 turnos', L.calcularCargaAdm_({ carga: 160, saldos: 0, horasSaldo: 12, horasTurnoAdm: 0, diasUteis: 19 }).turnosAdm === 0);

  ver('horas do saldo pelo catálogo de turnos', L.horasDoSaldo_({ 'Pronto|A': { dur: 720 }, 'saldo|B': { dur: 480 }, 'Saldo|A': { dur: 600 } }).horas === 10);
  ver('sem saldo no catálogo: 12h', JSON.stringify(L.horasDoSaldo_({ 'Pronto|A': { dur: 720 } })) === '{"horas":12,"achou":false}');
}

console.log('== distribuição do Adm');
{
  const fer = { '2026-11-02': true, '2026-11-20': true };
  const dias = L.diasUteisDoMes_('2026-11', fer);
  const adm = militares.filter(m => m.jornada === 'ADM' && m.secao === '1ª SB').map(m => ({ mat: m.mat, ocupados: {}, jaTem: [] }));
  const r = L.distribuirAdm_({ dias, turnos: 11, militares: adm });
  ver('14 militares x 11 turnos', r.novas.length === 14 * 11, r.novas.length);
  const cob = Object.keys(r.cobertura).map(d => r.cobertura[d]);
  ver('cobertura equilibrada (diferença de no máximo 1)', Math.max.apply(null, cob) - Math.min.apply(null, cob) <= 1, r.cobertura);
  ver('só dias úteis', r.novas.every(n => dias.indexOf(n.dia) >= 0));
  ver('determinístico', JSON.stringify(L.distribuirAdm_({ dias, turnos: 11, militares: adm })) === JSON.stringify(r));

  const comRestricoes = adm.slice(0, 5).map((m, i) => i === 0 ? { mat: m.mat, ocupados: { '2026-11-03': true, '2026-11-04': true }, jaTem: ['2026-11-05', '2026-11-06'] }
    : i === 1 ? { mat: m.mat, ocupados: {}, jaTem: ['2026-10-30', '2026-11-30'] } : m);
  const r2 = L.distribuirAdm_({ dias, turnos: 6, militares: comRestricoes });
  ver('ocupados não são escolhidos', !r2.novas.some(n => n.mat === adm[0].mat && (n.dia === '2026-11-03' || n.dia === '2026-11-04')));
  ver('o que já tem conta na carga', r2.porMilitar[adm[0].mat].ja === 2 && r2.porMilitar[adm[0].mat].novas === 4);
  ver('dia de fora do mês conta como já tem', r2.porMilitar[adm[1].mat].ja === 2 && r2.porMilitar[adm[1].mat].total === 6);

  const poucos = L.distribuirAdm_({ dias: dias.slice(0, 3), turnos: 5, militares: [{ mat: 'A1', ocupados: { [dias[0]]: true } }] });
  ver('o que não cabe vira faltou', poucos.porMilitar.A1.faltou === 3 && poucos.porMilitar.A1.novas === 2, poucos.porMilitar);
  ver('sem militares: nada', L.distribuirAdm_({ dias, turnos: 11, militares: [] }).novas.length === 0);
  ver('sem dias: nada', L.distribuirAdm_({ dias: [], turnos: 11, militares: adm.slice(0, 2) }).novas.length === 0);
  ver('turnos 0: nada', L.distribuirAdm_({ dias, turnos: 0, militares: adm.slice(0, 2) }).novas.length === 0);
}

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
