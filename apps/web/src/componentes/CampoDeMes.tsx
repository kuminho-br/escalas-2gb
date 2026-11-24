import { Mes, somarMeses } from 'contratos';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

/**
 * Mês da tela: um grupo com borda `encaixe`, a seta do mês anterior, o campo de mês (17 px estreita; no navegador que não o desenha, ele vira texto) e a seta do próximo.
 * Enquanto a pessoa digita, o texto fica como está; só um mês completo ("aaaa-mm") troca o mês da tela.
 */
export function CampoDeMes({ id, valor, aoMudar }: { id: string; valor: string; aoMudar: (mes: string) => void }) {
  const [texto, setTexto] = useState(valor);
  const [visto, setVisto] = useState(valor);
  if (valor !== visto) {
    // o mês da tela mudou por outro caminho (botões, endereço): o campo acompanha
    setVisto(valor);
    setTexto(valor);
  }
  const digitar = (t: string) => {
    setTexto(t);
    if (t !== valor && Mes.safeParse(t).success) aoMudar(t);
  };
  return (
    <div className="flex w-fit items-center overflow-hidden rounded-controle border border-encaixe bg-superficie">
      <Button type="button" variant="discreto" size="icon" className="rounded-none" aria-label="Mês anterior" onClick={() => aoMudar(somarMeses(valor, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <Input id={id} type="month" value={texto} onChange={(e) => digitar(e.target.value)} className="w-44 rounded-none border-0 bg-transparent font-cond text-nome font-semibold hover:border-0" />
      <Button type="button" variant="discreto" size="icon" className="rounded-none" aria-label="Próximo mês" onClick={() => aoMudar(somarMeses(valor, 1))}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
