import { useQueryClient } from '@tanstack/react-query';
import { textoFaixa, type TrechoNoEfetivo } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { removerAlocacao, tirarAcumulo } from '@/api/escala-do-mes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/**
 * Um trecho ocupado: as alocações dele (uma por turno emendado), cada uma com "Remover" ou, se for acúmulo, "Tirar acúmulo" — as
 * mesmas ações da Escala do mês.
 */
export function AlocacoesDoTrecho({ funcao, trecho, aoFechar }: { funcao: string; trecho: TrechoNoEfetivo; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const o = trecho.ocupante!;
  const agir = travar(async (a: (typeof o.alocacoes)[number]) => {
    setErro(null);
    try {
      if (a.acumuloId) await tirarAcumulo(queryClient, a.acumuloId);
      else await removerAlocacao(queryClient, a.alocacaoId);
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{o.posto} {o.nomeGuerra}</DialogTitle>
          <DialogDescription>
            {funcao}, {o.servico.nome}{o.acumulo ? ', por acúmulo' : ''}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2">
          {o.alocacoes.map((a) => {
            const faixa = textoFaixa(a.inicio, a.fim);
            const acao = a.acumuloId ? 'Tirar acúmulo' : 'Remover';
            return (
              <li key={a.acumuloId ?? a.alocacaoId} className="flex items-center gap-3">
                <span className="flex-1">{faixa}</span>
                <Button type="button" variant="outline" size="sm" disabled={salvando} aria-label={`${acao} ${faixa}`} onClick={() => void agir(a)}>
                  {acao}
                </Button>
              </li>
            );
          })}
        </ul>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      </DialogContent>
    </Dialog>
  );
}
