import { useQuery } from '@tanstack/react-query';
import type { NoDaArvore, UnidadeDeTrabalho } from 'contratos';
import { ChevronRight, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEstrutura, consultaTiposDeUnidade } from '@/api/estrutura';
import { ExcluirUnidade, ExtinguirUnidade, MoverUnidade, NovaUnidadeAbaixo, RenomearUnidade } from '@/componentes/configuracoes/AcoesDaEstrutura';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/componentes/ui/dropdown-menu';
import { Espera } from '@/componentes/resposta/Espera';

type Acao = { qual: 'nova' | 'renomear' | 'mover' | 'extinguir' | 'excluir'; no: NoDaArvore };

const total = (no: NoDaArvore): number => 1 + no.filhas.reduce((n, f) => n + total(f), 0);
/** Uma árvore grande abre só até a segunda linha de baixo; uma pequena abre inteira. */
function recolhidasNoComeco(raiz: NoDaArvore): Set<string> {
  const fechadas = new Set<string>();
  if (total(raiz) <= 40) return fechadas;
  const percorrer = (no: NoDaArvore, profundidade: number) => {
    if (profundidade >= 2 && no.filhas.length) fechadas.add(no.id);
    no.filhas.forEach((f) => percorrer(f, profundidade + 1));
  };
  percorrer(raiz, 0);
  return fechadas;
}

const lotados = (n: number) => `${n} ${n === 1 ? 'lotado' : 'lotados'}`;
/** Excluir só existe para a unidade sem nada ligado: nem filhas (ainda que extintas), nem militares, nem histórico. */
const semNadaLigado = (no: NoDaArvore) => no.ligados.unidades === 0 && no.ligados.militaresHoje === 0 && no.ligados.historico.length === 0;

/**
 * A árvore de unidades (entrega 6.25), editável: cada unidade mostra sigla, nome, tipo e quantos militares estão lotados nela hoje, e o menu da linha
 * traz só o que a pessoa pode fazer. O administrador edita tudo; o gestor, da sua unidade para baixo; quem só tem nível de auxiliar vê.
 */
export function Estrutura({ raizes }: { raizes: UnidadeDeTrabalho[] }) {
  const [raizId, setRaizId] = useState(raizes[0]?.id);
  const { data: arvore, error, isPending } = useQuery(consultaEstrutura(raizId));
  const tipos = useQuery(consultaTiposDeUnidade);
  const [acao, setAcao] = useState<Acao | null>(null);
  // as unidades recolhidas pela pessoa; o começo depende do tamanho da árvore
  const [fechadas, setFechadas] = useState<{ raiz: string; ids: Set<string> } | null>(null);

  const seletor = raizes.length > 1 && (
    <div className="mb-4 max-w-xs">
      <Campo id="estrutura-raiz" rotulo="Árvore de">
        <Selecao id="estrutura-raiz" value={raizId} onChange={(e) => { setAcao(null); setFechadas(null); setRaizId(e.target.value); }}>
          {raizes.map((r) => <option key={r.id} value={r.id}>{r.sigla}</option>)}
        </Selecao>
      </Campo>
    </div>
  );
  if (isPending) return <>{seletor}<Espera className="py-6" /></>;
  if (error) return <>{seletor}<p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p></>;

  const recolhidas = fechadas?.raiz === arvore.id ? fechadas.ids : recolhidasNoComeco(arvore);
  const alternar = (id: string) => {
    const novas = new Set(recolhidas);
    if (!novas.delete(id)) novas.add(id);
    setFechadas({ raiz: arvore.id, ids: novas });
  };

  const linha = (no: NoDaArvore, profundidade: number) => {
    const aberta = !recolhidas.has(no.id);
    const temFilhas = no.filhas.length > 0;
    const podeMexer = no.podeEditar || no.podeReorganizar;
    return (
      <li key={no.id} data-sigla={no.sigla}>
        <div className="group flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md py-1.5 pr-1 pl-1 hover:bg-fundo/70">
          {temFilhas ? (
            <Button type="button" variant="discreto" size="icon-sm" aria-expanded={aberta} aria-label={`${aberta ? 'Recolher' : 'Abrir'} ${no.sigla}`} onClick={() => alternar(no.id)}>
              <ChevronRight aria-hidden className={`size-4 transition-transform ${aberta ? 'rotate-90' : ''}`} />
            </Button>
          ) : <span aria-hidden className="size-8 shrink-0" />}
          <span className={`font-cond text-nome font-semibold ${profundidade === 0 ? 'text-vinho' : ''}`}>{no.sigla}</span>
          <span className="min-w-0 flex-[1_1_9rem] truncate text-sm text-apagado">{no.nome}</span>
          <span className="rounded border border-linha px-1.5 text-apoio text-apagado">{no.tipo.nome}</span>
          {no.ligados.militaresNaArvore > 0 && (
            // o número soma os lotados na unidade e em todas as de baixo; a dica diz quantos estão lotados nela mesma
            <span className="text-apoio text-apagado" title={`${lotados(no.ligados.militaresHoje)} aqui`}>{lotados(no.ligados.militaresNaArvore)}</span>
          )}
          {no.ate && <span className="text-apoio text-alerta">{`até ${no.ate.split('-').reverse().join('/')}`}</span>}
          {podeMexer ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="discreto" size="icon-sm" className="ml-auto" aria-label={`Ações de ${no.sigla}`}><Ellipsis aria-hidden className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {no.podeEditar && <DropdownMenuItem onSelect={() => setAcao({ qual: 'nova', no })}>Nova unidade abaixo</DropdownMenuItem>}
                {no.podeEditar && <DropdownMenuItem onSelect={() => setAcao({ qual: 'renomear', no })}>Renomear</DropdownMenuItem>}
                {no.podeReorganizar && <DropdownMenuItem onSelect={() => setAcao({ qual: 'mover', no })}>Mover para…</DropdownMenuItem>}
                {no.podeReorganizar && <DropdownMenuItem onSelect={() => setAcao({ qual: 'extinguir', no })}>Extinguir</DropdownMenuItem>}
                {no.podeReorganizar && semNadaLigado(no) && <DropdownMenuItem variant="destructive" onSelect={() => setAcao({ qual: 'excluir', no })}>Excluir</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : <span aria-hidden className="ml-auto" />}
        </div>
        {temFilhas && aberta && (
          <ul aria-label={`Dentro de ${no.sigla}`} className="ml-4 border-l border-linha pl-2">
            {no.filhas.map((f) => linha(f, profundidade + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-3xl">
      {seletor}
      <div className="rounded-xl border border-linha bg-superficie">
        <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
          As unidades de <strong className="text-tinta">{arvore.sigla}</strong> para baixo. {arvore.podeEditar ? 'O menu de cada linha mostra o que você pode fazer nela.' : 'Você só consulta: quem muda a estrutura é o gestor.'}
        </p>
        <ul aria-label={`Estrutura de ${arvore.sigla}`} className="p-2">{linha(arvore, 0)}</ul>
      </div>
      {acao?.qual === 'nova' && <NovaUnidadeAbaixo no={acao.no} tipos={tipos.data ?? []} aoFechar={() => setAcao(null)} />}
      {acao?.qual === 'renomear' && <RenomearUnidade no={acao.no} tipos={tipos.data ?? []} aoFechar={() => setAcao(null)} />}
      {acao?.qual === 'mover' && <MoverUnidade no={acao.no} arvore={arvore} aoFechar={() => setAcao(null)} />}
      {acao?.qual === 'extinguir' && <ExtinguirUnidade no={acao.no} aoFechar={() => setAcao(null)} />}
      {acao?.qual === 'excluir' && <ExcluirUnidade no={acao.no} aoFechar={() => setAcao(null)} />}
    </div>
  );
}
