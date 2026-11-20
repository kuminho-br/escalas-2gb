import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Candidato, EscaladoNoDia } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaTrocas, trocar } from '@/api/escala-do-mes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { frasesDeFora } from '@/lib/escala';

type Escolha =
  | { tipo: 'livre'; livre: Candidato; turnoId: string }
  | { tipo: 'escalado'; escalado: EscaladoNoDia; alocacaoId: string; onde: string; permuta: boolean };

/**
 * "Trocar" um serviço: por um militar livre ou de lugar com quem já está escalado no dia (o diálogo mostra onde ele está antes de confirmar;
 * entre dois serviços ordinários, é uma permuta). A recusa fica no diálogo.
 */
export function TrocarServico({ alocacaoId, nomeAtual, aoFechar }: { alocacaoId: string; nomeAtual: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const opcoes = useQuery(consultaTrocas(alocacaoId));
  const [turnoDe, setTurnoDe] = useState<Record<string, string>>({});
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

  const confirmar = travar(async () => {
    if (!escolha) return;
    setErro(null);
    try {
      await trocar(queryClient, alocacaoId, escolha.tipo === 'livre' ? { militarId: escolha.livre.militarId, turnoId: escolha.turnoId } : { comAlocacaoId: escolha.alocacaoId });
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const livres = [...(opcoes.data?.livres.aptos ?? []), ...(opcoes.data?.livres.semVoluntariado ?? [])];
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trocar</DialogTitle>
          <DialogDescription>Ponha outro militar no lugar de {nomeAtual} ou troque de lugar com quem já está escalado neste dia.</DialogDescription>
        </DialogHeader>

        {escolha ? (
          <div className="grid gap-3">
            {escolha.tipo === 'livre' ? (
              <p className="font-medium">Trocar {nomeAtual} por {escolha.livre.nomeGuerra}?</p>
            ) : (
              <>
                <p className="font-medium">{escolha.escalado.nomeGuerra} está no {escolha.onde}.</p>
                {escolha.permuta && <span className="w-fit rounded border border-linha px-1.5 text-xs font-medium">Permuta</span>}
                <p className="text-sm text-apagado">
                  {escolha.permuta ? `${nomeAtual} e ${escolha.escalado.nomeGuerra} trocam de lugar nos dois serviços.` : `${nomeAtual} e ${escolha.escalado.nomeGuerra} trocam de serviço.`}
                </p>
              </>
            )}
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={salvando} onClick={() => void confirmar()}>
                {escolha.tipo === 'livre' ? 'Trocar' : escolha.permuta ? 'Fazer a permuta' : 'Trocar os dois'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setErro(null); setEscolha(null); }}>Voltar</Button>
            </div>
          </div>
        ) : (
          <>
            {opcoes.isPending && <p className="text-apagado">Carregando…</p>}
            {opcoes.error && <p role="alert" className="text-alerta">{mensagemDe(opcoes.error)}</p>}
            {opcoes.data && (
              <>
                {livres.length === 0 ? (
                  <p className="text-sm text-apagado">Ninguém livre pode ocupar este serviço agora.</p>
                ) : (
                  <ul className="grid max-h-60 gap-1.5 overflow-y-auto">
                    {livres.map((c) => {
                      const turnoId = turnoDe[c.militarId] ?? c.servicos[0]!.turnoId;
                      return (
                        <li key={c.militarId} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEscolha({ tipo: 'livre', livre: c, turnoId })}
                            className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded-md border border-linha px-3 py-2 text-left hover:bg-accent"
                          >
                            <span className="text-xs text-apagado">{c.posto}</span>
                            <span className="font-cond text-base font-semibold">{c.nomeGuerra}</span>
                            <span className="text-xs text-apagado">{c.equipe ?? 'Adm'}</span>
                          </button>
                          {c.servicos.length > 1 && (
                            <Selecao aria-label={`Serviço de ${c.nomeGuerra}`} value={turnoId} onChange={(e) => setTurnoDe({ ...turnoDe, [c.militarId]: e.target.value })} className="w-28">
                              {c.servicos.map((s) => <option key={s.turnoId} value={s.turnoId}>{s.nome}</option>)}
                            </Selecao>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {opcoes.data.livres.fora.length > 0 && <p className="text-xs text-apagado">Ficaram de fora: {frasesDeFora(opcoes.data.livres.fora)}</p>}

                {opcoes.data.escalados.length > 0 && (
                  <section className="grid gap-2">
                    <h3 className="text-sm font-medium">Já escalados neste dia</h3>
                    <ul className="grid max-h-60 gap-2 overflow-y-auto">
                      {opcoes.data.escalados.map((e) => (
                        <li key={e.militarId} className="grid gap-1">
                          <p className="font-cond text-base font-semibold">{e.posto} {e.nomeGuerra}</p>
                          <ul className="grid gap-1">
                            {e.alocacoes.map((a) => (
                              <li key={a.alocacaoId}>
                                <button
                                  type="button"
                                  onClick={() => setEscolha({ tipo: 'escalado', escalado: e, alocacaoId: a.alocacaoId, onde: a.onde, permuta: a.permuta })}
                                  className="w-full rounded-md border border-linha px-3 py-2 text-left text-sm hover:bg-accent"
                                >
                                  {a.onde}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
