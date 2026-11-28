// Trocar uma alocação (Grade geral): pôr um militar livre no lugar, ou trocar de lugar com quem já está escalado no dia (entre dois
// serviços ordinários, é uma permuta). Cada militar passa pelas mesmas regras de "escalar" na vaga do outro, na mesma transação.
import { textoFaixa, type Candidatos, type EscaladoNoDia, type OpcoesDeTroca, type ResultadoDaTroca, type Troca, type VagaDoTurno } from 'contratos';
import { compararAntiguidade, intervaloDoTurno, motivoDaCnh, type Militar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { vinculosDaEscala } from '../cadastros/escalas.ts';
import { versaoNoMes } from '../cadastros/guarnicoes-regras.ts';
import { versoesDasGuarnicoes } from '../cadastros/guarnicoes.ts';
import { Recusa, escalar, mudarDeVaga, ocupantesDaFuncao, remover } from './alocacoes.ts';
import { avaliarCandidatos, DE_EXPEDIENTE, JA_ESCALADO } from './elegibilidade.ts';

export class NaoEncontrada extends Error {}

/** A recusa de uma troca: quem não pode ir para a vaga de quem, o motivo (sem o ponto final dele, para não dobrar) e o que fazer. */
export const fraseDaRecusaDaTroca = (quem: string | undefined, daVaga: string | undefined, motivo: string) =>
  `${quem} não pode ir para a vaga de ${daVaga}: ${motivo.replace(/\.$/, '')}. Escolha outro serviço para trocar.`;

/** "07:00" → "07h", "07:30" → "07h30": a hora como o texto das recusas a diz. */
const horaCurta = (t: string) => `${t.slice(0, 2)}h${t.slice(3) === '00' ? '' : t.slice(3)}`;
/** A recusa da troca por horário (6.70): quem não pode ir já tem outro serviço no horário da vaga. */
export const fraseDaTrocaComConflito = (nome: string, servico: string, inicio: string, fim: string) => `Não dá para trocar: ${nome} já tem ${servico} das ${horaCurta(inicio)} às ${horaCurta(fim)} neste dia.`;
/** A recusa da permuta por horário (6.70): quem não pode ir ficaria com o serviço da vaga e já está em outro no mesmo horário. */
export const fraseDaPermutaComConflito = (nome: string, servicoDaVaga: string, inicio: string, fim: string, servicoQueTem: string) =>
  `Não dá para permutar: ${nome} ficaria com o ${servicoDaVaga} (${horaCurta(inicio)} às ${horaCurta(fim)}) e já está no ${servicoQueTem} deste dia.`;

type Aloc = {
  id: string; militar_id: string; escala_id: string; servico_id: string; turno_id: string; data: string; guarnicao_id: string | null; funcao_id: string | null;
  tipo: string; unidade_id: string; inicio: string; fim: string; servico: string;
};

/** O serviço que o militar já tem e cobre o horário da vaga (o dia da vaga e o dia antes e depois, por causa dos turnos que viram a noite); null se não há. */
async function servicoQueImpede(c: Consulta, militarId: string, vaga: Aloc): Promise<{ servico: string; inicio: string; fim: string } | null> {
  const { rows } = await c.query<{ servico: string; inicio: string; fim: string; dias: number }>(
    `select s.nome as servico, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim, (a.data - $2::date) as dias
       from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id
      where a.militar_id = $1 and a.data between $2::date - 1 and $2::date + 1 order by a.data, t.inicio`,
    [militarId, vaga.data],
  );
  const dela = intervaloDoTurno(vaga.inicio, vaga.fim);
  for (const r of rows) {
    const i = intervaloDoTurno(r.inicio, r.fim);
    const desloca = Number(r.dias) * 1440;
    if (i.inicio + desloca < dela.fim && dela.inicio < i.fim + desloca) return { servico: r.servico, inicio: r.inicio, fim: r.fim };
  }
  return null;
}

async function carregar(c: Consulta, id: string): Promise<Aloc | null> {
  const { rows } = await c.query<Aloc>(
    `select a.id, a.militar_id, a.escala_id, a.servico_id, a.turno_id, to_char(a.data, 'YYYY-MM-DD') as data, a.guarnicao_id, a.funcao_id, s.tipo, s.unidade_id, s.nome as servico,
            to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
       from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id where a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** A troca ainda não resolve choque (a 6.38 é só de escolher o militar da vaga): quem está em choque conta entre os que ficaram de fora, com o motivo. */
function paraFora(emChoque: Candidatos['emChoque']): Candidatos['fora'] {
  const contagem = new Map<string, number>();
  for (const x of emChoque) {
    const motivo = x.servicos[0]!.choque.tipo === 'expediente' ? DE_EXPEDIENTE : 'Choque de horário';
    contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  }
  return [...contagem.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade }));
}

/**
 * As vagas livres do mesmo turno (da mesma escala, do dia e da faixa da alocação) onde o militar cabe: a vaga existe na faixa neste mês, a função tem lugar e ele tem a CNH
 * que ela exige. Fica de fora a vaga em que ele já está. Quem tem acúmulo não muda de função (o acúmulo não vai junto): a lista vem vazia.
 */
async function vagasDoTurno(c: Consulta, a: Aloc): Promise<VagaDoTurno[]> {
  const mes = a.data.slice(0, 7);
  const [vinculo, militar, acumulos] = await Promise.all([
    vinculosDaEscala(c, a.escala_id).then((vs) => vs.find((v) => v.vigencia <= mes)),
    c.query<{ motorista: boolean; cnh: string[] }>('select motorista, cnh from militar where id = $1', [a.militar_id]).then((r) => r.rows[0]!),
    c.query('select 1 from alocacao_acumulo where alocacao_id = $1 limit 1', [a.id]).then((r) => r.rows.length),
  ]);
  if (acumulos > 0 || !vinculo) return [];
  const guarnicaoIds = [...new Set(vinculo.itens.filter((i) => i.inicio === a.inicio && i.fim === a.fim).map((i) => i.guarnicaoId))];
  if (!guarnicaoIds.length) return [];
  const [versoes, nomes] = await Promise.all([
    versoesDasGuarnicoes(c, guarnicaoIds),
    c.query<{ id: string; nome: string }>('select id, nome from guarnicao where id = any($1::uuid[])', [guarnicaoIds]).then((r) => new Map(r.rows.map((x) => [x.id, x.nome] as const))),
  ]);
  const vagas: VagaDoTurno[] = [];
  for (const guarnicaoId of guarnicaoIds) {
    const versao = versaoNoMes(versoes.get(guarnicaoId) ?? [], mes);
    if (!versao?.ativa) continue;
    for (const f of versao.composicao) {
      if (guarnicaoId === a.guarnicao_id && f.funcaoId === a.funcao_id) continue;
      if (f.cnhExigida && motivoDaCnh(militar, f.cnhExigida)) continue;
      if ((await ocupantesDaFuncao(c, a.escala_id, a.data, a, guarnicaoId, f.funcaoId)) >= f.maximo) continue;
      vagas.push({ guarnicaoId, guarnicao: nomes.get(guarnicaoId) ?? '', funcaoId: f.funcaoId, funcao: f.funcao });
    }
  }
  return vagas;
}

/** Quem pode ocupar a vaga (sem o próprio militar), quem já está escalado no mesmo dia, com onde está, e as vagas livres do mesmo turno para ele mudar de função. */
export async function opcoesDeTroca(c: Consulta, alocacaoId: string): Promise<OpcoesDeTroca | null> {
  const a = await carregar(c, alocacaoId);
  if (!a) return null;
  // o expediente lançado pela pré-escala não tem escala (nem vaga): não há por quem trocar nem para onde ir
  if (!a.escala_id) return { livres: { aptos: [], emChoque: [], semVoluntariado: [], fora: [], acumular: [] }, escalados: [], vagas: [] };
  const todos = await avaliarCandidatos(c, { escalaId: a.escala_id, data: a.data, inicio: a.inicio, fim: a.fim, guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id });
  // o próprio militar está "já escalado neste horário": sai das listas e da contagem dos que ficaram de fora
  const livres: Candidatos = {
    aptos: todos.aptos.filter((x) => x.militarId !== a.militar_id),
    semVoluntariado: todos.semVoluntariado.filter((x) => x.militarId !== a.militar_id),
    fora: [...todos.fora.map((f) => (f.motivo === JA_ESCALADO ? { ...f, quantidade: f.quantidade - 1 } : f)).filter((f) => f.quantidade > 0), ...paraFora(todos.emChoque)],
    acumular: [],
    emChoque: [],
  };

  const doDia = (
    await c.query<{
      id: string; militar_id: string; escala: string; servico: string; tipo: string; inicio: string; fim: string; guarnicao: string | null; funcao: string | null;
      nome_guerra: string; matricula: string; posto: string; posto_ordem: number; antiguidade: number | null;
    }>(
      `select a2.id, a2.militar_id, e.nome as escala, s.nome as servico, s.tipo, to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim,
              g.nome as guarnicao, f.nome as funcao, m.nome_guerra, m.matricula, p.sigla as posto, p.ordem as posto_ordem, m.antiguidade
         from alocacao a2 join escala e on e.id = a2.escala_id join servico s on s.id = a2.servico_id join turno t on t.id = a2.turno_id
         join militar m on m.id = a2.militar_id join posto_grad p on p.id = m.posto_grad_id
         left join guarnicao g on g.id = a2.guarnicao_id left join funcao f on f.id = a2.funcao_id
        where s.unidade_id = $1 and a2.data = $2::date and a2.militar_id <> $3 and e.distribuicao = 'pre_escala'
        order by t.inicio, s.nome`,
      [a.unidade_id, a.data, a.militar_id],
    )
  ).rows;
  const porMilitar = new Map<string, { base: (typeof doDia)[number]; alocacoes: EscaladoNoDia['alocacoes'] }>();
  for (const x of doDia) {
    const onde = `${x.escala}, ${textoFaixa(x.inicio, x.fim)}, ${x.funcao ? `${x.funcao} do ${x.guarnicao}` : 'sem guarnição'}`;
    const atual = porMilitar.get(x.militar_id) ?? { base: x, alocacoes: [] };
    atual.alocacoes.push({ alocacaoId: x.id, onde, permuta: a.tipo === 'ordinario' && x.tipo === 'ordinario' });
    porMilitar.set(x.militar_id, atual);
  }
  const escalados: EscaladoNoDia[] = [...porMilitar.values()]
    .sort((x, y) =>
      compararAntiguidade(
        { mat: x.base.matricula, m: { mat: x.base.matricula, posto: x.base.posto, postoOrdem: x.base.posto_ordem, antig: x.base.antiguidade } as Militar },
        { mat: y.base.matricula, m: { mat: y.base.matricula, posto: y.base.posto, postoOrdem: y.base.posto_ordem, antig: y.base.antiguidade } as Militar },
      ),
    )
    .map(({ base, alocacoes }) => ({ militarId: base.militar_id, posto: base.posto, nomeGuerra: base.nome_guerra, matricula: base.matricula, alocacoes }));
  return { livres, escalados, vagas: a.escala_id ? await vagasDoTurno(c, a) : [] };
}

/** Faz a troca (dentro da transação do chamador: uma recusa desfaz tudo). Devolve as escalas mexidas. */
export async function trocar(tx: Consulta, alocacaoId: string, troca: Troca, usuarioId: string): Promise<ResultadoDaTroca['escalas']> {
  // trava as alocações da troca (em ordem de id, para duas trocas opostas não se prenderem): se outra pessoa mexeu antes, elas já não existem
  const ids = 'comAlocacaoId' in troca ? [alocacaoId, troca.comAlocacaoId] : [alocacaoId];
  const travadas = (await tx.query('select id from alocacao where id = any($1::uuid[]) order by id for update', [ids])).rows.length;
  if (travadas !== new Set(ids).size) throw new NaoEncontrada();
  const a = await carregar(tx, alocacaoId);
  if (!a) throw new NaoEncontrada();
  const mes = a.data.slice(0, 7);

  if ('paraVaga' in troca) {
    // mudar de função: a mesma alocação vai para outra vaga do mesmo turno (sem remoção, sem cota, sem choque)
    const { escalaId } = await mudarDeVaga(tx, a.id, troca.paraVaga);
    return [{ escalaId, mes }];
  }

  if ('militarId' in troca) {
    // substituir: o atual sai (com a marca de remoção, como no "Remover") e o novo entra no turno escolhido, que precisa ser da faixa da vaga
    const turno = (await tx.query<{ servico_id: string; inicio: string; fim: string }>("select servico_id, to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where id = $1", [troca.turnoId])).rows[0];
    if (!turno || turno.inicio !== a.inicio || turno.fim !== a.fim) throw new Recusa('Este turno não é da faixa desta vaga.');
    await remover(tx, a.id, usuarioId);
    try {
      await escalar(tx, a.escala_id, { militarId: troca.militarId, data: a.data, turnoId: troca.turnoId, guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id }, { cotaJaContada: turno.servico_id === a.servico_id });
    } catch (e) {
      if (!(e instanceof Recusa)) throw e;
      // o novo não pode ocupar a vaga: a recusa diz quem é (a linha dele fica marcada) e, se é por horário, o serviço que ele já tem
      // (numa corrida entre dois escalantes o banco já abortou a transação: as consultas daqui falham, e a recusa segue com o texto de antes)
      const impede = await servicoQueImpede(tx, troca.militarId, a).catch(() => null);
      const nome = (await tx.query<{ nome_guerra: string }>('select nome_guerra from militar where id = $1', [troca.militarId]).catch(() => null))?.rows[0]?.nome_guerra ?? '';
      throw new Recusa(impede ? fraseDaTrocaComConflito(nome, impede.servico, impede.inicio, impede.fim) : e.message, troca.militarId);
    }
    return [{ escalaId: a.escala_id, mes }];
  }

  const b = await carregar(tx, troca.comAlocacaoId);
  if (!b) throw new NaoEncontrada();
  if (b.id === a.id || b.militar_id === a.militar_id) throw new Recusa('Escolha o serviço de outro militar para trocar.');
  if (b.unidade_id !== a.unidade_id) throw new Recusa('As duas alocações precisam ser da mesma seção.');
  if (b.data !== a.data) throw new Recusa('A troca é entre serviços do mesmo dia.');
  const comAcumulo = (await tx.query('select 1 from alocacao_acumulo where alocacao_id = any($1::uuid[]) limit 1', [[a.id, b.id]])).rows.length;
  if (comAcumulo) throw new Recusa('Tire os acúmulos antes de trocar.');

  // os nomes só servem para a recusa dizer quem não pode ir para onde ("SD FULANO")
  const nomes = new Map(
    (
      await tx.query<{ id: string; nome: string; nome_guerra: string }>(
        "select m.id, p.sigla || ' ' || m.nome_guerra as nome, m.nome_guerra from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])",
        [[a.militar_id, b.militar_id]],
      )
    ).rows.map((x) => [x.id, x] as const),
  );
  /** O militar de `quem` entra na vaga de `daVaga` pelas regras de "escalar"; a recusa diz quem não pode ir para a vaga de quem. */
  const entrarNaVaga = async (quem: Aloc, daVaga: Aloc) => {
    try {
      await escalar(tx, daVaga.escala_id, { militarId: quem.militar_id, data: daVaga.data, turnoId: daVaga.turno_id, guarnicaoId: daVaga.guarnicao_id, funcaoId: daVaga.funcao_id }, { cotaJaContada: true });
    } catch (e) {
      if (!(e instanceof Recusa)) throw e;
      // por horário (o militar já tem outro serviço que cobre o da vaga): o texto nomeia o serviço, o da permuta quando as duas alocações são ordinárias; nas outras recusas, o de antes
      const impede = await servicoQueImpede(tx, quem.militar_id, daVaga).catch(() => null);
      const nome = nomes.get(quem.militar_id)?.nome_guerra ?? '';
      if (impede) {
        const permuta = a.tipo === 'ordinario' && b.tipo === 'ordinario';
        throw new Recusa(permuta ? fraseDaPermutaComConflito(nome, daVaga.servico, daVaga.inicio, daVaga.fim, impede.servico) : fraseDaTrocaComConflito(nome, impede.servico, impede.inicio, impede.fim), quem.militar_id);
      }
      throw new Recusa(fraseDaRecusaDaTroca(nomes.get(quem.militar_id)?.nome, nomes.get(daVaga.militar_id)?.nome, e.message), quem.militar_id);
    }
  };

  // trocar de lugar: sem marca de remoção (ninguém saiu do serviço); cada um entra na vaga do outro pelas regras de "escalar"
  const apagadas = (await tx.query('delete from alocacao where id = any($1::uuid[]) returning id', [[a.id, b.id]])).rows.length;
  if (apagadas !== 2) throw new NaoEncontrada();
  // a ordem não muda: primeiro o militar da alocação clicada (a) vai para a vaga de b, e então o de b para a vaga de a
  await entrarNaVaga(a, b);
  await entrarNaVaga(b, a);
  const escalas = new Map([a, b].map((x) => [x.escala_id, { escalaId: x.escala_id, mes }]));
  return [...escalas.values()];
}
