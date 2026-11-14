// Testes da P18 (choque JES × expediente, diárias sem filtro de voluntário JES, escala com N serviços).
// Uso: node testes/teste_p18.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(dir, f), 'utf8');

let ok = 0, falhas = 0;
const ver = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { falhas++; console.log('  FALHA ' + n + (x !== undefined ? ' -> ' + JSON.stringify(x).slice(0, 600) : '')); } };

const fontes = ['abertura_automatica.js', 'distribuicao_cotas.js', 'regras_escala.js', 'choques.js', 'sincronia.js', 'nucleo.js', 'pre_escala.js', 'guarnicao.js', 'cadastro_guarnicoes.js'].map(ler).join('\n');
const L = new Function(fontes + '\nreturn {detectarChoques_, montarHorarios_, calcularSincronizacao_, expedienteImplicito_, expedienteChocaCom_, distribuirCotas_};')();

// a aba TURNOS da sandbox (o que importa: horários e TIPO DE SERVIÇO)
const hor = L.montarHorarios_([
  { servico: 'Pronto', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'Pronto', turno: 'B', inicio: '20:00', fim: '08:00' },
  { servico: 'Adm', turno: 'A', inicio: '08:00', fim: '16:00' },
  { servico: 'JES', turno: 'A', inicio: '08:00', fim: '20:00' }, { servico: 'JES', turno: 'B', inicio: '20:00', fim: '08:00' },
  { servico: 'Defensoria', turno: 'A', inicio: '07:00', fim: '19:00' },
  { servico: 'Bioma', turno: 'A', inicio: '06:00', fim: '18:00' }, { servico: 'PE Seguro', turno: 'A', inicio: '08:00', fim: '20:00' },
  { servico: 'Saldo', turno: 'A', inicio: '08:00', fim: '20:00' }
]).porChave;
const TIPOS = { Pronto: 'Ordinário', Adm: 'Ordinário', Saldo: 'Ordinário', JES: 'PJES', Defensoria: 'PJES', CPRH: 'PJES', Bioma: 'Diária', 'PE Seguro': 'Diária', 'Eleições': 'Diária' };

console.log('== P18 item 1 (B67; RN-25, RN-17) JES não choca com o expediente invisível do Adm; diária choca');
{
  // ST BM ADELSON BARROS (Adm, RN-17 desligada) · 06/10/2026 (terça, dia útil)
  const exp = L.expedienteImplicito_({ mats: ['707170-1'], dias: ['2026-10-06'], servico: 'Adm', turno: 'A' });
  const com = (servico, turno) => L.detectarChoques_(exp.concat([{ mat: '707170-1', dia: '2026-10-06', servico, turno }]), hor, { mes: '2026-10', tipos: TIPOS }).choques;

  ver('o caso do relato: JES 08–20 no dia de expediente não é choque', com('JES', 'A').length === 0, com('JES', 'A'));
  ver('Bioma (Diária) no mesmo dia continua chocando com o expediente', com('Bioma', 'A').length === 1 && com('Bioma', 'A')[0].tipo === 'expediente', com('Bioma', 'A'));
  ver('PE Seguro (Diária) também', com('PE Seguro', 'A').length === 1);
  ver('Defensoria (PJES) não choca com o expediente', com('Defensoria', 'A').length === 0);
  ver('a escrita do tipo não importa ("DIARIA", "diária")', L.expedienteChocaCom_({ implicito: true }, { servico: 'X' }, { X: 'DIARIA' }) && L.expedienteChocaCom_({ servico: 'X' }, { implicito: true }, { X: 'diária' }));
  ver('serviço sem tipo cadastrado não choca com o expediente', !L.expedienteChocaCom_({ implicito: true }, { servico: 'Novo' }, TIPOS));

  // os choques reais continuam valendo
  const doisReais = L.detectarChoques_([{ mat: 'm', dia: '2026-10-06', servico: 'JES', turno: 'A' }, { mat: 'm', dia: '2026-10-06', servico: 'Pronto', turno: 'A' }], hor, { tipos: TIPOS }).choques;
  ver('JES × Pronto no mesmo horário continua sendo choque (só o expediente mudou)', doisReais.length === 1 && doisReais[0].tipo === 'sobreposicao', doisReais);
  const emenda = L.detectarChoques_([{ mat: 'm', dia: '2026-10-06', servico: 'JES', turno: 'B' }, { mat: 'm', dia: '2026-10-07', servico: 'Pronto', turno: 'A' }], hor, { tipos: TIPOS }).choques;
  ver('emenda JES → Pronto continua proibida', emenda.length === 1 && emenda[0].tipo === 'emenda', emenda);
  ver('sem a lista de tipos, o comportamento antigo fica (nada some em silêncio)', L.detectarChoques_(exp.concat([{ mat: '707170-1', dia: '2026-10-06', servico: 'JES', turno: 'A' }]), hor, {}).choques.length === 1);

  // de ponta a ponta: salvar no Mostrar Grade Geral (o caminho do relato)
  const todas = exp.slice();
  const salvar = (servico, turno) => L.calcularSincronizacao_([], [{ mat: '707170-1', dia: '2026-10-06', servico, turno }], [], {},
    { horarios: hor, todas, regras: { adm: { '707170-1': true }, tipos: TIPOS, voluntariosJes: { '707170-1': true } } });
  const rJes = salvar('JES', 'A');
  ver('salvar o JES do relato: grava, sem "choca com o expediente do Adm"', rJes.inserir.length === 1 && rJes.choques.length === 0, { inserir: rJes.inserir, choques: rJes.choques, regras: rJes.regras });
  const rBioma = salvar('Bioma', 'A');
  ver('salvar um Bioma no mesmo dia: bloqueado por choque com o expediente', rBioma.inserir.length === 0 && rBioma.choques.length === 1 && rBioma.choques[0].com[0].implicito === true, rBioma.choques);
}

console.log('== P18 item 2 (B50; RN-04, RN-46, RN-39) diária não exige VOLUNTÁRIO JES; JES continua exigindo');
{
  const dias = ['2026-11-03', '2026-11-04'];
  const roda = (servico, vol, voluntariosJes, extra) => L.distribuirCotas_(Object.assign({
    mes: '2026-11',
    operacoes: [{ nome: servico, servico, prioridade: 1, dias, turnos: [{ turno: 'A', vagas: 1 }] }],
    cotas: [{ id: 'C1', operacao: servico, quantidade: 10, origem: 'interna' }],
    militares: [{ mat: 'NAOVOL' }, { mat: 'VOL' }], voluntariado: vol, alocacoes: [], expediente: [],
    horarios: hor, tipos: TIPOS, voluntariosJes
  }, extra || {}));
  const so = mat => dias.map(dia => ({ mat, dia, turno: 'A', servico: 'todos' }));
  const vjes = { VOL: true };            // NAOVOL tem VOLUNTÁRIO JES = não

  let r = roda('PE Seguro', so('NAOVOL'), vjes);
  ver('o aceite: militar não voluntário JES que preencheu o formulário entra na diária (PE Seguro)',
    r.novas.length === 2 && r.novas.every(n => n.mat === 'NAOVOL' && n.fase === 'voluntaria'), r.novas);
  r = roda('Bioma', so('NAOVOL'), vjes);
  ver('o mesmo vale para o Bioma', r.novas.length === 2 && r.novas.every(n => n.mat === 'NAOVOL'), r.novas);

  r = roda('JES', so('NAOVOL'), vjes);
  ver('JES: o não voluntário que se ofereceu NÃO entra', r.novas.length === 0, r.novas);
  ver('e a vaga vazia diz o motivo (RN-46)', r.vazias.length === 2 && r.vazias.every(v => /VOLUNTÁRIO JES = sim \(RN-46\)/.test(v.motivo)), r.vazias);
  r = roda('JES', so('NAOVOL').concat(so('VOL')), vjes);
  ver('JES: entre os dois, só o voluntário entra', r.novas.length === 2 && r.novas.every(n => n.mat === 'VOL'), r.novas);
  // fase compulsória (RN-41): quem preencheu o formulário, mesmo sem se oferecer naquele dia
  r = roda('JES', [{ mat: 'NAOVOL', dia: '2026-11-20', turno: 'A', servico: 'todos' }], vjes);
  ver('JES compulsório também não sorteia o não voluntário', r.novas.length === 0, r.novas);
  r = roda('PE Seguro', [{ mat: 'NAOVOL', dia: '2026-11-20', turno: 'A', servico: 'todos' }], vjes);
  ver('diária compulsória aceita o não voluntário JES que preencheu o formulário (RN-41)', r.novas.length === 2 && r.novas.every(n => n.fase === 'compulsoria'), r.novas);
  r = roda('JES', so('NAOVOL'), null);
  ver('sem a coluna VOLUNTÁRIO JES em MILITARES, ninguém é barrado (como antes)', r.novas.length === 2, r.novas);

  // o painel não corta mais as linhas antes da distribuição
  const painel = ler('distribuicao_cotas_painel.js');
  ver('o painel passa TODAS as linhas do VOLUNTARIADO e a lista de voluntários JES para a distribuição',
    /voluntariado: vol\.linhas/.test(painel) && /voluntariosJes: vjes/.test(painel) && !/voluntariado: sep\.linhas/.test(painel));
}

// -- fim das seções
console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
