// Importação da aba COTAS (cotas das operações por mês), lida como lerCotas_ do protótipo. A regra nova: a cota
// aponta direto para o serviço (PJES ou diária), e a operação deixa de existir como campo (adendo do design).
import { mesParaData, mesPorExtenso, type ItemPrevia, type OrigemCota, type ProblemaImportacao } from 'contratos';
import { normalizar, servicoDaOperacao } from 'dominio';
import { coluna, lerMes } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'COTAS';
const MAX_QUANTIDADE = 10000;
const MAX_PRIORIDADE = 1000;

const COLUNAS = {
  mes: { rotulo: 'MÊS', obrigatoria: true, ajuda: 'Mês da cota (aaaa-mm ou mm/aaaa).' },
  sb: { rotulo: 'SB', obrigatoria: false, ajuda: 'Seção que recebe a cota. Vazio vale esta seção; a linha de outra seção é pulada.' },
  operacao: { rotulo: 'OPERAÇÃO', obrigatoria: false, ajuda: 'Operação: o nome do serviço, o atributo operação dele ou o nome de uma escala com um serviço só. Use quando não preencher SERVIÇO.' },
  servico: { rotulo: 'SERVIÇO', obrigatoria: false, ajuda: 'Serviço PJES ou diária que paga a cota. Vale mais que a OPERAÇÃO. Preencha SERVIÇO ou OPERAÇÃO.' },
  quantidade: { rotulo: 'QUANTIDADE', obrigatoria: true, ajuda: `Vagas da cota: número inteiro de 1 a ${MAX_QUANTIDADE}. Zero é ignorado, com aviso.` },
  origem: { rotulo: 'ORIGEM', obrigatoria: false, ajuda: 'INTERNA ou EXTERNA. Vazio vale INTERNA.', opcoes: ['INTERNA', 'EXTERNA'] },
  prioridade: { rotulo: 'PRIORIDADE', obrigatoria: false, ajuda: `1 é preenchida primeiro (até ${MAX_PRIORIDADE}). Vazio segue a ordem das linhas do mês.` },
} satisfies Record<string, ColunaModelo>;

type Linha = { mes: string; servicoId: string; servico: string; origem: OrigemCota; quantidade: number; prioridade: number };
type Plano = { novas: Linha[]; alteradas: { id: string; quantidade: number; prioridade: number }[] };

const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());

export const importadorCotas: Importador<Plano> = {
  abas: [ABA],

  modelo: {
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const { rows } = await tx.query<{ nome: string; tipo: string; operacao: string | null }>(
        "select nome, tipo, operacao from servico where unidade_id = $1 and tipo <> 'ordinario' and ativo order by nome",
        [unidadeId],
      );
      return [
        {
          titulo: 'Serviços PJES e diária (coluna SERVIÇO)',
          itens: rows.length
            ? rows.map((s) => `${s.nome} (${s.tipo === 'pjes' ? 'PJES' : 'diária'}${s.operacao ? `, operação ${s.operacao}` : ''})`)
            : ['Ainda não há: cadastre na tela de Turnos (ou importe as abas TURNOS e ESCALAS).'],
        },
      ];
    },
  },

  async planejar(abas, { tx, unidadeId }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<keyof typeof COLUNAS, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const vazio = { previa: { novos, alterados, iguais: 0, problemas, avisos }, plano: { novas: [], alteradas: [] } };
    for (const [falta, rotulo] of [[c.mes, COLUNAS.mes.rotulo], [c.quantidade, COLUNAS.quantidade.rotulo]] as const) {
      if (falta < 0) problemas.push({ aba: ABA, linha: 1, mensagem: `Falta a coluna ${rotulo}.`, solucao: 'Use o modelo desta tela.' });
    }
    if (c.servico < 0 && c.operacao < 0) problemas.push({ aba: ABA, linha: 1, mensagem: 'Falta a coluna SERVIÇO (ou OPERAÇÃO).', solucao: 'Use o modelo desta tela.' });
    if (problemas.length) return vazio;

    const sigla = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!.sigla;
    const servicos = (await tx.query<{ id: string; nome: string; tipo: string; operacao: string | null; ativo: boolean }>('select id, nome, tipo, operacao, ativo from servico where unidade_id = $1', [unidadeId])).rows;
    // as escalas e os serviços delas: a operação do protótipo era o nome da escala
    const escalas = (
      await tx.query<{ nome: string; servicos: string[] }>(
        `select e.nome, array_agg(s.nome order by es.ordem) as servicos
           from escala e join escala_servico es on es.escala_id = e.id join servico s on s.id = es.servico_id
          where e.unidade_id = $1 group by e.id, e.nome`,
        [unidadeId],
      )
    ).rows;

    /** O serviço da linha: SERVIÇO vale mais; sem ele, a OPERAÇÃO casa com o atributo operação, com o nome do serviço ou com uma escala. */
    function acharServico(servicoTexto: string, operacao: string): { servico: (typeof servicos)[number] } | { problema: { mensagem: string; solucao: string } } {
      if (servicoTexto) {
        const s = servicos.find((x) => normalizar(x.nome) === normalizar(servicoTexto));
        return s
          ? { servico: s }
          : { problema: { mensagem: `Serviço ${servicoTexto} não cadastrado`, solucao: 'Cadastre o serviço na tela de Turnos (ou importe as abas TURNOS e ESCALAS) e importe de novo.' } };
      }
      if (!operacao) return { problema: { mensagem: 'Cota sem serviço nem operação', solucao: 'Preencha a coluna SERVIÇO (ou OPERAÇÃO).' } };
      const alvo = normalizar(operacao);
      const candidatos = servicos.filter((x) => normalizar(x.operacao) === alvo || normalizar(x.nome) === alvo);
      if (candidatos.length === 1) return { servico: candidatos[0]! };
      if (candidatos.length > 1) {
        return { problema: { mensagem: `A operação "${operacao}" casa com mais de um serviço (${candidatos.map((x) => x.nome).join(', ')})`, solucao: 'Escreva o nome do serviço na coluna SERVIÇO.' } };
      }
      const escala = escalas.find((e) => normalizar(e.nome) === alvo);
      if (escala) {
        const r = servicoDaOperacao(escala, [{ servico: '' }]);
        if ('problema' in r) return { problema: { mensagem: r.problema, solucao: 'Corrija a linha na planilha e importe de novo.' } };
        return { servico: servicos.find((x) => x.nome === r.servico)! };
      }
      return { problema: { mensagem: `Não achei o serviço da operação "${operacao}"`, solucao: 'Escreva o nome do serviço na coluna SERVIÇO.' } };
    }

    const doSistema = new Map<string, { id: string; quantidade: number; prioridade: number }>();
    const vistas = new Set<string>();
    const ordemNoMes = new Map<string, number>();
    const plano: Plano = { novas: [], alteradas: [] };
    const lidas: Linha[] = [];
    for (const l of aba.linhas) {
      const problema = (mensagem: string, solucao: string) => problemas.push({ aba: ABA, linha: l.linha, mensagem, solucao });
      const servicoTexto = pega(l.celulas, c.servico);
      const operacao = pega(l.celulas, c.operacao);
      const alvo = servicoTexto || operacao || 'cota';

      // a linha de outra seção sai primeiro, para não gerar outros problemas que não são desta seção
      const sb = pega(l.celulas, c.sb);
      if (sb && normalizar(sb) !== normalizar(sigla)) {
        problema(`Cota de outra seção: ${sb}`, `Importe só as linhas da ${sigla}, ou tire esta linha.`);
        continue;
      }
      const mesBruto = pega(l.celulas, c.mes);
      if (!mesBruto) {
        problema(`Mês vazio em ${alvo}`, 'Preencha o mês na coluna MÊS.');
        continue;
      }
      // o mês passa pelo leitor único: o ano 0000 (e anos como 0026) não chegam ao banco
      const mes = lerMes(mesBruto);
      if (!mes) {
        problema(`Mês "${mesBruto}" de ${alvo}`, 'Use aaaa-mm ou mm/aaaa na coluna MÊS.');
        continue;
      }
      const achado = acharServico(servicoTexto, operacao);
      if ('problema' in achado) {
        problema(achado.problema.mensagem, achado.problema.solucao);
        continue;
      }
      const servico = achado.servico;
      if (servico.tipo === 'ordinario') {
        problema(`O serviço ${servico.nome} é ordinário: cota só existe para serviço PJES ou diária`, 'Use um serviço PJES ou diária na coluna SERVIÇO.');
        continue;
      }
      if (!servico.ativo) {
        problema(`Serviço ${servico.nome} está desativado`, 'Reative o serviço na tela de Turnos ou use outro.');
        continue;
      }
      const origemBruta = normalizar(pega(l.celulas, c.origem));
      const origem: OrigemCota | null = origemBruta === '' || origemBruta.startsWith('INT') ? 'interna' : origemBruta.startsWith('EXT') ? 'externa' : null;
      if (!origem) {
        problema(`Origem "${pega(l.celulas, c.origem)}" de ${alvo}`, 'Use INTERNA ou EXTERNA na coluna ORIGEM.');
        continue;
      }
      const qBruta = pega(l.celulas, c.quantidade);
      if (!/^\d+$/.test(qBruta) || Number(qBruta) > MAX_QUANTIDADE) {
        problema(`Quantidade "${qBruta}" de ${alvo}`, `Use um número inteiro de 1 a ${MAX_QUANTIDADE} na coluna QUANTIDADE.`);
        continue;
      }
      const quantidade = Number(qBruta);
      if (quantidade === 0) {
        avisos.push(`${servico.nome} (${origem}) em ${mesPorExtenso(mes)} tem quantidade 0: a linha foi ignorada.`);
        continue;
      }
      const pBruta = pega(l.celulas, c.prioridade);
      if (pBruta && (!/^\d+$/.test(pBruta) || Number(pBruta) < 1 || Number(pBruta) > MAX_PRIORIDADE)) {
        problema(`Prioridade "${pBruta}" de ${alvo}`, `Use um número inteiro de 1 a ${MAX_PRIORIDADE} na coluna PRIORIDADE.`);
        continue;
      }
      const chave = `${mes}|${servico.id}|${origem}`;
      if (vistas.has(chave)) {
        problema(`Cota repetida: ${servico.nome} (${origem}) em ${mesPorExtenso(mes)}`, 'Apague a linha repetida e mantenha só a certa.');
        continue;
      }
      vistas.add(chave);
      // prioridade vazia: a posição da linha entre as aceitas do mês
      const posicao = (ordemNoMes.get(mes) ?? 0) + 1;
      ordemNoMes.set(mes, posicao);
      lidas.push({ mes, servicoId: servico.id, servico: servico.nome, origem, quantidade, prioridade: pBruta ? Number(pBruta) : posicao });
    }

    // contra o que já está no sistema (só os meses da planilha)
    const meses = [...new Set(lidas.map((x) => x.mes))];
    if (meses.length) {
      const { rows } = await tx.query<{ id: string; mes: string; servico_id: string; origem: string; quantidade: number; prioridade: number }>(
        "select id, to_char(mes, 'YYYY-MM') as mes, servico_id, origem, quantidade, prioridade from cota where unidade_id = $1 and mes = any($2::date[])",
        [unidadeId, meses.map(mesParaData)],
      );
      for (const r of rows) doSistema.set(`${r.mes}|${r.servico_id}|${r.origem}`, { id: r.id, quantidade: r.quantidade, prioridade: r.prioridade });
    }
    let iguais = 0;
    for (const x of lidas) {
      const atual = doSistema.get(`${x.mes}|${x.servicoId}|${x.origem}`);
      const quem = `${x.servico} (${x.origem}) em ${mesPorExtenso(x.mes)}`;
      if (!atual) {
        plano.novas.push(x);
        novos.push({ chave: `${x.mes}|${x.servico}|${x.origem}`, descricao: `${quem}: ${x.quantidade}` });
        continue;
      }
      const mudancas: string[] = [];
      if (atual.quantidade !== x.quantidade) mudancas.push(`quantidade: ${atual.quantidade} → ${x.quantidade}`);
      if (atual.prioridade !== x.prioridade) mudancas.push(`prioridade: ${atual.prioridade} → ${x.prioridade}`);
      if (!mudancas.length) {
        iguais++;
        continue;
      }
      plano.alteradas.push({ id: atual.id, quantidade: x.quantidade, prioridade: x.prioridade });
      alterados.push({ chave: `${x.mes}|${x.servico}|${x.origem}`, descricao: quem, mudancas });
    }
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano };
  },

  async aplicar(plano, { tx, unidadeId }) {
    for (const x of plano.novas) {
      await tx.query(
        'insert into cota (mes, unidade_id, servico_id, quantidade, origem, prioridade) values ($1::date, $2, $3, $4, $5, $6)',
        [mesParaData(x.mes), unidadeId, x.servicoId, x.quantidade, x.origem, x.prioridade],
      );
    }
    // só quantidade e prioridade vêm da planilha
    for (const a of plano.alteradas) await tx.query('update cota set quantidade = $2, prioridade = $3 where id = $1', [a.id, a.quantidade, a.prioridade]);
    return plano.novas.length + plano.alteradas.length;
  },
};
