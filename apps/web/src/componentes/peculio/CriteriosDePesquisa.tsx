import type { UnidadeDaConsulta } from 'contratos';
import { ListFilter, Search, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { ArquivoDeMatriculas } from './ArquivoDeMatriculas';
import { ArvoreDeMarcar } from './ArvoreDeMarcar';
import { CRITERIOS_VAZIOS, PROCURAR_EM_INICIAL, type Criterios, type ProcurarEm } from './EstadoDaPesquisa';
import { contarExtras, FiltrosDaPesquisa } from './FiltrosDaPesquisa';

export type Aba = 'texto' | 'arvore' | 'arquivo' | 'outros';

/** Quantos critérios de cada aba a pessoa montou (o número vai na aba). Na aba "Nome e matrícula", o que foge do padrão de onde procurar. */
export function contasDasAbas(c: Criterios): Record<Aba, number> {
  const p = c.procurarEm;
  return {
    texto: (p.nomeCompleto ? 1 : 0) + (p.matricula ? 0 : 1) + (p.nomeDeGuerra ? 0 : 1),
    arvore: c.marcas.length,
    arquivo: c.matriculas.length > 0 ? 1 : 0,
    outros: contarExtras(c.extras),
  };
}

/** O rótulo do campo da barra acompanha onde o texto procura: "Matrícula ou nome de guerra", "Matrícula, nome de guerra ou nome completo". */
export function rotuloDoCampo(p: ProcurarEm): string {
  const lugares = [p.matricula && 'matrícula', p.nomeDeGuerra && 'nome de guerra', p.nomeCompleto && 'nome completo'].filter(Boolean) as string[];
  const texto = lugares.length <= 1 ? (lugares[0] ?? 'matrícula') : `${lugares.slice(0, -1).join(', ')} ou ${lugares[lugares.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** O botão "Critérios de pesquisa", com a marca âmbar da quantidade em uso (a das etiquetas). */
export function BotaoDosCriterios({ emUso, aberto, aoAlternar, idDoPainel }: { emUso: number; aberto: boolean; aoAlternar: () => void; idDoPainel: string }) {
  return (
    <Button type="button" variant="secundario" aria-expanded={aberto} aria-controls={idDoPainel} onClick={aoAlternar} className="relative">
      <ListFilter aria-hidden />
      Critérios de pesquisa
      {emUso > 0 && (
        <span className="grid h-5.5 min-w-5.5 place-items-center rounded-full bg-pendencia-fundo px-1.5 text-apoio leading-none font-semibold text-pendencia">
          <span aria-hidden>{emUso}</span>
          <span className="sr-only">{`, ${emUso} em uso`}</span>
        </span>
      )}
    </Button>
  );
}

function Contagem({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-pendencia-fundo px-1 text-xs leading-none font-semibold text-pendencia">{n}</span>;
}

function AbaNomeEMatricula({ valor, aoMudar }: { valor: ProcurarEm; aoMudar: (p: ProcurarEm) => void }) {
  const ligados = [valor.matricula, valor.nomeDeGuerra, valor.nomeCompleto].filter(Boolean).length;
  // pelo menos um lugar fica ligado: o último não se desliga
  const campo = (chave: keyof ProcurarEm, rotulo: string, nota?: string) => (
    <label key={chave} className="flex items-start gap-2 text-corpo">
      <Checkbox className="mt-0.5" checked={valor[chave]} disabled={valor[chave] && ligados === 1} onChange={(e) => aoMudar({ ...valor, [chave]: e.target.checked })} />
      <span>
        {rotulo}
        {nota && <small className="block text-apoio text-apagado">{nota}</small>}
      </span>
    </label>
  );
  return (
    <div className="grid gap-3">
      <p className="max-w-[60ch] text-apagado">O texto da barra de busca procura nestes campos. Pelo menos um fica ligado.</p>
      <fieldset className="grid gap-2">
        <legend className="sr-only">Procurar em</legend>
        {campo('matricula', 'Matrícula')}
        {campo('nomeDeGuerra', 'Nome de guerra')}
        {campo('nomeCompleto', 'Nome completo', 'Vem desligado: com ele, um sobrenome comum traz muita gente.')}
      </fieldset>
      {(valor.matricula !== PROCURAR_EM_INICIAL.matricula || valor.nomeDeGuerra !== PROCURAR_EM_INICIAL.nomeDeGuerra || valor.nomeCompleto !== PROCURAR_EM_INICIAL.nomeCompleto) && (
        <div>
          <Button type="button" variant="discreto" size="sm" onClick={() => aoMudar({ ...PROCURAR_EM_INICIAL })}>Voltar ao padrão</Button>
        </div>
      )}
    </div>
  );
}

/**
 * O painel "Critérios de pesquisa" (6.63): quatro abas, cada uma com o conteúdo do filtro de antes ("Pela árvore", "Arquivo de matrículas" e "Outros filtros" só para quem tem nível
 * de acesso), e "Buscar" embaixo. O campo principal fica na barra, fora daqui. Os critérios são o rascunho: só valem no "Buscar".
 */
function ConteudoDosCriterios({
  criterios, aoMudar, nivel, unidades, aba, aoMudarAba, aoBuscar, aoLimpar, aoFechar, erro,
}: {
  criterios: Criterios;
  aoMudar: (parte: Partial<Criterios>) => void;
  nivel: boolean;
  unidades: UnidadeDaConsulta[];
  aba: Aba;
  aoMudarAba: (a: Aba) => void;
  aoBuscar: () => void;
  aoLimpar: () => void;
  aoFechar: () => void;
  erro?: string | null;
}) {
  const contas = contasDasAbas(criterios);
  const abas: [Aba, string][] = [['texto', 'Nome e matrícula'], ['arvore', 'Pela árvore'], ...(nivel ? ([['arquivo', 'Arquivo de matrículas'], ['outros', 'Outros filtros']] as [Aba, string][]) : [])];
  const algumCriterio = JSON.stringify(criterios) !== JSON.stringify(CRITERIOS_VAZIOS);
  return (
    <Tabs value={aba} onValueChange={(v) => aoMudarAba(v as Aba)} className="min-h-0 flex-1 gap-0">
      <TabsList aria-label="Critérios de pesquisa" className="px-2 pt-1.5">
        {abas.map(([chave, rotulo]) => (
          <TabsTrigger key={chave} value={chave} className="gap-1.5">
            {rotulo}
            <Contagem n={contas[chave]} />
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="texto"><AbaNomeEMatricula valor={criterios.procurarEm} aoMudar={(procurarEm) => aoMudar({ procurarEm })} /></TabsContent>
        <TabsContent value="arvore">
          <div className="grid gap-3">
            <p className="max-w-[60ch] text-apagado">Marque várias unidades. Com unidades marcadas, “Lotados em” fica de lado.</p>
            <ArvoreDeMarcar unidades={unidades} marcas={criterios.marcas} aoMudar={(marcas) => aoMudar({ marcas })} />
          </div>
        </TabsContent>
        {nivel && <TabsContent value="arquivo"><ArquivoDeMatriculas matriculas={criterios.matriculas} aoLer={(matriculas) => aoMudar({ matriculas })} /></TabsContent>}
        {nivel && <TabsContent value="outros"><FiltrosDaPesquisa valor={criterios.extras} aoMudar={(extras) => aoMudar({ extras })} /></TabsContent>}
      </div>
      {erro && <p role="alert" className="border-t border-linha px-4 py-2 text-sm text-alerta">{erro}</p>}
      <div className="flex flex-wrap items-center gap-2 border-t border-linha px-4 py-3">
        <Button type="button" variant="discreto" disabled={!algumCriterio} onClick={aoLimpar}>Limpar critérios</Button>
        <Button type="button" variant="secundario" onClick={aoFechar}>Fechar</Button>
        <Button type="button" className="ml-auto" onClick={aoBuscar}>
          <Search aria-hidden />
          Buscar
        </Button>
      </div>
    </Tabs>
  );
}

/**
 * Onde o painel aparece: no computador, por baixo da barra; no celular, numa folha que cobre a tela (6.63). `id` liga o botão ao painel.
 */
export function PainelDosCriterios({ id, aberto, celular, aoFechar, erro, ...resto }: { id: string; aberto: boolean; celular: boolean; aoFechar: () => void; /** O que falta para buscar: na folha do celular, fica nela (a barra com o erro está atrás dela). */ erro?: string | null } & Omit<Parameters<typeof ConteudoDosCriterios>[0], 'aoFechar' | 'erro'>): ReactNode {
  const titulo = useId();
  if (!aberto) return null;
  if (celular) {
    return (
      <Dialog open onOpenChange={(a) => { if (!a) aoFechar(); }}>
        <DialogContent showCloseButton={false} id={id} aria-describedby={undefined} className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none">
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <DialogTitle className="mr-auto text-lg">Critérios de pesquisa</DialogTitle>
            <DialogDescription className="sr-only">Escolha onde o texto procura e os filtros da busca.</DialogDescription>
            <Button type="button" variant="discreto" size="icon" aria-label="Fechar os critérios" onClick={aoFechar}><X aria-hidden /></Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col"><ConteudoDosCriterios {...resto} erro={erro} aoFechar={aoFechar} /></div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <section id={id} role="region" aria-labelledby={titulo} className="rounded-xl border border-linha bg-superficie shadow-apoiada">
      <h2 id={titulo} className="sr-only">Critérios de pesquisa</h2>
      <ConteudoDosCriterios {...resto} aoFechar={aoFechar} />
    </section>
  );
}
