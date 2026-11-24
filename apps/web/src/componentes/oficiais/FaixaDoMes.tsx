import type { EscalaDosOficiais } from 'contratos';
import { Check, ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

const PASSOS = [
  { nome: 'Abrir o mês', frase: 'Marque quem participa e abra o mês: as cotas se refazem sozinhas.' },
  { nome: 'Escolhas', frase: 'JES à mão primeiro; o resto, pela rodada, como Saldo.' },
  { nome: 'Escala fechada', frase: 'Trocar é cobrir: fica o registro de quem saiu.' },
  { nome: 'Mês encerrado', frase: 'O saldo entra no acumulado.' },
] as const;

interface Props {
  etapa: EscalaDosOficiais['etapa'];
  ocupado: boolean;
  /** sem a escala (e o serviço de Saldo dela) não há como abrir o mês */
  podeAbrir: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  aoEncerrar: () => void;
  /** Os botões do cabeçalho que não são a ação do mês: "Regras", "Ver o saldo". */
  extras?: ReactNode;
}

/**
 * A faixa do cabeçalho do mês: a etapa atual em texto, "Como funciona o mês" (a explicação das quatro etapas, recolhida) e, à direita, a ação que leva à próxima
 * etapa, o único botão principal da tela. Os outros botões do cabeçalho (Regras, Ver o saldo) entram como `extras`.
 */
export function FaixaDoMes({ etapa, ocupado, podeAbrir, aoAbrir, aoFechar, aoEncerrar, extras }: Props) {
  const [aberta, setAberta] = useState(false);
  const atual = etapa === 'encerrada' ? 3 : etapa === 'fechada' ? 2 : etapa === 'escolhas' ? 1 : 0;
  const acao =
    etapa === 'nao-aberto' ? { rotulo: 'Abrir o mês', aoClicar: aoAbrir, desligado: ocupado || !podeAbrir }
    : etapa === 'escolhas' ? { rotulo: 'Fechar a escala', aoClicar: aoFechar, desligado: ocupado }
    : etapa === 'fechada' ? { rotulo: 'Encerrar o mês', aoClicar: aoEncerrar, desligado: ocupado }
    : null;
  return (
    <section aria-label="Etapa do mês" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex items-baseline gap-2">
          <span className="text-apoio leading-[18px] text-apagado">Etapa</span>
          <b className="font-cond text-bloco leading-[26px] font-semibold text-tinta">{PASSOS[atual]!.nome}</b>
          <span className="text-apoio leading-[18px] text-apagado">{`${atual + 1} de 4`}</span>
        </p>
        <Button type="button" variant="ghost" size="sm" aria-expanded={aberta} aria-controls="como-funciona-o-mes" onClick={() => setAberta((a) => !a)}>
          Como funciona o mês
          <ChevronDown aria-hidden className={cn('transition-transform motion-reduce:transition-none', aberta && 'rotate-180')} />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {extras}
          {acao && (
            <Button type="button" disabled={acao.desligado} onClick={acao.aoClicar}>
              {acao.rotulo}
            </Button>
          )}
        </div>
      </div>
      {aberta && (
        <div id="como-funciona-o-mes" className="rounded-md border border-linha bg-superficie p-3">
          <ol aria-label="As quatro etapas do mês" className="grid gap-3 md:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.nome} aria-current={i === atual ? 'step' : undefined} className="flex gap-2.5">
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-apoio leading-none font-semibold',
                    i === atual ? 'border-tinta bg-tinta text-white' : i < atual ? 'border-tinta text-tinta' : 'border-encaixe text-apagado',
                  )}
                >
                  {i < atual ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="grid gap-0.5">
                  <h3 className={cn('text-corpo leading-[22px]', i === atual ? 'font-semibold text-tinta' : 'text-apagado')}>
                    {p.nome}
                    {i < atual && <span className="sr-only"> feito</span>}
                  </h3>
                  <p className="text-apoio leading-[18px] text-apagado">{p.frase}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
