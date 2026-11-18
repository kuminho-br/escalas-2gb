import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, textoFaixa } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCandidatos, escalar } from '@/api/escala-do-mes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { frasesDeFora } from '@/lib/escala';
import type { VagaDaTela } from './CardDaGuarnicao';

/** "Escolher militar": só quem pode ocupar a vaga (CNH, choque, afastamento, voluntariado, lotação) e, no rodapé, quantos ficaram de fora e por quê. */
export function EscolherMilitar({ escalaId, vaga, aoFechar }: { escalaId: string; vaga: VagaDaTela; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const mes = vaga.data.slice(0, 7);
  const candidatos = useQuery(consultaCandidatos(escalaId, mes, { data: vaga.data, inicio: vaga.inicio, fim: vaga.fim, guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId }));
  const [busca, setBusca] = useState('');
  const [turnoDe, setTurnoDe] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const dia = Number(vaga.data.slice(8));

  const escolher = travar(async (militarId: string, turnoId: string) => {
    setErro(null);
    try {
      await escalar(queryClient, escalaId, { militarId, data: vaga.data, turnoId, guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId });
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const texto = busca.trim().toLowerCase();
  const aptos = (candidatos.data?.aptos ?? []).filter((c) => !texto || c.nomeGuerra.toLowerCase().includes(texto) || c.matricula.includes(texto));

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolher militar</DialogTitle>
          <DialogDescription>
            Dia {dia} de {mesPorExtenso(mes)}, {textoFaixa(vaga.inicio, vaga.fim)}: {vaga.funcao}
            {vaga.cnhExigida ? ` (CNH ${vaga.cnhExigida})` : ''} na {vaga.guarnicao}.
          </DialogDescription>
        </DialogHeader>
        <Input aria-label="Buscar por nome ou matrícula" placeholder="Buscar por nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {candidatos.isPending && <p className="text-apagado">Carregando…</p>}
        {candidatos.error && <p role="alert" className="text-alerta">{mensagemDe(candidatos.error)}</p>}
        {candidatos.data && (
          <>
            {candidatos.data.aptos.length === 0 ? (
              <p className="text-apagado">Ninguém pode ocupar esta vaga agora.</p>
            ) : (
              <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
                {aptos.map((c) => {
                  const turnoId = turnoDe[c.militarId] ?? c.servicos[0]!.turnoId;
                  return (
                    <li key={c.militarId} className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void escolher(c.militarId, turnoId)}
                        className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded-md border border-linha px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
                      >
                        <span className="text-xs text-apagado">{c.posto}</span>
                        <span className="font-cond text-base font-semibold">{c.nomeGuerra}</span>
                        <span className="text-xs text-apagado">{c.matricula}</span>
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
            {candidatos.data.fora.length > 0 && <p className="text-xs text-apagado">Ficaram de fora: {frasesDeFora(candidatos.data.fora)}</p>}
          </>
        )}
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      </DialogContent>
    </Dialog>
  );
}
