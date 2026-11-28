import { useQuery } from '@tanstack/react-query';
import { LIMITE_DO_LOTE, type LinhaDaBusca } from 'contratos';
import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import { consultaPostos } from '@/api/militares';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Selecao as Lista } from '@/componentes/Selecao';
import { agruparSelecionados, type AgruparPor } from '@/lib/agrupar-selecionados';
import { montarArvore, todosOsNos } from '@/lib/arvore-de-unidades';
import { useEhCelular } from '@/lib/useEhCelular';
import { AtualizarEmLote } from './AtualizarEmLote';
import { useSelecao } from './Selecao';

const AGRUPAR: [AgruparPor, string][] = [['nenhum', 'Sem grupo'], ['unidade', 'Unidade'], ['equipe', 'Equipe'], ['posto', 'Posto']];
const VAZIO_DE_UNIDADES: never[] = [];

/** A orientação do painel vazio (o painel fica à vista para quem tem nível de acesso, mesmo sem ninguém dentro). */
export const ORIENTACAO_DOS_SELECIONADOS = 'Marque militares na lista para juntá-los aqui. A seleção fica mesmo quando você muda a busca.';

/**
 * O conteúdo do painel "Selecionados" (6.63): o título com a quantidade, "Agrupar por", a lista (a matrícula na frente do nome, em coluna) e "Atualizar em lote" embaixo.
 * O agrupamento vale só para o painel. Na lista agrupada por unidade, a lotação sai da linha: ela já está no título do grupo.
 */
function ConteudoDosSelecionados({ aoAtualizarEmLote, idDoTitulo, aoFechar }: { aoAtualizarEmLote: () => void; idDoTitulo: string; aoFechar?: () => void }) {
  const { selecionados, aviso, tirar, limpar } = useSelecao();
  const [agrupar, setAgrupar] = useState<AgruparPor>('unidade');
  const unidades = useQuery(consultaUnidadesDaBusca);
  const postos = useQuery({ ...consultaPostos, enabled: agrupar === 'posto' });
  const ordem = useMemo(() => ({
    unidades: todosOsNos(montarArvore(unidades.data ?? VAZIO_DE_UNIDADES, unidades.data ?? VAZIO_DE_UNIDADES)).map((n) => n.id),
    postos: [...(postos.data ?? [])].sort((a, b) => a.ordem - b.ordem).map((p) => p.sigla),
  }), [unidades.data, postos.data]);
  const grupos = useMemo(() => agruparSelecionados(selecionados, agrupar, ordem), [selecionados, agrupar, ordem]);
  // "Selecionar todos" (6.54) pode passar do que o lote aceita: avisa aqui, em vez de a API recusar depois de a pessoa preencher tudo
  const passouDoLote = selecionados.length > LIMITE_DO_LOTE;
  const porUnidade = agrupar === 'unidade';
  const linha = (s: LinhaDaBusca) => (
    <li key={s.id} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 pr-1.5 pl-4 hover:bg-passa">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="w-17 shrink-0 text-apoio tabular-nums text-apagado">{s.matricula}</span>
        <span className="shrink-0 font-cond text-apoio font-medium text-apagado">{s.postoGrad}</span>
        <b className="truncate font-cond text-base font-semibold">{s.nomeGuerra}</b>
        {/* o caminho longo corta com reticências; o nome não encolhe */}
        {!porUnidade && <span title={s.lotacaoCaminho ?? s.lotacao ?? undefined} className="ml-auto min-w-0 truncate font-cond text-apoio font-medium text-apagado">{s.lotacao ?? 'Sem lotação'}</span>}
      </span>
      <Button type="button" variant="discreto" size="icon-sm" aria-label={`Tirar ${s.postoGrad} ${s.nomeGuerra}`} onClick={() => tirar(s.id)}>
        <X aria-hidden />
      </Button>
    </li>
  );
  return (
    <>
      <div className="flex items-center gap-2 border-b border-linha py-2.5 pr-2 pl-4">
        <h2 id={idDoTitulo} className="mr-auto font-cond text-xl font-semibold">{`Selecionados (${selecionados.length})`}</h2>
        {selecionados.length > 0 && <Button type="button" variant="discreto" onClick={limpar}>Limpar</Button>}
        {aoFechar && <Button type="button" variant="discreto" size="icon" aria-label="Fechar" onClick={aoFechar}><X aria-hidden /></Button>}
      </div>
      <label className="flex items-center gap-2 border-b border-linha px-4 py-2 text-apoio text-apagado">
        Agrupar por
        <Lista value={agrupar} onChange={(e) => setAgrupar(e.target.value as AgruparPor)} className="h-8 w-auto text-apoio">
          {AGRUPAR.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </Lista>
      </label>
      {aviso && <p role="status" className="border-b border-linha px-4 py-2 text-apoio text-pendencia">{aviso}</p>}
      {passouDoLote && <p className="border-b border-linha px-4 py-2 text-apoio text-apagado">{`A atualização em lote vai até ${LIMITE_DO_LOTE} militares. Tire alguns da seleção.`}</p>}
      {selecionados.length === 0 ? (
        <p className="p-4 text-apagado">{ORIENTACAO_DOS_SELECIONADOS}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {grupos.map((g) => (
            <section key={g.titulo ?? 'todos'} aria-label={g.titulo ?? 'Selecionados'}>
              {g.titulo && (
                <h3 className="sticky top-0 flex items-baseline gap-1.5 bg-superficie px-4 pt-2 pb-1 text-apoio font-semibold text-apagado">
                  {g.titulo}
                  <span className="font-normal">{g.linhas.length}</span>
                </h3>
              )}
              <ul>{g.linhas.map(linha)}</ul>
            </section>
          ))}
        </div>
      )}
      <div className="border-t border-linha px-4 py-3">
        <Button type="button" className="w-full" disabled={selecionados.length === 0 || passouDoLote} onClick={aoAtualizarEmLote}>Atualizar em lote</Button>
      </div>
    </>
  );
}

/**
 * O painel lateral "Selecionados" (6.63): sempre à vista para quem tem nível de acesso, mesmo vazio, parado enquanto a lista rola. No celular vira uma barra embaixo
 * ("{n} selecionados" e "Ver") que abre o painel numa folha. É a entrada da atualização em lote (6.52).
 */
export function PainelDeSelecionados() {
  const { selecionados, reler, releituraFalhou, aviso: avisoDoLimite } = useSelecao();
  const celular = useEhCelular();
  const titulo = useId();
  const [lote, setLote] = useState(false);
  const [folha, setFolha] = useState(false);
  // aplicou o lote: a seleção continua com os mesmos militares, com os dados lidos de novo, e a pesquisa e o Pecúlio buscam de novo (o que mudou já aparece)
  const fecharLote = (aplicou: boolean) => {
    setLote(false);
    if (aplicou) reler();
  };
  const aviso = releituraFalhou ? (
    <p role="status" className="border-b border-linha px-4 py-2 text-apoio text-pendencia">Não foi possível ler de novo os dados dos selecionados: a lotação mostrada pode estar desatualizada.</p>
  ) : null;
  const abrirLote = () => { setFolha(false); setLote(true); };
  const janelaDoLote = lote && <AtualizarEmLote aoFechar={fecharLote} />;
  if (celular) {
    return (
      <>
        {/* o aviso do limite e o da releitura ficam à vista também fora da folha */}
        {(avisoDoLimite || releituraFalhou) && <p role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-apoio text-pendencia">{avisoDoLimite ?? 'Não foi possível ler de novo os dados dos selecionados: a lotação mostrada pode estar desatualizada.'}</p>}
        <div className="sticky bottom-0 z-20 flex min-h-12 items-center gap-2 rounded-xl bg-tinta py-1.5 pr-1.5 pl-4 text-white shadow-por-cima">
          <b className="mr-auto font-cond text-lg font-semibold">{selecionados.length === 1 ? '1 selecionado' : `${selecionados.length} selecionados`}</b>
          <Button type="button" variant="secundario" onClick={() => setFolha(true)}>Ver</Button>
        </div>
        {folha && (
          <Dialog open onOpenChange={(a) => { if (!a) setFolha(false); }}>
            <DialogContent showCloseButton={false} aria-labelledby={titulo} className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none">
              <DialogTitle className="sr-only">Selecionados</DialogTitle>
              <DialogDescription className="sr-only">Os militares que você selecionou e a atualização em lote.</DialogDescription>
              {aviso}
              <ConteudoDosSelecionados idDoTitulo={titulo} aoAtualizarEmLote={abrirLote} aoFechar={() => setFolha(false)} />
            </DialogContent>
          </Dialog>
        )}
        {janelaDoLote}
      </>
    );
  }
  return (
    <>
      <aside aria-labelledby={titulo} className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl border border-linha bg-superficie shadow-apoiada">
        {aviso}
        <ConteudoDosSelecionados idDoTitulo={titulo} aoAtualizarEmLote={abrirLote} />
      </aside>
      {janelaDoLote}
    </>
  );
}
