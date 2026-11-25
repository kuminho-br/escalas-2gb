import { useQueries, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, somarMeses } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { alterarColeta, consultaVoluntariadoDoMes } from '@/api/voluntariado';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Checkbox } from '@/componentes/ui/checkbox';
import { mesAtual } from '@/lib/meses';

/**
 * A coleta do voluntariado (7.2): com ela aberta num mês, os militares da seção marcam o próprio voluntariado na área pessoal deles. Um interruptor por mês (o atual e os
 * dois seguintes) que grava na hora; só o gestor liga e desliga, e o escalante vê o estado.
 */
export function ColetaDoVoluntariado({ unidadeId, podeMudar }: { unidadeId: string; podeMudar: boolean }) {
  const queryClient = useQueryClient();
  const meses = [0, 1, 2].map((n) => somarMeses(mesAtual(), n));
  const consultas = useQueries({ queries: meses.map((m) => consultaVoluntariadoDoMes(unidadeId, m)) });
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const mudar = travar(async (mes: string, aberta: boolean) => {
    setErro(null);
    try {
      await alterarColeta(queryClient, unidadeId, mes, aberta);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });
  return (
    <div className="mb-4 rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Com a coleta aberta num mês, os militares desta seção marcam o próprio voluntariado na área pessoal deles. Feche quando acabar o prazo.
        {podeMudar ? '' : ' Só o gestor liga ou desliga a coleta.'}
      </p>
      <ul className="divide-y divide-linha">
        {meses.map((mes, i) => {
          const consulta = consultas[i]!;
          return (
            <li key={mes} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{mesPorExtenso(mes)}</span>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <Checkbox
                  aria-label={`Aceitar o voluntariado de ${mesPorExtenso(mes)}`}
                  checked={consulta.data?.coletaAberta ?? false}
                  disabled={!podeMudar || salvando || !consulta.data}
                  onChange={(ev) => void mudar(mes, ev.target.checked)}
                />
                {consulta.data?.coletaAberta ? 'Aberta' : 'Fechada'}
              </label>
            </li>
          );
        })}
      </ul>
      {erro && <p role="alert" className="border-t border-linha px-4 py-3 text-sm text-alerta">{erro}</p>}
    </div>
  );
}
