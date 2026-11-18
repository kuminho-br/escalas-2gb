import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, somarMeses, type FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarMilitares, consultaEquipes, registrarTransferencia } from '@/api/militares';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { NOME_JORNADA, resumoDaLotacao } from '@/lib/militares';
import { Secao } from './Secao';

export function Lotacoes({ ficha, unidadeId }: { ficha: FichaMilitar; unidadeId: string }) {
  const [transferindo, setTransferindo] = useState(false);
  return (
    <Secao titulo="Lotação" recolhida resumo={resumoDaLotacao(ficha.lotacoes)} acoes={<Button size="sm" variant="outline" onClick={() => setTransferindo(true)}>Registrar transferência</Button>}>
      <ol className="relative grid gap-3 border-l-2 border-linha pl-4">
        {ficha.lotacoes.map((l, i) => (
          <li key={l.id} className="relative">
            <span className={`absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ${i === 0 && !l.ate ? 'bg-vinho' : 'bg-linha'}`} aria-hidden />
            <p className="font-medium">
              {l.unidadeSigla}, {NOME_JORNADA[l.jornada]}{l.equipe ? `, equipe ${l.equipe}` : ''}
            </p>
            <p className="text-sm text-apagado">
              desde {mesPorExtenso(l.desde.slice(0, 7))}
              {l.ate ? ` até ${mesPorExtenso(l.ate.slice(0, 7))}` : ''}
            </p>
          </li>
        ))}
        {ficha.lotacoes.length === 0 && <li className="text-apagado">Sem lotação registrada.</li>}
      </ol>
      {transferindo && <Transferencia ficha={ficha} unidadeId={unidadeId} aoFechar={() => setTransferindo(false)} />}
    </Secao>
  );
}

function Transferencia({ ficha, unidadeId, aoFechar }: { ficha: FichaMilitar; unidadeId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const equipes = useQuery(consultaEquipes(unidadeId));
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro(null);
    try {
      await registrarTransferencia(ficha.id, {
        unidadeId,
        equipeId: String(f.get('equipe')) || null,
        jornada: f.get('jornada') === 'adm' ? 'adm' : 'pronto',
        desde: String(f.get('desde')),
      });
      atualizarMilitares(queryClient, ficha.id);
      aoFechar();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar transferência</DialogTitle>
          <DialogDescription>Mudança de equipe ou de jornada. A lotação atual termina no mês anterior ao escolhido.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tr-equipe">Equipe</Label>
              <Selecao id="tr-equipe" name="equipe" defaultValue="">
                <option value="">Sem equipe</option>
                {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tr-jornada">Jornada</Label>
              <Selecao id="tr-jornada" name="jornada" defaultValue={ficha.jornada ?? 'pronto'}>
                <option value="pronto">Pronto</option>
                <option value="adm">Adm</option>
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tr-desde">A partir de</Label>
              <Input id="tr-desde" name="desde" type="month" defaultValue={somarMeses(mesAtual(), 1)} required />
            </div>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit">Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
