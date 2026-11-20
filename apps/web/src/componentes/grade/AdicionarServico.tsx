import { textoFaixa, type OpcaoDeServico } from 'contratos';
import { useState } from 'react';
import { Selecao } from '@/componentes/Selecao';

const descricao = (o: OpcaoDeServico) => `${textoFaixa(o.inicio, o.fim)} · ${o.guarnicao ?? 'Sem guarnição'}${o.funcao ? ` · ${o.funcao}` : ''}`;
const chaveDe = (o: OpcaoDeServico) => `${o.escalaId}|${o.inicio}|${o.fim}|${o.guarnicaoId ?? ''}|${o.funcaoId ?? ''}`;

/**
 * "Adicionar serviço neste dia": só onde o militar pode entrar, agrupado por escala. Com mais de um serviço possível na faixa, ele escolhe
 * o serviço (o primeiro vem marcado); quem só não marcou o horário no voluntariado aparece com o aviso e pode ser escalado mesmo assim.
 */
export function AdicionarServico({ opcoes, salvando, aoEscolher }: { opcoes: OpcaoDeServico[]; salvando: boolean; aoEscolher: (o: OpcaoDeServico, turnoId: string) => void }) {
  const [turnoDe, setTurnoDe] = useState<Record<string, string>>({});
  if (!opcoes.length) return <p className="text-sm text-apagado">Nenhum serviço disponível para ele neste dia.</p>;
  const escalas = [...new Set(opcoes.map((o) => o.escalaId))];
  return (
    <div className="grid gap-3">
      {escalas.map((id) => {
        const dela = opcoes.filter((o) => o.escalaId === id);
        return (
          <section key={id} className="grid gap-1.5">
            <h3 className="font-cond text-sm font-semibold text-apagado">{dela[0]!.escala}</h3>
            <ul className="grid gap-1.5">
              {dela.map((o) => {
                const chave = chaveDe(o);
                const turnoId = turnoDe[chave] ?? o.servicos[0]!.turnoId;
                const escolhido = o.servicos.find((s) => s.turnoId === turnoId) ?? o.servicos[0]!;
                return (
                  <li key={chave} className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => aoEscolher(o, turnoId)}
                        className="min-w-0 flex-1 rounded-md border border-linha px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
                      >
                        {descricao(o)}
                      </button>
                      {o.servicos.length > 1 && (
                        <Selecao aria-label={`Serviço de ${descricao(o)}`} value={turnoId} onChange={(e) => setTurnoDe((t) => ({ ...t, [chave]: e.target.value }))} className="w-28 shrink-0">
                          {o.servicos.map((s) => <option key={s.turnoId} value={s.turnoId}>{s.nome}</option>)}
                        </Selecao>
                      )}
                    </div>
                    {escolhido.semVoluntariado && <p className="text-xs text-pendencia">Não marcou voluntariado neste horário.</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
