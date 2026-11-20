import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mesPorExtenso, somarMeses, type Cota } from 'contratos';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemComCampo, mensagemDe } from '@/api/cliente';
import { atualizarCotas, consultaCotas, copiarCotas, criarCota, editarCota, removerCota } from '@/api/cotas';
import { consultaServicos } from '@/api/servicos';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/cotas')({
  component: Cotas,
});

const NOME_ORIGEM = { interna: 'Interna', externa: 'Externa' } as const;

function Cotas() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const cotas = useQuery(consultaCotas(eu.unidade.id, mes));
  const [dialogo, setDialogo] = useState<{ cota?: Cota } | null>(null);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const anterior = somarMeses(mes, -1);

  async function copiar() {
    setAviso(null);
    try {
      const { copiados, puladas } = await copiarCotas(eu.unidade.id, anterior, mes);
      atualizarCotas(queryClient);
      const deAntes = mesPorExtenso(anterior);
      const deFora = puladas === 1 ? '1 de serviço desativado ficou de fora.' : `${puladas} de serviço desativado ficaram de fora.`;
      let texto: string;
      if (copiados > 0) texto = `${copiados} ${copiados === 1 ? 'cota copiada' : 'cotas copiadas'} de ${deAntes}.${puladas > 0 ? ` ${deFora}` : ''}`;
      else if (puladas > 0) texto = `Nenhuma cota copiada: ${puladas === 1 ? 'a única' : `as ${puladas}`} de ${deAntes} ${puladas === 1 ? 'é' : 'são'} de serviço desativado.`;
      else texto = `Nenhuma cota nova: ${deAntes} não tem cotas, ou elas já estão em ${mesPorExtenso(mes)}.`;
      setAviso({ erro: false, texto });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  async function remover(c: Cota) {
    if (!window.confirm(`Remover a cota de ${c.servico} (${c.origem}) de ${mesPorExtenso(mes)}?`)) return;
    setAviso(null);
    try {
      await removerCota(c.id);
      atualizarCotas(queryClient);
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Cotas</h1>
        <div className="flex flex-wrap gap-2">
          <ImportarPlanilha cadastro="cotas" rotulo="as cotas" aoConcluir={() => atualizarCotas(queryClient)} />
          <Button variant="outline" onClick={() => void copiar()}>Copiar do mês anterior</Button>
          <Button onClick={() => setDialogo({})}>
            <Plus aria-hidden />
            Adicionar cota
          </Button>
        </div>
      </header>

      <div className="mt-6 rounded-xl border border-linha bg-superficie">
        <div className="flex flex-wrap items-end gap-4 border-b border-linha p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cotas-mes">Mês</Label>
            <CampoDeMes id="cotas-mes" valor={mes} aoMudar={setMes} />
          </div>
          <p className="pb-2 text-sm text-apagado">Destino: {eu.unidade.sigla}</p>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'pb-2 text-sm text-alerta' : 'pb-2 text-sm text-apagado'}>{aviso.texto}</p>}
        </div>

        {cotas.isPending && <p className="p-4 text-apagado">Carregando…</p>}
        {cotas.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(cotas.error)}</p>}
        {cotas.data && cotas.data.length === 0 && (
          <p className="p-4 text-apagado">Nenhuma cota em {mesPorExtenso(mes)}. Use "Adicionar cota" ou "Copiar do mês anterior".</p>
        )}
        {cotas.data && cotas.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-xs text-apagado">
                  <th className="px-4 py-2 font-normal">Prioridade</th>
                  <th className="px-4 py-2 font-normal">Serviço</th>
                  <th className="px-4 py-2 font-normal">Origem</th>
                  <th className="px-4 py-2 font-normal">Distribuídas</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {cotas.data.map((c) => <LinhaCota key={c.id} c={c} aoEditar={() => setDialogo({ cota: c })} aoRemover={() => void remover(c)} />)}
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
    </section>
  );
}

function LinhaCota({ c, aoEditar, aoRemover }: { c: Cota; aoEditar: () => void; aoRemover: () => void }) {
  const passou = c.distribuidas > c.quantidade;
  const nome = `${c.servico} (${c.origem})`;
  return (
    <tr className="border-b border-linha/60 last:border-0">
      <td className="px-4 py-2.5 font-cond text-base font-semibold">{c.prioridade}</td>
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-2">
          <QuadradoDaCor cor={c.cor} />
          <span className="font-medium">{c.servico}</span>
        </span>
      </td>
      <td className="px-4 py-2.5">{NOME_ORIGEM[c.origem]}</td>
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
        <span className="flex justify-end gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label={`Editar cota de ${nome}`} onClick={aoEditar}>
            <Pencil aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label={`Remover cota de ${nome}`} onClick={aoRemover}>
            <Trash2 aria-hidden />
          </Button>
        </span>
      </td>
    </tr>
  );
}

function CotaDialogo({ unidadeId, mes, cota, proximaPrioridade, aoFechar }: { unidadeId: string; mes: string; cota?: Cota; proximaPrioridade: number; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const servicos = useQuery(consultaServicos(unidadeId));
  // cota só existe para serviço PJES ou diária; o da cota que se edita entra mesmo se foi desativado
  const opcoes = (servicos.data ?? []).filter((s) => s.tipo !== 'ordinario' && (s.ativo || s.id === cota?.servicoId));
  const [servicoId, setServicoId] = useState(cota?.servicoId ?? '');
  const [origem, setOrigem] = useState<'interna' | 'externa'>(cota?.origem ?? 'interna');
  const [quantidade, setQuantidade] = useState(cota ? String(cota.quantidade) : '');
  const [prioridade, setPrioridade] = useState(String(cota?.prioridade ?? proximaPrioridade));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const escolhido = servicoId || opcoes[0]?.id || '';

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const dados = { servicoId: escolhido, quantidade: Number(quantidade), origem, prioridade: Number(prioridade) };
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
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cota ? 'Editar cota' : 'Adicionar cota'}</DialogTitle>
          <DialogDescription>Cota de {mesPorExtenso(mes)}. A prioridade 1 é preenchida primeiro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ct-servico">Serviço</Label>
            <Selecao id="ct-servico" value={escolhido} onChange={(e) => setServicoId(e.target.value)}>
              {opcoes.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
            {servicos.data && opcoes.length === 0 && <p className="text-xs text-alerta">Cadastre um serviço PJES ou diária na tela de Serviços.</p>}
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Origem</legend>
            <div className="flex gap-4 text-sm">
              {(['interna', 'externa'] as const).map((o) => (
                <label key={o} className="flex items-center gap-2">
                  <input type="radio" name="origem" checked={origem === o} onChange={() => setOrigem(o)} className="size-4 accent-vinho" />
                  {NOME_ORIGEM[o]}
                </label>
              ))}
            </div>
          </fieldset>
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
      </DialogContent>
    </Dialog>
  );
}
