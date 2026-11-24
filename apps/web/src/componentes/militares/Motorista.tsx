import { useQueryClient } from '@tanstack/react-query';
import type { EdicaoMilitar, FichaMilitar } from 'contratos';
import { CNH_HABILITA, cnhHabilitadas } from 'dominio';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { AcoesDoBloco, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { cn } from '@/lib/utils';
import { Secao } from './Secao';
import { Radio } from '@/componentes/ui/radio';

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
  // a carteira é do militar: fica gravada mesmo fora do quadro de motoristas (só deixa de valer para a escala)
  const assinatura = (q: boolean, c: string[]) => JSON.stringify([q, [...c].sort()]);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => ({ quadro: ficha.noQuadroDeMotoristas, carteira: [...ficha.cnh].sort() }));
  const sujo = assinatura(quadro, carteira) !== assinatura(salvo.quadro, salvo.carteira);
  usePendencia('motorista', sujo);
  const doServidor = assinatura(ficha.noQuadroDeMotoristas, ficha.cnh);
  useSincronizar(doServidor, sujo, () => {
    setQuadro(ficha.noQuadroDeMotoristas);
    setCarteira(ficha.cnh);
    setSalvo({ quadro: ficha.noQuadroDeMotoristas, carteira: [...ficha.cnh].sort() });
  });

  // A carteira guarda só a maior categoria de cada cadeia (a E já traz D, C e B). Clicar:
  // - numa categoria que a carteira tem e nenhuma maior da carteira acende: tira ela e as que ela acendia;
  // - em qualquer outra (apagada, acesa só pela hierarquia, ou repetida por uma maior): ela passa a ser a carteira; saem as maiores que a
  //   acendiam (senão ela continuaria acesa por elas) e as menores que ela já cobre (agora vêm dela).
  const alternar = (c: string) =>
    setCarteira((atual) => {
      // acesa só pela hierarquia (não está na carteira): clicar não a põe na carteira; a dica diz de onde ela vale
      if (!atual.includes(c) && atual.some((x) => CNH_HABILITA[x]?.includes(c))) return atual;
      const acendiam = atual.filter((x) => x !== c && CNH_HABILITA[x]?.includes(c));
      const cobertas = CNH_HABILITA[c] ?? [c];
      if (atual.includes(c) && acendiam.length === 0) return atual.filter((x) => !cobertas.includes(x));
      return [...atual.filter((x) => !acendiam.includes(x) && !cobertas.includes(x)), c].sort();
    });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    try {
      // só vai o que mudou: desmarcar o quadro manda só `motorista: false`, e a carteira continua como está
      const cnhMudou = JSON.stringify([...carteira].sort()) !== JSON.stringify(salvo.carteira);
      await editarMilitar(ficha.id, {
        ...(quadro !== salvo.quadro ? { motorista: quadro } : {}),
        ...(cnhMudou ? { cnh: carteira as NonNullable<EdicaoMilitar['cnh']> } : {}),
      });
      setSalvo({ quadro, carteira: [...carteira].sort() });
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
              <Radio name="quadro" checked={quadro === v} onChange={() => setQuadro(v)} />
              {v ? 'Sim' : 'Não'}
            </label>
          ))}
        </div>
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
                  title={pela ? `Vale pela categoria ${pela}.` : undefined}
                  data-origem={naCarteira ? 'carteira' : pela ? 'hierarquia' : 'nenhuma'}
                  onClick={() => alternar(c)}
                  className={cn(
                    'grid place-items-center rounded-md border px-0.5 py-0.5 text-center',
                    // a que a carteira habilita acende igual à da carteira; de onde vem fica só no nome acessível
                    naCarteira || pela ? 'border-tinta bg-tinta text-white' : 'border-linha text-apagado',
                  )}
                >
                  <span className="font-cond text-lg leading-none font-semibold">{c}</span>
                  <span className="text-apoio leading-tight">{veiculo}</span>
                </button>
              );
            })}
        </div>
        <p className="text-xs text-apagado">Marque as categorias da carteira. As que ela habilita acendem sozinhas (a E acende D, C e B). A moto (A) é separada.</p>
        <p className="text-xs text-apagado">A CNH só vale para a escala com o militar no quadro de motoristas.</p>
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} rotulo="Salvar motorista" tipo="button" aoSalvar={() => void salvar()} />
      </fieldset>
    </Secao>
  );
}
