import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { gravarMetaDoDia } from '@/api/efetivo-do-dia';
import { mensagemComCampo } from '@/api/cliente';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { dataPorExtenso } from '@/lib/meses';
import { EditorDaMeta, useModelosDaMeta } from './EditorDaMeta';

/**
 * "Alterar a meta deste dia": marca os modelos de guarnição que devem ser ativados e põe na ordem de ativação.
 * "Até" repete a mesma meta nos dias seguintes (no máximo 31 dias, contando este).
 */
export function AlterarMetaDoDia({ unidadeId, data, atuais, aoFechar }: { unidadeId: string; data: string; atuais: { guarnicaoId: string; nome: string }[]; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const { modelos, opcoes } = useModelosDaMeta(unidadeId, data.slice(0, 7), atuais);
  const [escolhidos, setEscolhidos] = useState<string[]>(atuais.map((g) => g.guarnicaoId));
  const [ate, setAte] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

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
            <EditorDaMeta opcoes={opcoes} escolhidos={escolhidos} aoMudar={setEscolhidos} semNenhum="Sem nenhum modelo marcado, o dia fica sem meta." />
            <div className="grid gap-1.5">
              <Label htmlFor="meta-ate">Até</Label>
              <Input id="meta-ate" type="date" min={data} value={ate} onChange={(e) => setAte(e.target.value)} className="w-44" />
              <p className="text-sm text-apagado">Opcional: repete esta meta nos dias seguintes, até 31 dias contando este.</p>
            </div>
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
