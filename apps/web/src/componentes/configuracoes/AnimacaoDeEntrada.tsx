import { useState } from 'react';
import { gravarQuando, lerQuando, pedeMenosMovimento, type Quando } from '@/lib/transicao-login/regra';

const OPCOES_DA_ANIMACAO: { valor: Quando; rotulo: string }[] = [
  { valor: 'sempre', rotulo: 'Em toda entrada' },
  { valor: '12h', rotulo: 'Uma vez a cada 12 horas' },
  { valor: 'nunca', rotulo: 'Nunca' },
];

/** Quando a animação do login toca. A escolha fica neste navegador (a animação começa antes de o servidor dizer quem entra) e grava na hora. */
export function AnimacaoDeEntrada() {
  const [quando, setQuando] = useState<Quando>(lerQuando);
  const menosMovimento = pedeMenosMovimento();
  const escolher = (q: Quando) => {
    setQuando(q);
    gravarQuando(q);
  };
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie p-4">
      <h2 className="mb-3 font-cond text-lg font-semibold">Animação de entrada</h2>
      <fieldset role="radiogroup" aria-label="Animação de entrada" className="grid gap-2">
        {OPCOES_DA_ANIMACAO.map((o) => (
          <label key={o.valor} className="flex items-center gap-2 text-sm">
            <input type="radio" name="animacao-de-entrada" value={o.valor} checked={quando === o.valor} onChange={() => escolher(o.valor)} className="size-4 accent-vinho" />
            {o.rotulo}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 text-xs text-apagado">Vale para este navegador.</p>
      {menosMovimento && <p className="mt-1 text-sm text-pendencia">Seu aparelho pede menos movimento, então a animação não toca.</p>}
    </div>
  );
}
