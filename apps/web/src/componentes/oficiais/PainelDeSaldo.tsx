import type { OficialNoSaldo } from 'contratos';
import { useState } from 'react';
import { formatarSaldo } from '@/lib/numeros-do-saldo';
import { cn } from '@/lib/utils';
import { RegistroDoOficial } from './RegistroDoOficial';

const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesCurto = (mes: string) => MES_CURTO[Number(mes.slice(5, 7)) - 1] ?? mes;

/** Dia e noite sem desenho: a amostra é só a cor (a mesma do calendário), e o texto escreve o rótulo. */
const AMOSTRA = { Dia: 'border-linha bg-superficie', Noite: 'border-tinta bg-tinta' } as const;

/** O saldo de cada oficial: o acumulado, a barra de mais ou menos, o saldo mês a mês e os turnos tirados. */
export function PainelDeSaldo({ unidadeId, escalaId, lista }: { unidadeId: string; escalaId?: string; lista: OficialNoSaldo[] }) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const maior = Math.max(1, ...lista.map((o) => Math.abs(o.saldo)));
  const o = lista.find((x) => x.militarId === escolhido) ?? null;
  return (
    <div className="grid gap-4">
      <p className="rounded-lg border border-linha bg-superficie px-3 py-2.5 text-sm">
        O saldo mostra quem trabalhou mais ou menos do que devia, somando todos os meses. <b>Nesta primeira versão ele só aparece:</b> ainda não muda a cota de ninguém.
      </p>
      {lista.length === 0 ? (
        <p className="text-apagado">Ainda não há saldo: ele aparece quando o primeiro mês for encerrado.</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <section className="grid gap-2 rounded-lg border border-linha bg-superficie p-3">
            <h2 className="font-cond text-lg font-semibold">Saldo de cada oficial</h2>
            <div className="overflow-x-auto">
              <table aria-label="Saldo de cada oficial" className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-apagado">
                    <th scope="col" className="px-2 py-1 font-medium">Oficial</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">Saldo</th>
                    <th scope="col" className="px-2 py-1 font-medium"><span className="flex w-28 justify-between"><span>menos</span><span>mais</span></span></th>
                    <th scope="col" className="px-2 py-1 font-medium">Saldo de cada mês</th>
                    <th scope="col" className="px-2 py-1 font-medium">Turnos tirados</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">Dias vermelhos</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((x) => (
                    <tr key={x.militarId} className={cn('border-t border-linha', x.militarId === escolhido && 'bg-accent')}>
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => setEscolhido(x.militarId)} aria-pressed={x.militarId === escolhido} className="text-left font-semibold whitespace-nowrap underline-offset-2 hover:underline">
                          {x.posto} {x.nomeGuerra}
                        </button>{' '}
                        {x.quadro && <span className="text-xs text-apagado">{x.quadro}</span>}
                        {x.lotacao && <small className="block text-apagado">{x.lotacao}</small>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatarSaldo(x.saldo)}</td>
                      <td className="px-2 py-1.5">
                        <span aria-hidden className="relative block h-2 w-28 rounded bg-fundo">
                          <i className="absolute inset-y-0 left-1/2 w-px bg-linha" />
                          <i
                            className={cn('absolute inset-y-0 rounded', x.saldo >= 0 ? 'left-1/2 bg-tinta' : 'right-1/2 bg-apagado')}
                            style={{ width: `${(Math.abs(x.saldo) / maior) * 50}%` }}
                          />
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {x.meses.length === 0 && <span className="text-apagado">—</span>}
                          {x.meses.map((m) => (
                            <span key={m.mes} className="text-xs"><b className="text-apagado">{mesCurto(m.mes)}</b> <span className="tabular-nums">{formatarSaldo(m.valor)}</span></span>
                          ))}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {x.turnos.map((t) => (
                            <span key={t.rotulo} className="inline-flex items-center gap-1.5">
                              <i aria-hidden className={cn('inline-block size-2.5 rounded-sm border', AMOSTRA[t.rotulo])} />
                              {`${t.rotulo} ${t.quantidade}`}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums" aria-label={`${x.vermelhos} dias vermelhos`}>{x.vermelhos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-apagado">Positivo: trabalhou mais do que devia. Negativo: trabalhou menos. O número tem casas decimais porque a parte quebrada da cota nunca se perde.</p>
            <p className="text-xs text-apagado">A soma dos saldos não é zero: cada vez que alguém cobre um colega, o total cresce um turno.</p>
            <p className="text-xs text-apagado">Dias vermelhos: quantos lugares em dia vermelho cada oficial tirou nos meses encerrados. Todos pesam igual e não mudam a cota.</p>
          </section>
          {o ? <RegistroDoOficial key={o.militarId} unidadeId={unidadeId} escalaId={escalaId} oficial={o} /> : <p className="text-sm text-apagado">Clique num oficial para ver o registro dele.</p>}
        </div>
      )}
    </div>
  );
}
