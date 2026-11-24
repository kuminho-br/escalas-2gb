import type { EscalaDosOficiais } from 'contratos';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { normalizarBusca } from '@/lib/texto';

type Oficial = EscalaDosOficiais['oficiais'][number];

interface Props {
  /** O lugar que espera um nome: a janela abre quando há um e fecha quando não há. */
  lugar: { dia: string; rotulo: string; servico: string } | null;
  /** Quem participa da rodada do mês, na ordem da lista. */
  oficiais: Oficial[];
  aoEscolher: (o: Oficial) => void;
  aoFechar: () => void;
}

/**
 * "Escolher oficial": a lista de quem participa, com busca por nome (sem acento nem caixa), aberta pelo clique numa placa livre quando nenhum oficial está
 * escolhido. Escolher um nome lança o oficial naquele lugar, no serviço escolhido na tela.
 */
export function EscolherOficial({ lugar, oficiais, aoEscolher, aoFechar }: Props) {
  const [busca, setBusca] = useState('');
  const b = normalizarBusca(busca);
  const achados = oficiais.filter((o) => normalizarBusca(`${o.posto} ${o.nomeGuerra}`).includes(b));
  const fechar = () => {
    setBusca('');
    aoFechar();
  };
  return (
    <Dialog open={lugar !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lugar ? `Escolher oficial para ${lugar.dia.slice(8)}/${lugar.dia.slice(5, 7)} (${lugar.rotulo})` : 'Escolher oficial'}</DialogTitle>
          <DialogDescription>{lugar ? `Ele fica com o turno como ${lugar.servico}.` : ''}</DialogDescription>
        </DialogHeader>
        <Input type="search" aria-label="Buscar por nome" placeholder="Buscar por nome" value={busca} onChange={(ev) => setBusca(ev.target.value)} autoComplete="off" />
        <ul aria-label="Oficiais da rodada" className="grid max-h-[50dvh] gap-1 overflow-y-auto">
          {achados.map((o) => (
            <li key={o.militarId}>
              <button
                type="button"
                aria-label={`${o.posto} ${o.nomeGuerra}`}
                onClick={() => {
                  setBusca('');
                  aoEscolher(o);
                }}
                className="flex w-full items-baseline gap-2 rounded-md px-3 py-2 text-left hover:bg-passa focus-visible:outline-2 focus-visible:outline-tinta"
              >
                <span className="text-apoio leading-[18px] font-medium text-apagado">{o.posto}</span>
                <b className="font-cond text-nome leading-6 font-semibold">{o.nomeGuerra}</b>
              </button>
            </li>
          ))}
        </ul>
        {achados.length === 0 && <p role="status" className="text-apagado">Nenhum oficial com esse nome.</p>}
      </DialogContent>
    </Dialog>
  );
}
