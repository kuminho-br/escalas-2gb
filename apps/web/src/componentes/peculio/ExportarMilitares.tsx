import { useQuery } from '@tanstack/react-query';
import { COLUNAS_DA_EXPORTACAO, LIMITE_DA_BUSCA_SEM_CORTE, type FiltrosDaBusca, type PedidoDeExportacao } from 'contratos';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { baixarArquivo, ErroApi, mensagemDe } from '@/api/cliente';
import { buscarTodos, consultaDaBuscaComFiltros } from '@/api/consulta';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Radio } from '@/componentes/ui/radio';
import { hoje } from '@/lib/meses';
import { useSelecao } from './Selecao';

/** A busca passou do que a exportação aceita de uma vez: a contagem não vem, e a frase diz o que fazer. */
export const MSG_BUSCA_PASSOU = `A busca passou de ${LIMITE_DA_BUSCA_SEM_CORTE} militares: refine os critérios para ver a contagem.`;
const mensagemDaContagem = (e: unknown) => (e instanceof ErroApi && e.status === 400 && e.message.startsWith('Mais de') ? MSG_BUSCA_PASSOU : mensagemDe(e));

type OQueSai = 'selecionados' | 'busca' | 'juntos';
const ROTULOS = COLUNAS_DA_EXPORTACAO.map((c) => c.rotulo);
// a matrícula é a chave da importação: sai sempre, e a janela não a deixa desmarcar
const MATRICULA = 'MATRÍCULA';
// o que já vem marcado: a identificação do militar (o resto a pessoa escolhe)
const INICIAIS = COLUNAS_DA_EXPORTACAO.filter((c) => c.bloco === 'identificacao').map((c) => c.rotulo);

/**
 * "Exportar" (6.54), em Pesquisar militares: baixa um .xlsx com as colunas da importação do Pecúlio (para corrigir no Excel e importar de volta). Sai a busca inteira (sem o corte de
 * 500), a seleção ou as duas juntas, sem repetir; a janela só pergunta quando há as duas. `filtros` é a busca em vigor (null: sem busca feita). Só quem tem nível de acesso a vê.
 * Fica no alto, ao lado do título (6.63); sem busca e sem seleção, desabilitado.
 */
export function ExportarMilitares({ filtros }: { filtros: FiltrosDaBusca | null }) {
  const { selecionados } = useSelecao();
  const [aberta, setAberta] = useState(false);
  // a mesma busca que a lista mostra (o cache é um só): diz se há resultado para exportar
  const mostrada = useQuery({ ...consultaDaBuscaComFiltros(filtros ?? {}), enabled: filtros !== null });
  const temBusca = filtros !== null && (mostrada.data?.militares.length ?? 0) > 0;
  // 6.63: o botão fica sempre no mesmo lugar (ao lado do título); sem busca e sem seleção, não há o que exportar e ele diz isso
  const nada = !temBusca && selecionados.length === 0;
  return (
    <>
      <Button type="button" variant="secundario" disabled={nada} title={nada ? 'Faça uma busca ou selecione militares para exportar.' : undefined} onClick={() => setAberta(true)}>
        <FileSpreadsheet aria-hidden />
        Exportar
      </Button>
      {aberta && !nada && <Janela filtros={temBusca ? filtros : null} aoFechar={() => setAberta(false)} />}
    </>
  );
}

function Janela({ filtros, aoFechar }: { filtros: FiltrosDaBusca | null; aoFechar: () => void }) {
  const { selecionados } = useSelecao();
  const idsSelecionados = selecionados.map((s) => s.id);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(INICIAIS));
  const [escolha, setEscolha] = useState<OQueSai | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // a lista inteira do filtro (sem o corte de 500) dá as contagens da busca e dos dois juntos
  const inteira = useQuery({ queryKey: ['consulta', 'militares', 'todos', filtros], queryFn: () => buscarTodos(filtros!), enabled: filtros !== null });
  const idsDaBusca = inteira.data?.militares.map((m) => m.id) ?? [];
  const juntos = new Set([...idsSelecionados, ...idsDaBusca]).size;
  const pergunta = filtros !== null && idsSelecionados.length > 0;
  const saida: OQueSai = escolha ?? (idsSelecionados.length > 0 ? 'selecionados' : 'busca');
  const alternar = (c: string) => setMarcadas((a) => { const n = new Set(a); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const carregando = filtros !== null && saida !== 'selecionados' && inteira.isPending;
  const semAlguem = saida === 'selecionados' ? idsSelecionados.length === 0 : saida === 'busca' ? idsDaBusca.length === 0 : juntos === 0;
  const baixar = async () => {
    setOcupado(true);
    setErro(null);
    const colunas = ROTULOS.filter((r) => marcadas.has(r) || r === MATRICULA);
    const pedido: PedidoDeExportacao = {
      ...(saida !== 'selecionados' && filtros ? { filtros } : {}),
      ...(saida !== 'busca' && idsSelecionados.length > 0 ? { ids: idsSelecionados } : {}),
      colunas,
    };
    try {
      await baixarArquivo('/api/consulta/militares/exportar', pedido, `militares-${hoje()}.xlsx`);
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Dialog open onOpenChange={(a) => { if (!a && !ocupado) aoFechar(); }}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar para Excel</DialogTitle>
          <DialogDescription>A planilha tem as colunas da importação do Pecúlio: dá para corrigir no Excel e importar de volta.</DialogDescription>
        </DialogHeader>

        {pergunta && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-cond text-base font-semibold">O que sai</legend>
            {([
              ['selecionados', `Selecionados (${idsSelecionados.length})`],
              ['busca', 'Resultado da busca', inteira.data ? idsDaBusca.length : null],
              ['juntos', 'Os dois juntos, sem repetir', inteira.data ? juntos : null],
            ] as const).map(([valor, rotulo, n]) => (
              <label key={valor} className="flex items-center gap-2 text-corpo">
                <Radio name="exportar-o-que-sai" checked={saida === valor} onChange={() => setEscolha(valor)} />
                {/* a contagem só vem quando a lista inteira da busca chega; se a busca passou de 5000, a frase diz por que ela não vem */}
                {valor === 'selecionados' ? rotulo : n !== null ? `${rotulo} (${n})` : inteira.isError ? `${rotulo} (sem contagem)` : `${rotulo} (…)`}
              </label>
            ))}
            {inteira.isError && saida === 'selecionados' && <p className="text-apoio text-apagado">{mensagemDaContagem(inteira.error)}</p>}
          </fieldset>
        )}

        <fieldset className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <legend className="font-cond text-base font-semibold">Campos</legend>
            <Button type="button" variant="discreto" size="sm" onClick={() => setMarcadas(new Set(ROTULOS))}>Marcar todos</Button>
          </div>
          <div className="grid max-h-64 gap-x-4 gap-y-2 overflow-y-auto sm:grid-cols-2">
            {ROTULOS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-corpo">
                <Checkbox checked={marcadas.has(r) || r === MATRICULA} disabled={r === MATRICULA} onChange={() => alternar(r)} />
                {r}
              </label>
            ))}
          </div>
          <p className="text-apoio text-apagado">Sem a matrícula, o arquivo não volta para o sistema.</p>
          <p className="text-apoio text-apagado">Os campos que você não vê na ficha de um militar saem vazios.</p>
        </fieldset>

        {inteira.error && saida !== 'selecionados' && <p role="alert" className="text-sm text-alerta">{mensagemDaContagem(inteira.error)}</p>}
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="secundario" onClick={aoFechar} disabled={ocupado}>Cancelar</Button>
          <Button type="button" disabled={ocupado || carregando || semAlguem || (inteira.isError && saida !== 'selecionados')} onClick={() => void baixar()}>
            {ocupado ? 'Baixando…' : 'Baixar planilha'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
