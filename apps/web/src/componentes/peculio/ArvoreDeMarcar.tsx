import type { UnidadeDaConsulta } from 'contratos';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Checkbox } from '@/componentes/ui/checkbox';
import { montarArvore, type No } from '@/lib/arvore-de-unidades';
import { cn } from '@/lib/utils';

/** Uma unidade marcada na árvore e se vale também as de baixo. A ordem é a da marcação. */
export type Marca = { id: string; comAsDeBaixo: boolean };

/**
 * A árvore de unidades com uma marca por nó (6.51): marcar um nó inclui os lotados nele; o segundo controle, "e as de baixo", inclui as unidades de baixo (liga ao marcar, a
 * pessoa desliga se quiser só aquela). É uma forma de preencher a lotação da pesquisa com várias unidades de uma vez. Começa aberta só no alto; cada nó com filhas abre e fecha.
 */
export function ArvoreDeMarcar({ unidades, marcas, aoMudar }: { unidades: UnidadeDaConsulta[]; marcas: Marca[]; aoMudar: (marcas: Marca[]) => void }) {
  const nos = useMemo(() => montarArvore(unidades), [unidades]);
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(nos.map((n) => n.id)));
  const alternarAberto = (id: string) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marca = (id: string) => marcas.find((m) => m.id === id);
  const alternarMarca = (id: string) => aoMudar(marca(id) ? marcas.filter((m) => m.id !== id) : [...marcas, { id, comAsDeBaixo: true }]);
  const alternarDeBaixo = (id: string) => aoMudar(marcas.map((m) => (m.id === id ? { ...m, comAsDeBaixo: !m.comAsDeBaixo } : m)));

  const ramo = (lista: No[]) => (
    <ul className="grid gap-0.5">
      {lista.map((n) => {
        const m = marca(n.id);
        const aberto = abertos.has(n.id);
        return (
          <li key={n.id}>
            <div className="flex min-h-9 items-center gap-2" style={{ paddingLeft: n.nivel * 20 }}>
              {n.filhos.length > 0 ? (
                <button type="button" aria-expanded={aberto} aria-label={`${aberto ? 'Fechar' : 'Abrir'} ${n.sigla}`} onClick={() => alternarAberto(n.id)} className="grid size-6 shrink-0 place-items-center rounded text-apagado hover:text-tinta">
                  {aberto ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                </button>
              ) : (
                <span className="size-6 shrink-0" aria-hidden />
              )}
              <label className={cn('flex items-center gap-2 text-corpo', n.passagem && 'text-apagado')}>
                <Checkbox aria-label={`Marcar ${n.sigla}`} checked={Boolean(m)} onChange={() => alternarMarca(n.id)} />
                {n.sigla}
              </label>
              {m && n.filhos.length > 0 && (
                <label className="ml-2 flex items-center gap-1.5 text-apoio text-apagado">
                  <Checkbox aria-label={`${n.sigla}: e as de baixo`} checked={m.comAsDeBaixo} onChange={() => alternarDeBaixo(n.id)} className="size-4" />
                  e as de baixo
                </label>
              )}
            </div>
            {n.filhos.length > 0 && aberto && ramo(n.filhos)}
          </li>
        );
      })}
    </ul>
  );
  return <div className="max-h-80 overflow-auto rounded-xl border border-linha bg-superficie p-2">{ramo(nos)}</div>;
}
