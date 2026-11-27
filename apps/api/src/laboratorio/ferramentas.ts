// As ferramentas em teste (6.60): vivem no banco REAL. A lista é lida e o cadastro é gravado pelas rotas do real (`/api/laboratorio/ferramentas`).
import type { FerramentaDeTeste, MudarFerramenta, NovaFerramenta } from 'contratos';
import type { Consulta } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';

type Linha = { id: string; nome: string; o_que_testar: string; caminho: string | null; situacao: FerramentaDeTeste['situacao']; inicio: string; fim: string | null };

const COLUNAS = `id, nome, o_que_testar, caminho, situacao, to_char(inicio, 'YYYY-MM-DD') as inicio, to_char(fim, 'YYYY-MM-DD') as fim`;
const paraFerramenta = (l: Linha): FerramentaDeTeste => ({ id: l.id, nome: l.nome, oQueTestar: l.o_que_testar, caminho: l.caminho, situacao: l.situacao, inicio: l.inicio, fim: l.fim });

/** Todas as ferramentas: as em teste primeiro, depois as que acabaram (encerradas e as que viraram módulo), as mais recentes antes. */
export async function listarFerramentas(c: Consulta): Promise<FerramentaDeTeste[]> {
  const { rows } = await c.query<Linha>(`select ${COLUNAS} from ferramenta_teste order by (situacao <> 'em_teste'), inicio desc, nome`);
  return rows.map(paraFerramenta);
}

export async function umaFerramenta(c: Consulta, id: string): Promise<FerramentaDeTeste | null> {
  const { rows } = await c.query<Linha>(`select ${COLUNAS} from ferramenta_teste where id = $1`, [id]);
  return rows[0] ? paraFerramenta(rows[0]) : null;
}

export async function criarFerramenta(c: Consulta, d: NovaFerramenta): Promise<FerramentaDeTeste> {
  const { rows } = await c.query<Linha>(
    `insert into ferramenta_teste (nome, o_que_testar, caminho, inicio) values ($1, $2, $3, $4::date) returning ${COLUNAS}`,
    [d.nome, d.oQueTestar, d.caminho ?? null, hojeRecife()],
  );
  return paraFerramenta(rows[0]!);
}

/** Muda o que veio. Sair de "em teste" põe a data do fim; voltar a "em teste" a tira. `null` se a ferramenta não existe. */
export async function mudarFerramenta(c: Consulta, id: string, d: MudarFerramenta): Promise<FerramentaDeTeste | null> {
  const atual = await umaFerramenta(c, id);
  if (!atual) return null;
  const situacao = d.situacao ?? atual.situacao;
  const fim = situacao === 'em_teste' ? null : d.situacao && d.situacao !== atual.situacao ? hojeRecife() : atual.fim ?? hojeRecife();
  const { rows } = await c.query<Linha>(
    `update ferramenta_teste set nome = $2, o_que_testar = $3, caminho = $4, situacao = $5, fim = $6::date where id = $1 returning ${COLUNAS}`,
    [id, d.nome ?? atual.nome, d.oQueTestar ?? atual.oQueTestar, d.caminho === undefined ? atual.caminho : d.caminho, situacao, fim],
  );
  return paraFerramenta(rows[0]!);
}
