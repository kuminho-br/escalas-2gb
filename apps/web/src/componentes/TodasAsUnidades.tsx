import { ListTree } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { classeDaCaixaDaArvore, focarNaArvore, PainelDaArvore } from '@/componentes/EscolherUnidade';
import type { No } from '@/lib/arvore-de-unidades';

/**
 * "Ver todas as unidades" (6.73), ao lado dos degraus: abre a árvore inteira das unidades da pessoa (as de trabalho e, num grupo à parte, as só de consulta, como era
 * antes dos degraus da 6.61). Escolher uma faz dela a unidade de trabalho. No celular fica dentro do painel dos degraus, com o texto escrito; no computador é um botão de ícone.
 */
export function TodasAsUnidades({ valor, trabalho, consulta, aoEscolher }: { valor: string; trabalho: No[]; consulta: No[]; aoEscolher: (id: string, soConsulta: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const escolher = (id: string, soConsulta: boolean) => {
    setAberto(false);
    aoEscolher(id, soConsulta);
  };
  return (
    <Popover.Root open={aberto} onOpenChange={setAberto}>
      <Popover.Trigger
        aria-label="Ver todas as unidades"
        title="Ver todas as unidades"
        className="flex h-8 items-center gap-2 rounded-controle border border-linha px-2 font-cond text-corpo font-medium whitespace-nowrap text-apagado hover:bg-fundo hover:text-tinta max-md:w-full max-md:px-2.5"
      >
        <ListTree aria-hidden className="size-4 shrink-0" />
        <span aria-hidden className="md:hidden">Ver todas as unidades</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={16} className={`${classeDaCaixaDaArvore} font-sans`} aria-label="Escolher a unidade" onOpenAutoFocus={focarNaArvore}>
          <PainelDaArvore
            valor={valor}
            grupos={[
              ...(trabalho.length > 0 ? [{ rotulo: 'Unidade de trabalho', nos: trabalho, aoEscolher: (id: string) => escolher(id, false) }] : []),
              ...(consulta.length > 0 ? [{ rotulo: 'Só consulta', titulo: 'Só consulta', nos: consulta, aoEscolher: (id: string) => escolher(id, true) }] : []),
            ]}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
