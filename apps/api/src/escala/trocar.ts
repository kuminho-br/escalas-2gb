// Trocar uma alocação (Grade geral): pôr um militar livre no lugar, ou trocar de lugar com quem já está escalado no dia (entre dois
// serviços ordinários, é uma permuta). Cada militar passa pelas mesmas regras de "escalar" na vaga do outro, na mesma transação.
import { textoFaixa, type Candidatos, type EscaladoNoDia, type OpcoesDeTroca, type ResultadoDaTroca, type Troca } from 'contratos';
import { compararAntiguidade, type Militar } from 'dominio';
import type { Consulta } from '../banco/banco.ts';
import { Recusa, escalar, remover } from './alocacoes.ts';
import { avaliarCandidatos, JA_ESCALADO } from './elegibilidade.ts';

export class NaoEncontrada extends Error {}

type Aloc = {
  id: string; militar_id: string; escala_id: string; turno_id: string; data: string; guarnicao_id: string | null; funcao_id: string | null;
  tipo: string; unidade_id: string; inicio: string; fim: string;
};

async function carregar(c: Consulta, id: string): Promise<Aloc | null> {
  const { rows } = await c.query<Aloc>(
    `select a.id, a.militar_id, a.escala_id, a.turno_id, to_char(a.data, 'YYYY-MM-DD') as data, a.guarnicao_id, a.funcao_id, s.tipo, s.unidade_id,
            to_char(t.inicio, 'HH24:MI') as inicio, to_char(t.fim, 'HH24:MI') as fim
       from alocacao a join servico s on s.id = a.servico_id join turno t on t.id = a.turno_id where a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Quem pode ocupar a vaga (sem o próprio militar) e quem já está escalado no mesmo dia, com onde está. */
export async function opcoesDeTroca(c: Consulta, alocacaoId: string): Promise<OpcoesDeTroca | null> {
  const a = await carregar(c, alocacaoId);
  if (!a) return null;
  const todos = await avaliarCandidatos(c, { escalaId: a.escala_id, data: a.data, inicio: a.inicio, fim: a.fim, guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id });
  // o próprio militar está "já escalado neste horário": sai das listas e da contagem dos que ficaram de fora
  const livres: Candidatos = {
    aptos: todos.aptos.filter((x) => x.militarId !== a.militar_id),
    semVoluntariado: todos.semVoluntariado.filter((x) => x.militarId !== a.militar_id),
    fora: todos.fora.map((f) => (f.motivo === JA_ESCALADO ? { ...f, quantidade: f.quantidade - 1 } : f)).filter((f) => f.quantidade > 0),
    acumular: [],
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
        where s.unidade_id = $1 and a2.data = $2::date and a2.militar_id <> $3
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
  return { livres, escalados };
}

/** Faz a troca (dentro da transação do chamador: uma recusa desfaz tudo). Devolve as escalas mexidas. */
export async function trocar(tx: Consulta, alocacaoId: string, troca: Troca, usuarioId: string): Promise<ResultadoDaTroca['escalas']> {
  // trava as alocações da troca (em ordem de id, para duas trocas opostas não se prenderem): se outra pessoa mexeu antes, elas já não existem
  const ids = 'militarId' in troca ? [alocacaoId] : [alocacaoId, troca.comAlocacaoId];
  const travadas = (await tx.query('select id from alocacao where id = any($1::uuid[]) order by id for update', [ids])).rows.length;
  if (travadas !== new Set(ids).size) throw new NaoEncontrada();
  const a = await carregar(tx, alocacaoId);
  if (!a) throw new NaoEncontrada();
  const mes = a.data.slice(0, 7);

  if ('militarId' in troca) {
    // substituir: o atual sai (com a marca de remoção, como no "Remover") e o novo entra no turno escolhido, que precisa ser da faixa da vaga
    const turno = (await tx.query<{ inicio: string; fim: string }>("select to_char(inicio, 'HH24:MI') as inicio, to_char(fim, 'HH24:MI') as fim from turno where id = $1", [troca.turnoId])).rows[0];
    if (!turno || turno.inicio !== a.inicio || turno.fim !== a.fim) throw new Recusa('Este turno não é da faixa desta vaga.');
    await remover(tx, a.id, usuarioId);
    await escalar(tx, a.escala_id, { militarId: troca.militarId, data: a.data, turnoId: troca.turnoId, guarnicaoId: a.guarnicao_id, funcaoId: a.funcao_id });
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
      await tx.query<{ id: string; nome: string }>(
        "select m.id, p.sigla || ' ' || m.nome_guerra as nome from militar m join posto_grad p on p.id = m.posto_grad_id where m.id = any($1::uuid[])",
        [[a.militar_id, b.militar_id]],
      )
    ).rows.map((x) => [x.id, x.nome]),
  );
  /** O militar de `quem` entra na vaga de `daVaga` pelas regras de "escalar"; a recusa diz quem não pode ir para a vaga de quem. */
  const entrarNaVaga = async (quem: Aloc, daVaga: Aloc) => {
    try {
      await escalar(tx, daVaga.escala_id, { militarId: quem.militar_id, data: daVaga.data, turnoId: daVaga.turno_id, guarnicaoId: daVaga.guarnicao_id, funcaoId: daVaga.funcao_id });
    } catch (e) {
      if (e instanceof Recusa) throw new Recusa(`${nomes.get(quem.militar_id)} não pode ir para a vaga de ${nomes.get(daVaga.militar_id)}: ${e.message}. Escolha outro serviço para trocar.`);
      throw e;
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
