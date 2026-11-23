import type { ReactNode } from 'react';
import { Selecao } from '@/componentes/Selecao';
import { Tabs, TabsList, TabsTrigger } from '@/componentes/ui/tabs';

/** Uma seção do painel: `valor` vai no endereço, `nome` aparece no menu. */
export type SecaoDoMenu = { valor: string; nome: string };

/**
 * O painel de seções das Configurações e da Estrutura: um menu vertical à esquerda (a seção escolhida marcada) e o conteúdo ao lado. No celular o menu
 * vira uma lista de opções no alto. Com uma seção só, não há menu: a pessoa vê direto o conteúdo. Os filhos são os `TabsContent` de cada seção.
 */
export function PainelComMenu({ secoes, valor, aoEscolher, rotulo, children }: { secoes: SecaoDoMenu[]; valor: string; aoEscolher: (valor: string) => void; rotulo: string; children: ReactNode }) {
  if (secoes.length <= 1) {
    return (
      <Tabs value={valor} onValueChange={aoEscolher} className="mt-6 gap-0">
        {children}
      </Tabs>
    );
  }
  return (
    <Tabs value={valor} onValueChange={aoEscolher} orientation="vertical" className="mt-6 flex-col gap-4 md:flex-row md:gap-10">
      {/* celular: uma lista de opções no alto */}
      <div className="md:hidden">
        <Selecao aria-label={rotulo} value={valor} onChange={(e) => aoEscolher(e.target.value)}>
          {secoes.map((s) => <option key={s.valor} value={s.valor}>{s.nome}</option>)}
        </Selecao>
      </div>
      {/* computador: o menu vertical, com a seção escolhida marcada pela barra vinho */}
      <TabsList variant="line" aria-label={rotulo} className="hidden w-56 shrink-0 gap-0 self-start p-0 md:flex md:flex-col md:items-stretch">
        {secoes.map((s) => (
          <TabsTrigger
            key={s.valor}
            value={s.valor}
            className="h-auto flex-none justify-start rounded-none border-0 border-l-2 border-linha px-3 py-2 text-left text-[15px] whitespace-normal after:hidden hover:bg-fundo/70 data-[state=active]:border-vinho data-[state=active]:bg-[#F5E7E7] data-[state=active]:font-semibold data-[state=active]:text-vinho"
          >
            {s.nome}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-w-0 flex-1">{children}</div>
    </Tabs>
  );
}
