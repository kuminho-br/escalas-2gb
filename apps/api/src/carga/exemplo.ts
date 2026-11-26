import { quadroParaOPosto } from '../cadastros/quadros.ts';
import type { Banco, Consulta } from '../banco/banco.ts';
import { SCHEMA_ESPELHO } from '../laboratorio/constantes.ts';

/**
 * Carga FICTÍCIA para desenvolvimento (D7): 53 militares da 1ª SB com matrícula 990xxx-x,
 * nas proporções da sandbox, e os serviços/turnos usados nos esboços.
 * Nunca roda no ambiente de teste, onde estão os dados reais.
 */

const NOMES = [
  'ANDRADE', 'BARRETO', 'CABRAL', 'DANTAS', 'ESTEVES', 'FALCAO', 'GUSMAO', 'HOLANDA', 'IVO', 'JATOBA',
  'KLEBER', 'LACERDA', 'MOURA', 'NOBREGA', 'OTONI', 'PAIVA', 'QUEIROZ', 'RAMALHO', 'SAMPAIO', 'TELES',
  'URBANO', 'VIEIRA', 'XAVIER', 'ZANETTI', 'ARAGAO', 'BEZERRA', 'CORDEIRO', 'DUARTE', 'ELOI', 'FONTES',
  'GALVAO', 'HONORIO', 'ITALO', 'JUCA', 'LEMOS', 'MACEDO', 'NUNES', 'OLIVA', 'PRADO', 'QUINTELA',
  'RESENDE', 'SALES', 'TAVORA', 'UCHOA', 'VALENCA', 'WANDERLEY', 'XIMENES', 'YURI', 'ZACARIAS', 'AMORIM',
  'BRAGA', 'COUTINHO', 'DORNELAS',
];

type Grupo = { jornada: 'adm' | 'pronto'; equipe: string | null; postos: [string, number][] };

const GRUPOS: Grupo[] = [
  { jornada: 'adm', equipe: null, postos: [['ST', 2], ['2º SGT', 3], ['3º SGT', 6], ['CB', 4], ['SD', 2]] },
  { jornada: 'pronto', equipe: 'Alfa', postos: [['2º SGT', 1], ['3º SGT', 3], ['SD', 5]] },
  { jornada: 'pronto', equipe: 'Bravo', postos: [['ST', 1], ['3º SGT', 4], ['CB', 1], ['SD', 4]] },
  { jornada: 'pronto', equipe: 'Charlie', postos: [['ST', 1], ['2º SGT', 1], ['3º SGT', 2], ['CB', 1], ['SD', 4]] },
  { jornada: 'pronto', equipe: 'Delta', postos: [['2º SGT', 1], ['3º SGT', 2], ['CB', 1], ['SD', 4]] },
];
const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'];

const SERVICOS: { nome: string; tipo: string; operacao: string | null; cor: string; turnos: [string, string, string][] }[] = [
  { nome: 'Pronto', tipo: 'ordinario', operacao: null, cor: '#2F8F5B', turnos: [['A', '08:00', '20:00'], ['B', '20:00', '08:00']] },
  { nome: 'Expediente', tipo: 'ordinario', operacao: null, cor: '#8A94A1', turnos: [['A', '08:00', '16:00']] },
  { nome: 'JES', tipo: 'pjes', operacao: null, cor: '#6E56A8', turnos: [['A', '08:00', '20:00'], ['B', '20:00', '08:00']] },
  { nome: 'Saldo', tipo: 'ordinario', operacao: null, cor: '#2B7BB9', turnos: [['A', '08:00', '20:00'], ['B', '20:00', '08:00']] },
  { nome: 'Bioma', tipo: 'diaria', operacao: 'Guardiões do Bioma', cor: '#C08A1E', turnos: [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']] },
  { nome: 'PE Seguro', tipo: 'diaria', operacao: 'PE Seguro', cor: '#3C5F9C', turnos: [['A', '00:00', '08:00'], ['B', '08:00', '16:00'], ['C', '16:00', '00:00']] },
  { nome: 'Defensoria', tipo: 'pjes', operacao: null, cor: '#8C4A7A', turnos: [['A', '07:00', '19:00']] },
];

// quem é motorista (posição na ordem de criação) e com qual CNH; quem é voluntário JES
const MOTORISTAS: Record<number, string[]> = { 3: ['B'], 9: ['B'], 18: ['D'], 22: ['B'], 30: ['D'], 35: ['B'], 41: ['B'], 50: ['D'] };
const VOLUNTARIOS_JES = new Set([2, 5, 11, 17, 20, 26, 33, 39, 44, 52]);

async function id(tx: Consulta, sql: string, params: unknown[]): Promise<string> {
  return (await tx.query<{ id: string }>(sql, params)).rows[0]!.id;
}

/**
 * Por que a carga de exemplo não pode rodar neste ambiente (null = pode).
 * Banco local (PGlite) pode; banco remoto só com AMBIENTE=desenvolvimento declarado,
 * para que esquecer a variável nunca misture militares fictícios com os reais.
 */
export function motivoParaRecusarExemplo(env: { DATABASE_URL?: string; AMBIENTE?: string }, schema = 'public'): string | null {
  // o espelho (6.58) só tem dados de teste: no ambiente de teste a carga fictícia roda nele e nunca no real
  const noEspelho = schema === SCHEMA_ESPELHO;
  if (env.AMBIENTE === 'teste' && !noEspelho) return 'Carga de exemplo recusada no ambiente de teste';
  if (env.DATABASE_URL && env.AMBIENTE !== 'desenvolvimento' && !(noEspelho && env.AMBIENTE === 'teste')) {
    return 'Carga de exemplo recusada: banco remoto sem AMBIENTE=desenvolvimento';
  }
  return null;
}

export async function cargaExemplo(banco: Banco, ambiente: string | undefined, mes: string): Promise<{ militares: number }> {
  if (ambiente === 'teste') throw new Error('Carga de exemplo recusada no ambiente de teste');
  return banco.transacao((tx) => cargaExemploEm(tx, mes));
}

/** O corpo da carga, sobre a transação dada (a do real, ou a do espelho com o `search_path` dele: `cargaDoEspelho`). */
export async function cargaExemploEm(tx: Consulta, mes: string): Promise<{ militares: number }> {
  // já carregada se as matrículas da carga (990001 a 990053) existem
  const ja = await tx.query<{ n: number }>("select count(*)::int as n from militar where matricula between '990001-0' and '990053-9'");
  if (ja.rows[0]!.n > 0) return { militares: ja.rows[0]!.n };

  const secao = await id(tx, "select id from unidade where sigla = '1ª SB'", []);
  const postos = new Map(
    (await tx.query<{ id: string; sigla: string }>('select id, sigla from posto_grad')).rows.map((p) => [p.sigla, p.id]),
  );
  const equipes = new Map<string, string>();
  for (const [i, nome] of EQUIPES.entries()) {
    equipes.set(nome, await id(tx, 'insert into equipe (unidade_id, nome, ordem_ciclo) values ($1, $2, $3) returning id', [secao, nome, i + 1]));
  }

  let n = 0;
  for (const g of GRUPOS) {
    for (const [posto, qtd] of g.postos) {
      for (let k = 0; k < qtd; k++) {
        n++;
        const cnh = MOTORISTAS[n] ?? [];
        const militar = await id(
          tx,
          `insert into militar (matricula, posto_grad_id, nome_guerra, antiguidade, motorista, cnh, voluntario_jes)
           values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [`990${String(n).padStart(3, '0')}-${n % 10}`, postos.get(posto), NOMES[n - 1], k + 1, cnh.length > 0, cnh, VOLUNTARIOS_JES.has(n)],
        );
        // o quadro vale por período: o do posto, quando ele só existe em um
        const quadro = ((await quadroParaOPosto(tx, postos.get(posto)!, undefined, null)) as { quadroId: string | null }).quadroId;
        await tx.query(
          'insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id) values ($1, $2, $3, $4, $5, $6)',
          [militar, secao, g.equipe ? equipes.get(g.equipe) : null, g.jornada, mes, quadro],
        );
      }
    }
  }

  for (const s of SERVICOS) {
    const servico = await id(
      tx,
      'insert into servico (unidade_id, nome, tipo, operacao, cor) values ($1, $2, $3, $4, $5) returning id',
      [secao, s.nome, s.tipo, s.operacao, s.cor],
    );
    for (const [letra, inicio, fim] of s.turnos) {
      await tx.query('insert into turno (servico_id, letra, inicio, fim) values ($1, $2, $3, $4)', [servico, letra, inicio, fim]);
    }
  }
  return { militares: n };
}
