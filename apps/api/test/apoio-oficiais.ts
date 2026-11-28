import type { Banco } from '../src/banco/banco.ts';
import { inserir } from './banco-teste.ts';

export interface RodadaDeTeste {
  escalaId: string;
  saldo: string;
  saldoA: string;
  saldoB: string;
  jes: string;
  jesA: string;
  jesB: string;
}

/**
 * Uma escala de rodada de cotas (a dos oficiais) na unidade, com os serviços JES e Saldo, cada um com os turnos A (07:00 às 19:00) e B (19:00 às 07:00).
 * Dados fictícios (D7). Desde a 6.72.1, lançar JES confere a cota (sem cota vale cota zero): por padrão o JES ganha uma cota larga em cada mês de 2026-12 a 2028-12
 * (`semCota: true` deixa sem, para o teste que cadastra a sua).
 */
export async function escalaDaRodada(banco: Banco, unidadeId: string, nome = 'Oficiais de operações', opcoes: { semCota?: boolean } = {}): Promise<RodadaDeTeste> {
  const escalaId = await inserir(banco, 'escala', { unidade_id: unidadeId, nome, titulo: `ESCALA ${nome.toUpperCase()}`, militares_doc: 'escalados', dias_doc: 'com_escalados', distribuicao: 'rodada_de_cotas', monta_blocos_voluntariado: false });
  const servico = async (n: string, tipo: 'pjes' | 'ordinario', ordem: number) => {
    const id = await inserir(banco, 'servico', { unidade_id: unidadeId, nome: n, tipo, cor: tipo === 'pjes' ? '#6E56A8' : '#2B7BB9' });
    await banco.query('insert into escala_servico (escala_id, servico_id, ordem) values ($1, $2, $3)', [escalaId, id, ordem]);
    return {
      id,
      a: await inserir(banco, 'turno', { servico_id: id, letra: 'A', inicio: '07:00', fim: '19:00' }),
      b: await inserir(banco, 'turno', { servico_id: id, letra: 'B', inicio: '19:00', fim: '07:00' }),
    };
  };
  const jes = await servico('JES', 'pjes', 1);
  if (!opcoes.semCota) {
    for (let i = 0; i < 25; i++) {
      const mes = `${2026 + Math.floor((11 + i) / 12)}-${String(((11 + i) % 12) + 1).padStart(2, '0')}-01`;
      await inserir(banco, 'cota', { mes, unidade_id: unidadeId, servico_id: jes.id, quantidade: 1000, prioridade: 1 });
    }
  }
  const saldo = await servico('Saldo', 'ordinario', 2);
  return { escalaId, saldo: saldo.id, saldoA: saldo.a, saldoB: saldo.b, jes: jes.id, jesA: jes.a, jesB: jes.b };
}
