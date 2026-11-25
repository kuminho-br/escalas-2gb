import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaPreEscala, gravarPreEscala } from '@/api/escala-do-mes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Label } from '@/componentes/ui/label';
import { Espera } from '@/componentes/resposta/Espera';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * "Gerar pré-escala": a equipe do dia 1 (a detectada pelo mês anterior, que o escalante pode trocar), o resumo do que entra (a equipe no turno do Pronto e o Adm no
 * expediente) e a gravação. Não aloca guarnições: o escalante move cada um do turno para uma vaga, à mão. Gerar de novo só completa lacunas: ninguém é tirado e quem foi
 * removido não volta.
 */
export function GerarPreEscala({ escalaId, mes, aoFechar, aoGravar }: { escalaId: string; mes: string; aoFechar: () => void; aoGravar: (gravadas: number) => void }) {
  const queryClient = useQueryClient();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const previa = useQuery(consultaPreEscala(escalaId, mes, escolhida));
  const { salvando, travar } = useTrava();
  const p = previa.data;
  const equipeDoDia1 = escolhida ?? p?.equipeUsada?.id ?? '';
  const nomeDetectada = p?.equipes.find((e) => e.id === p.equipeDetectada.equipeId)?.nome;

  const gravar = travar(async () => {
    setErro(null);
    try {
      aoGravar(await gravarPreEscala(queryClient, escalaId, mes, equipeDoDia1));
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar pré-escala</DialogTitle>
          <DialogDescription>Coloca a equipe de cada dia no turno do Pronto e o ADM no expediente dos dias úteis. Quem já está escalado não é mexido, e cada um vai para uma vaga depois, à mão.</DialogDescription>
        </DialogHeader>
        {previa.isPending && <Espera />}
        {previa.error && <p role="alert" className="text-alerta">{mensagemDe(previa.error)}</p>}
        {p && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="pe-equipe">Equipe do dia 1</Label>
              <Selecao id="pe-equipe" value={equipeDoDia1} onChange={(e) => setEscolhida(e.target.value || null)} className="w-56">
                {!equipeDoDia1 && <option value="">Escolha…</option>}
                {p.equipes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Selecao>
              <p className="text-sm text-apagado">
                {p.equipeNoMes
                  ? `O Pronto deste mês já começa com a equipe ${p.equipeNoMes.nome} no dia 1.`
                  : nomeDetectada
                    ? `Pelo mês anterior, o dia 1 é da equipe ${nomeDetectada}.`
                    : `Não deu para saber pelo mês anterior (${p.equipeDetectada.motivo}). Escolha a equipe do dia 1.`}
              </p>
            </div>
            {p.equipeUsada && (
              <div className="grid gap-1 text-sm">
                <p>Entram {plural(p.entramNoTurno, 'militar', 'militares')} no turno do Pronto e {p.entramNoExpediente} no expediente.</p>
                {p.removidosQueNaoVoltam > 0 && <p>{plural(p.removidosQueNaoVoltam, 'removido não volta', 'removidos não voltam')}.</p>}
              </div>
            )}
            {previa.isPlaceholderData && <p role="status" className="text-sm text-apagado">Atualizando…</p>}
            {p.avisos.filter((a) => a !== 'Escolha a equipe do dia 1.').map((a) => <p key={a} className="text-sm text-pendencia">{a}</p>)}
          </>
        )}
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="secundario" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" onClick={() => void gravar()} disabled={!p || previa.isPlaceholderData || !equipeDoDia1 || salvando}>Gravar pré-escala</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
