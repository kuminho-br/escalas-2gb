import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mesPorExtenso, somarMeses, type Cota, type DiaDaCota } from 'contratos';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemComCampo, mensagemDe } from '@/api/cliente';
import { atualizarCotas, consultaCotas, copiarCotas, criarCota, editarCota, removerCota, trocarDiasDaCota } from '@/api/cotas';
import { consultaServicos } from '@/api/servicos';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
import { Selecao } from '@/componentes/Selecao';
import { useDescartarDigitado } from '@/componentes/DescartarDigitado';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { Moldura } from '@/componentes/Moldura';
import { useConfirmar } from '@/componentes/resposta/useConfirmar';
import { useAviso } from '@/componentes/resposta/useAviso';
import { Espera } from '@/componentes/resposta/Espera';
import { Vazio } from '@/componentes/resposta/Vazio';

export const Route = createFileRoute('/_app/cotas')({
  component: Cotas,
});

function Cotas() {
  const { eu } = Route.useRouteContext();
  // numa unidade só de consulta as cotas se veem e não se alteram: sem importar, copiar, adicionar, editar nem remover
  const soConsulta = eu.soConsulta;
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const cotas = useQuery(consultaCotas(eu.unidade.id, mes));
  const [dialogo, setDialogo] = useState<{ cota?: Cota } | null>(null);
  const [dosDias, setDosDias] = useState<Cota | null>(null);
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const anterior = somarMeses(mes, -1);

  const { salvando: copiando, travar } = useTrava();
  // travada: dois cliques seguidos mandam um pedido só, e o botão fica apagado enquanto copia
  const copiar = travar(async () => {
    try {
      const { copiados, puladas } = await copiarCotas(eu.unidade.id, anterior, mes);
      atualizarCotas(queryClient);
      const deAntes = mesPorExtenso(anterior);
      const deFora = puladas === 1 ? '1 de serviço desativado ficou de fora' : `${puladas} de serviço desativado ficaram de fora`;
      let texto: string;
      if (copiados > 0) texto = `${copiados} ${copiados === 1 ? 'cota copiada' : 'cotas copiadas'} de ${deAntes}.${puladas > 0 ? ` ${deFora}.` : ''}`;
      // só diz o que ficou de fora: o mês pode ter outras cotas que o destino já tinha, então não afirma que "todas" são de serviço desativado
      else if (puladas > 0) texto = `Nenhuma cota copiada: ${deFora}. Reative o serviço na tela de Turnos para ${puladas === 1 ? 'copiá-la' : 'copiá-las'}.`;
      else texto = `Nenhuma cota nova: ${deAntes} não tem cotas, ou elas já estão em ${mesPorExtenso(mes)}.`;
      avisar({ texto });
    } catch (err) {
      avisar({ texto: mensagemDe(err), erro: true });
    }
  });

  async function remover(c: Cota) {
    if (!(await confirmar({ titulo: 'Remover a cota?', texto: `Cota de ${c.servico} de ${mesPorExtenso(mes)}.`, verbo: 'Remover', perigoso: true }))) return;
    try {
      await removerCota(c.id);
      atualizarCotas(queryClient);
      avisar({ texto: `Cota de ${c.servico} removida.` });
    } catch (err) {
      avisar({ texto: mensagemDe(err), erro: true });
    }
  }

  return (
    <Moldura
      titulo="Cotas"
      acaoPrincipal={
        <>
          {!soConsulta && (
              <div className="flex flex-wrap gap-2">
                <ImportarPlanilha cadastro="cotas" rotulo="as cotas" aoConcluir={() => atualizarCotas(queryClient)} />
                <Button variant="secundario" disabled={copiando} onClick={() => void copiar()}>Copiar do mês anterior</Button>
                <Button onClick={() => setDialogo({})}>
                  <Plus aria-hidden />
                  Adicionar cota
                </Button>
              </div>
            )}
        </>
      }
    >

      <div className="rounded-xl border border-linha bg-superficie">
        <div className="flex flex-wrap items-end gap-4 border-b border-linha p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cotas-mes">Mês</Label>
            <CampoDeMes id="cotas-mes" valor={mes} aoMudar={setMes} />
          </div>
          {/* o destino é de quem grava (adicionar e copiar); na consulta não há nada para gravar */}
          {!soConsulta && <p className="pb-2 text-sm text-apagado">Destino: {eu.unidade.sigla}</p>}
        </div>

        {cotas.isPending && <Espera className="p-4" />}
        {cotas.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(cotas.error)}</p>}
        {cotas.data && cotas.data.length === 0 && (
          <div className="px-4">
            <Vazio titulo={`Nenhuma cota em ${mesPorExtenso(mes)}`} frase={soConsulta ? 'Não há cotas neste mês.' : 'Adicione uma cota ou copie as do mês anterior, pelos botões do alto.'} />
          </div>
        )}
        {cotas.data && cotas.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-apagado">
                  <th className="px-4 py-2 font-normal">Prioridade</th>
                  <th className="px-4 py-2 font-normal">Serviço</th>
                  <th className="px-4 py-2 font-normal">Distribuídas</th>
                  <th className="px-4 py-2 font-normal">Dias</th>
                  {!soConsulta && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {cotas.data.map((c) => <LinhaCota key={c.id} c={c} aoEditar={soConsulta ? undefined : () => setDialogo({ cota: c })} aoRemover={soConsulta ? undefined : () => void remover(c)} aoVerDias={soConsulta ? undefined : () => setDosDias(c)} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dialogo && (
        <CotaDialogo
          key={dialogo.cota?.id ?? 'nova'}
          unidadeId={eu.unidade.id}
          mes={mes}
          cota={dialogo.cota}
          proximaPrioridade={Math.max(0, ...(cotas.data ?? []).map((c) => c.prioridade)) + 1}
          aoFechar={() => setDialogo(null)}
        />
      )}
      {dosDias && <DiasDialogo key={dosDias.id} cota={dosDias} aoFechar={() => setDosDias(null)} />}
    </Moldura>
  );
}

/** Sem `aoEditar` e `aoRemover` (unidade só de consulta) a linha não tem a coluna dos botões. */
function LinhaCota({ c, aoEditar, aoRemover, aoVerDias }: { c: Cota; aoEditar?: () => void; aoRemover?: () => void; aoVerDias?: () => void }) {
  const passou = c.distribuidas > c.quantidade;
  const nome = c.servico;
  return (
    <tr className="border-b border-linha/60 last:border-0">
      <td className="px-4 py-2.5 font-cond text-base font-semibold">{c.prioridade}</td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-2">
          <QuadradoDaCor cor={c.cor} />
          <span className="font-medium">{c.servico}</span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`Distribuídas de ${c.servico}`}
            aria-valuemin={0}
            aria-valuemax={c.quantidade}
            aria-valuenow={Math.min(c.distribuidas, c.quantidade)}
            aria-valuetext={passou ? `${c.distribuidas} de ${c.quantidade}: passou da cota` : undefined}
            className="h-2 w-40 overflow-hidden rounded-full bg-fundo"
          >
            <div
              className={passou ? 'h-full bg-alerta' : 'h-full'}
              style={{ width: `${Math.min(100, (c.distribuidas / c.quantidade) * 100)}%`, backgroundColor: passou ? undefined : c.cor }}
            />
          </div>
          <span className={passou ? 'font-medium text-alerta' : ''}>{c.distribuidas} de {c.quantidade}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-apagado">{c.dias.length === 0 ? 'Só o total' : `${c.dias.length} ${c.dias.length === 1 ? 'dia' : 'dias'} com meta`}</span>
          {aoVerDias && (
            <Button type="button" size="sm" variant="secundario" aria-label={`Dias da cota de ${c.servico}`} onClick={aoVerDias}>
              Dias da cota
            </Button>
          )}
        </div>
      </td>
      {aoEditar && aoRemover && (
        <td className="px-4 py-2.5">
          <span className="flex justify-end gap-1">
            <Button type="button" size="icon" variant="discreto" aria-label={`Editar cota de ${nome}`} onClick={aoEditar}>
              <Pencil aria-hidden />
            </Button>
            <Button type="button" size="icon" variant="discreto" aria-label={`Remover cota de ${nome}`} onClick={aoRemover}>
              <Trash2 aria-hidden />
            </Button>
          </span>
        </td>
      )}
    </tr>
  );
}

function CotaDialogo({ unidadeId, mes, cota, proximaPrioridade, aoFechar }: { unidadeId: string; mes: string; cota?: Cota; proximaPrioridade: number; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const descarte = useDescartarDigitado(aoFechar);
  const servicos = useQuery(consultaServicos(unidadeId));
  // cota só existe para serviço PJES ou diária; o da cota que se edita entra mesmo se foi desativado
  const opcoes = (servicos.data ?? []).filter((s) => s.tipo !== 'ordinario' && (s.ativo || s.id === cota?.servicoId));
  const [servicoId, setServicoId] = useState(cota?.servicoId ?? '');
  const [quantidade, setQuantidade] = useState(cota ? String(cota.quantidade) : '');
  const [prioridade, setPrioridade] = useState(String(cota?.prioridade ?? proximaPrioridade));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const escolhido = servicoId || opcoes[0]?.id || '';

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const dados = { servicoId: escolhido, quantidade: Number(quantidade), prioridade: Number(prioridade) };
    try {
      if (cota) await editarCota(cota.id, dados);
      else await criarCota(unidadeId, { mes, ...dados });
      atualizarCotas(queryClient);
      aoFechar();
    } catch (err) {
      setErro(mensagemComCampo(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={descarte.aoMudarAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cota ? 'Editar cota' : 'Adicionar cota'}</DialogTitle>
          <DialogDescription>Cota de {mesPorExtenso(mes)}. A prioridade 1 é preenchida primeiro.</DialogDescription>
        </DialogHeader>
        <form ref={descarte.ref} onSubmit={salvar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ct-servico">Serviço</Label>
            <Selecao id="ct-servico" value={escolhido} onChange={(e) => setServicoId(e.target.value)}>
              {opcoes.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
            {servicos.data && opcoes.length === 0 && <p className="text-xs text-alerta">Cadastre um serviço PJES ou diária na tela de Turnos.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ct-quantidade">Quantidade</Label>
              <Input id="ct-quantidade" type="number" min={1} max={10000} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ct-prioridade">Prioridade</Label>
              <Input id="ct-prioridade" type="number" min={1} max={1000} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} required />
            </div>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando || !escolhido}>Salvar</Button>
          </DialogFooter>
        </form>
        {descarte.confirmacao}
      </DialogContent>
    </Dialog>
  );
}

/** O último dia do mês 'aaaa-mm', como 'aaaa-mm-dd' (limite do campo de data). */
const ultimoDiaDoMes = (mes: string) => `${mes}-${String(new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;

type LinhaDoDia = { chave: number; data: string; minimo: string; maximo: number | null };

/**
 * Os dias da cota (6.72): cada linha é um dia do mês com a meta (o mínimo de militares naquele dia). O resto do total vale nos outros dias. O máximo do dia fica
 * no banco e na regra, sem tela por agora: ao salvar, o que já estava gravado volta igual. A recusa da API fica na janela, com o que foi digitado.
 */
function DiasDialogo({ cota, aoFechar }: { cota: Cota; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const descarte = useDescartarDigitado(aoFechar);
  const [linhas, setLinhas] = useState<LinhaDoDia[]>(() => cota.dias.map((d: DiaDaCota, i) => ({ chave: i, data: d.data, minimo: String(d.minimo), maximo: d.maximo })));
  const [proxima, setProxima] = useState(cota.dias.length);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const soma = linhas.reduce((total, l) => total + (Number(l.minimo) || 0), 0);

  const mudar = (chave: number, campo: 'data' | 'minimo', valor: string) => setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  const acrescentar = () => {
    setLinhas((atuais) => [...atuais, { chave: proxima, data: '', minimo: '1', maximo: null }]);
    setProxima((n) => n + 1);
  };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await trocarDiasDaCota(cota.id, linhas.filter((l) => l.data).map((l) => ({ data: l.data, minimo: Number(l.minimo), maximo: l.maximo })).sort((a, b) => a.data.localeCompare(b.data)));
      atualizarCotas(queryClient);
      aoFechar();
    } catch (err) {
      setErro(mensagemComCampo(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={descarte.aoMudarAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dias da cota de {cota.servico}</DialogTitle>
          <DialogDescription>
            Cota de {mesPorExtenso(cota.mes)}: {cota.quantidade}. Em cada dia, a meta é o mínimo de militares. O resto da cota vale nos outros dias.
          </DialogDescription>
        </DialogHeader>
        <form ref={descarte.ref} onSubmit={salvar} className="grid gap-3">
          {linhas.length === 0 && <p className="text-sm text-apagado">Nenhum dia com meta: vale só o total do mês.</p>}
          <ul className="grid gap-2">
            {linhas.map((l, i) => (
              <li key={l.chave} className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`dia-${l.chave}`} className="text-xs text-apagado">Dia</Label>
                  <Input id={`dia-${l.chave}`} type="date" min={`${cota.mes}-01`} max={ultimoDiaDoMes(cota.mes)} value={l.data} onChange={(e) => mudar(l.chave, 'data', e.target.value)} aria-label={`Dia ${i + 1}`} required />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`meta-${l.chave}`} className="text-xs text-apagado">Meta</Label>
                  <Input id={`meta-${l.chave}`} type="number" min={1} max={10000} value={l.minimo} onChange={(e) => mudar(l.chave, 'minimo', e.target.value)} aria-label={`Meta do dia ${i + 1}`} required />
                </div>
                <Button type="button" size="icon" variant="discreto" aria-label={`Tirar o dia ${i + 1}`} onClick={() => setLinhas((atuais) => atuais.filter((x) => x.chave !== l.chave))}>
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="secundario" size="sm" onClick={acrescentar}>
              <Plus aria-hidden />
              Adicionar dia
            </Button>
            {linhas.length > 0 && <span className={soma > cota.quantidade ? 'text-sm font-medium text-alerta' : 'text-sm text-apagado'}>Metas: {soma} de {cota.quantidade}</span>}
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando}>Salvar</Button>
          </DialogFooter>
        </form>
        {descarte.confirmacao}
      </DialogContent>
    </Dialog>
  );
}
