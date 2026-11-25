// A exportação de militares para Excel (6.54): as colunas são as da importação do Pecúlio (mesmos rótulos, mesma ordem), para exportar, corrigir no Excel e importar de volta.
// O teste da API confere esta lista contra a do importador, para as duas não se separarem. Cada coluna pertence a um bloco da ficha (6.11): o que a pessoa não vê sai vazio.
import { z } from 'zod';
import { FiltrosDaBusca } from './consulta.ts';

/** O bloco da ficha a que a coluna pertence. `ficha_completa` é o de quem tem nível de acesso de cadastro na lotação do militar. */
export type BlocoDaExportacao = 'identificacao' | 'contato' | 'situacao' | 'dados_da_escala' | 'comportamento' | 'ficha_completa';

export const COLUNAS_DA_EXPORTACAO: readonly { rotulo: string; bloco: BlocoDaExportacao }[] = [
  { rotulo: 'MATRÍCULA', bloco: 'identificacao' },
  { rotulo: 'POSTO/GRAD', bloco: 'identificacao' },
  { rotulo: 'NOME COMPLETO', bloco: 'identificacao' },
  { rotulo: 'NOME DE GUERRA', bloco: 'identificacao' },
  { rotulo: 'ANTIGUIDADE', bloco: 'ficha_completa' },
  { rotulo: 'SEXO', bloco: 'ficha_completa' },
  { rotulo: 'NASCIMENTO', bloco: 'ficha_completa' },
  { rotulo: 'TELEFONE', bloco: 'contato' },
  { rotulo: 'E-MAIL', bloco: 'contato' },
  { rotulo: 'E-MAIL PESSOAL', bloco: 'contato' },
  { rotulo: 'COMPORTAMENTO', bloco: 'comportamento' },
  { rotulo: 'BOLETIM DO COMPORTAMENTO', bloco: 'comportamento' },
  { rotulo: 'CPF', bloco: 'ficha_completa' },
  { rotulo: 'CEP', bloco: 'ficha_completa' },
  { rotulo: 'LOGRADOURO', bloco: 'ficha_completa' },
  { rotulo: 'NÚMERO', bloco: 'ficha_completa' },
  { rotulo: 'COMPLEMENTO', bloco: 'ficha_completa' },
  { rotulo: 'BAIRRO', bloco: 'ficha_completa' },
  { rotulo: 'CIDADE', bloco: 'ficha_completa' },
  { rotulo: 'UF', bloco: 'ficha_completa' },
  { rotulo: 'LOTAÇÃO', bloco: 'identificacao' },
  { rotulo: 'QUADRO', bloco: 'identificacao' },
  { rotulo: 'SITUAÇÃO', bloco: 'situacao' },
  { rotulo: 'JORNADA', bloco: 'situacao' },
  { rotulo: 'EQUIPE', bloco: 'situacao' },
  { rotulo: 'MOTORISTA', bloco: 'dados_da_escala' },
  { rotulo: 'CNH', bloco: 'dados_da_escala' },
  { rotulo: 'VOLUNTÁRIO JES', bloco: 'dados_da_escala' },
  { rotulo: 'FUNÇÃO', bloco: 'situacao' },
  { rotulo: 'ABONO DE PERMANÊNCIA', bloco: 'ficha_completa' },
];

/** O teto da lista de quem sai: o mesmo da busca sem corte. */
export const LIMITE_DA_EXPORTACAO = 5000;

/**
 * O pedido da exportação: a busca (`filtros`), a seleção (`ids`) ou as duas (sai a união, sem repetir). `colunas` são rótulos de `COLUNAS_DA_EXPORTACAO`; MATRÍCULA sai sempre,
 * mesmo que não venha.
 */
export const PedidoDeExportacao = z.object({
  filtros: FiltrosDaBusca.optional(),
  ids: z.array(z.string().uuid()).max(LIMITE_DA_EXPORTACAO).optional(),
  colunas: z.array(z.enum(COLUNAS_DA_EXPORTACAO.map((c) => c.rotulo) as [string, ...string[]])).min(1),
});
export type PedidoDeExportacao = z.infer<typeof PedidoDeExportacao>;
