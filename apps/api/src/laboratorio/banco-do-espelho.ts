// O banco do Laboratório (6.59): uma visão do banco real em que TODA consulta roda como o papel `laboratorio_app` (sem privilégio algum sobre o `public`)
// e com o `search_path` do espelho. É a camada do isolamento que é do próprio banco: se uma rota esquecer o caminho ou escrever `public.` por extenso,
// o banco nega. A consulta avulsa vira uma transação curta, para o `set local` valer só nela; nenhuma conexão volta ao pool com o papel trocado.
import type { Dialect } from 'kysely';
import type { Banco, Consulta } from '../banco/banco.ts';
import { ESPELHO_PAPEL, SCHEMA_ESPELHO } from './constantes.ts';

const COMO_ESPELHO = `set local role ${ESPELHO_PAPEL}; set local search_path to ${SCHEMA_ESPELHO}, public`;

export function bancoDoEspelho(real: Banco): Banco {
  const dentro = <T>(fn: (tx: Consulta) => Promise<T>): Promise<T> =>
    real.transacao(async (tx) => {
      await tx.exec(COMO_ESPELHO);
      return fn(tx);
    });
  const visao: Omit<Banco, 'dialeto'> = {
    query: (sql, params) => dentro((tx) => tx.query(sql, params)),
    exec: (sql) => dentro((tx) => tx.exec(sql)),
    transacao: (fn) => dentro(fn),
    // o banco real é de quem o abriu: o Laboratório não o fecha
    fechar: async () => {},
  };
  // o dialeto (Better Auth) é do real: quem tentar usá-lo no Laboratório recebe o erro, em vez de falar com o `public`
  return Object.defineProperty(visao, 'dialeto', {
    get(): Dialect {
      throw new Error('O Laboratório não usa o dialeto do banco real.');
    },
  }) as Banco;
}
