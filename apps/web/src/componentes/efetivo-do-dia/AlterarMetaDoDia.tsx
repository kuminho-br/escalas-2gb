import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { gravarMetaDoDia } from '@/api/efetivo-do-dia';
import { mensagemComCampo } from '@/api/cliente';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { dataPorExtenso } from '@/lib/meses';

type Modelo = { id: string; nome: string; ativa: boolean };

/**
 * "Alterar a meta deste dia": marca os modelos de guarnição que devem ser ativados e põe na ordem de ativação (Subir e Descer).
 * "Até" repete a mesma meta nos dias seguintes (no máximo 31 dias, contando este). O que já está na meta fica marcado, mesmo desativado.
 */
export function AlterarMetaDoDia({ unidadeId, data, atuais, aoFechar }: { unidadeId: string; data: string; atuais: { guarnicaoId: string; nome: string }[]; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const modelos = useQuery(consultaGuarnicoes(unidadeId, data.slice(0, 7)));
  const [escolhidos, setEscolhidos] = useState<string[]>(atuais.map((g) => g.guarnicaoId));
  const [ate, setAte] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

  // os modelos ativos da seção e, se já estão na meta, os que foram desativados depois (para poderem sair dela)
  const jaNaMeta = new Set(atuais.map((g) => g.guarnicaoId));
  const opcoes: Modelo[] = [
    ...(modelos.data ?? []).filter((m) => m.ativa || jaNaMeta.has(m.id)).map((m) => ({ id: m.id, nome: m.nome, ativa: m.ativa })),
    ...atuais.filter((g) => !modelos.data?.some((m) => m.id === g.guarnicaoId)).map((g) => ({ id: g.guarnicaoId, nome: g.nome, ativa: true })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const nomeDe = (id: string) => opcoes.find((o) => o.id === id)?.nome ?? '';

  const alternar = (id: string) => setEscolhidos((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const mover = (i: number, passo: -1 | 1) =>
    setEscolhidos((e) => {
      const novo = [...e];
      [novo[i], novo[i + passo]] = [novo[i + passo]!, novo[i]!];
      return novo;
    });

  const salvar = travar(async () => {
    setErro(null);
    try {
      await gravarMetaDoDia(queryClient, unidadeId, data, { ...(ate ? { ate } : {}), guarnicoes: escolhidos });
      aoFechar();
    } catch (e) {
      setErro(mensagemComCampo(e));
    }
  });

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Alterar a meta deste dia</DialogTitle>
          <DialogDescription>{dataPorExtenso(data)}. Marque os modelos de guarnição que devem ser ativados e ponha na ordem de ativação.</DialogDescription>
        </DialogHeader>
        {modelos.isPending && <p className="text-apagado">Carregando…</p>}
        {modelos.error && <p role="alert" className="text-alerta">Não foi possível carregar os modelos de guarnição.</p>}
        {modelos.data && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              {opcoes.length === 0 && <p className="text-sm text-apagado">Nenhum modelo de guarnição ativo. Cadastre em Configurações.</p>}
              {opcoes.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={escolhidos.includes(o.id)} onChange={() => alternar(o.id)} className="size-4 accent-vinho" />
                  <span>{o.nome}</span>
                  {!o.ativa && <span className="text-xs text-apagado">desativado</span>}
                </label>
              ))}
            </div>
            {escolhidos.length > 0 && (
              <ol aria-label="Ordem de ativação" className="grid gap-1 rounded-lg border border-linha p-2">
                {escolhidos.map((id, i) => (
                  <li key={id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center font-cond text-lg font-semibold">{i + 1}º</span>
                    <span className="flex-1">{nomeDe(id)}</span>
                    <Button type="button" variant="outline" size="sm" aria-label={`Subir ${nomeDe(id)}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                      <ArrowUp aria-hidden /> Subir
                    </Button>
                    <Button type="button" variant="outline" size="sm" aria-label={`Descer ${nomeDe(id)}`} disabled={i === escolhidos.length - 1} onClick={() => mover(i, 1)}>
                      <ArrowDown aria-hidden /> Descer
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="meta-ate">Até</Label>
              <Input id="meta-ate" type="date" min={data} value={ate} onChange={(e) => setAte(e.target.value)} className="w-44" />
              <p className="text-sm text-apagado">Opcional: repete esta meta nos dias seguintes, até 31 dias contando este.</p>
            </div>
            {escolhidos.length === 0 && <p className="text-sm text-apagado">Sem nenhum modelo marcado, o dia fica sem meta.</p>}
          </div>
        )}
        {erro && <p role="alert" className="text-alerta">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" disabled={salvando || !modelos.data} onClick={() => void salvar()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
