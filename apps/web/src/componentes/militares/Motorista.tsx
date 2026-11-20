import { useQueryClient } from '@tanstack/react-query';
import type { EdicaoMilitar, FichaMilitar } from 'contratos';
import { CNH_HABILITA, cnhHabilitadas } from 'dominio';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { AcoesDoBloco, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { cn } from '@/lib/utils';
import { Secao } from './Secao';

const CATEGORIAS = [
  ['A', 'moto'],
  ['B', 'carro'],
  ['C', 'caminhão'],
  ['D', 'ônibus'],
  ['E', 'carreta'],
] as const;
const ORDEM = ['E', 'D', 'C', 'B', 'A'];

/** Categoria da carteira que habilita x pela hierarquia (a mais alta). */
const origemDe = (x: string, carteira: string[]) => ORDEM.find((c) => carteira.includes(c) && CNH_HABILITA[c]?.includes(x));

export function Motorista({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const [quadro, setQuadro] = useState(ficha.noQuadroDeMotoristas);
  const [carteira, setCarteira] = useState<string[]>(ficha.cnh);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const habilitadas = cnhHabilitadas(carteira);
  const assinatura = (q: boolean, c: string[]) => JSON.stringify([q, q ? [...c].sort() : []]);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => assinatura(ficha.noQuadroDeMotoristas, ficha.cnh));
  const sujo = assinatura(quadro, carteira) !== salvo;
  usePendencia('motorista', sujo);
  const doServidor = assinatura(ficha.noQuadroDeMotoristas, ficha.cnh);
  useSincronizar(doServidor, sujo, () => {
    setQuadro(ficha.noQuadroDeMotoristas);
    setCarteira(ficha.cnh);
    setSalvo(doServidor);
  });

  const alternar = (c: string) => setCarteira((atual) => (atual.includes(c) ? atual.filter((x) => x !== c) : [...atual, c].sort()));

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    try {
      await editarMilitar(ficha.id, { motorista: quadro, cnh: quadro ? (carteira as NonNullable<EdicaoMilitar['cnh']>) : [] });
      setSalvo(assinatura(quadro, carteira));
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Salvo.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Motorista">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm">Está no quadro de motoristas?</legend>
        <div className="flex gap-4 text-sm">
          {[true, false].map((v) => (
            <label key={String(v)} className="flex items-center gap-2">
              <input type="radio" name="quadro" checked={quadro === v} onChange={() => setQuadro(v)} className="size-4 accent-vinho" />
              {v ? 'Sim' : 'Não'}
            </label>
          ))}
        </div>
        {quadro && (
          <div className="grid w-1/2 min-w-[15rem] grid-cols-5 gap-1" role="group" aria-label="Categorias da CNH">
            {CATEGORIAS.map(([c, veiculo]) => {
              const naCarteira = carteira.includes(c);
              const pela = !naCarteira && habilitadas.includes(c) ? origemDe(c, carteira) : undefined;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`${c} ${veiculo}${pela ? ` pela ${pela}` : ''}`}
                  aria-pressed={naCarteira || !!pela}
                  data-origem={naCarteira ? 'carteira' : pela ? 'hierarquia' : 'nenhuma'}
                  onClick={() => alternar(c)}
                  className={cn(
                    'grid place-items-center rounded-md border px-0.5 py-0.5 text-center',
                    // a que a carteira habilita acende igual à da carteira; o "pela X" embaixo diz de onde vem
                    naCarteira || pela ? 'border-tinta bg-tinta text-white' : 'border-linha text-apagado',
                  )}
                >
                  <span className="font-cond text-lg leading-none font-semibold">{c}</span>
                  <span className="text-[10px] leading-tight">{veiculo}</span>
                  {pela && <span className="text-[9px] leading-tight">pela {pela}</span>}
                </button>
              );
            })}
          </div>
        )}
        {quadro && <p className="text-xs text-apagado">Marque as categorias da carteira. As que ela habilita acendem sozinhas (a E acende D, C e B). A moto (A) é separada.</p>}
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} rotulo="Salvar motorista" tipo="button" aoSalvar={() => void salvar()} />
      </fieldset>
    </Secao>
  );
}
