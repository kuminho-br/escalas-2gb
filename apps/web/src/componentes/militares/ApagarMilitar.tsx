import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { FichaMilitar, OQueVaiJunto } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { apagarMilitar, atualizarMilitares, consultaExclusao } from '@/api/militares';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Secao } from './Secao';
import { Espera } from '@/componentes/resposta/Espera';

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** As linhas do que sai junto, só as que têm alguma coisa. */
function linhasDoQueVaiJunto(j: OQueVaiJunto): string[] {
  return [
    j.alocacoes > 0 && contar(j.alocacoes, 'alocação', 'alocações'),
    j.afastamentos > 0 && contar(j.afastamentos, 'afastamento', 'afastamentos'),
    j.periodosDoRastreio > 0 && contar(j.periodosDoRastreio, 'período do rastreio', 'períodos do rastreio'),
    j.temConta && 'a conta de acesso ao sistema',
    j.niveisDeAcesso > 0 && contar(j.niveisDeAcesso, 'nível de acesso', 'níveis de acesso'),
    j.outros > 0 && contar(j.outros, 'outro registro', 'outros registros'),
  ].filter((x): x is string => Boolean(x));
}

/**
 * O fim da ficha, só para o administrador do sistema: apaga o militar com tudo o que é dele (entrega 6.13). Antes, o diálogo diz o que vai junto, e
 * o botão só liga com a matrícula digitada igual. Depois, volta para a lista do Pecúlio.
 */
export function ApagarMilitar({ ficha }: { ficha: FichaMilitar }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Secao titulo="Apagar militar">
      <p className="mb-3 text-sm text-apagado">Apaga o militar e tudo o que é dele: escalas, afastamentos, rastreio e a conta de acesso.</p>
      <Button variant="secundario" className="border-alerta text-alerta hover:bg-alerta/10" onClick={() => setAberto(true)}>
        Apagar militar
      </Button>
      {aberto && <DialogoDeExclusao ficha={ficha} aoFechar={() => setAberto(false)} />}
    </Secao>
  );
}

function DialogoDeExclusao({ ficha, aoFechar }: { ficha: FichaMilitar; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const junto = useQuery(consultaExclusao(ficha.id));
  const [digitada, setDigitada] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const confere = digitada.trim() === ficha.matricula;
  const apagar = travar(async () => {
    setErro(null);
    try {
      await apagarMilitar(ficha.id, digitada.trim());
      atualizarMilitares(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['peculio'] });
      aoFechar();
      await navigate({ to: '/peculio' });
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });
  const linhas = junto.data ? linhasDoQueVaiJunto(junto.data) : [];
  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`Apagar ${ficha.posto} ${ficha.nomeGuerra}`}</DialogTitle>
          <DialogDescription>Isto não pode ser desfeito.</DialogDescription>
        </DialogHeader>
        {junto.isPending && <Espera />}
        {junto.error && <p role="alert" className="text-sm text-alerta">{mensagemDe(junto.error)}</p>}
        {junto.data && (
          <div className="grid gap-1 text-sm">
            <p>{linhas.length ? 'Vai junto:' : 'Não há nada ligado a este militar além da ficha.'}</p>
            {linhas.length > 0 && (
              <ul className="list-disc pl-5">
                {linhas.map((l) => <li key={l}>{l}</li>)}
              </ul>
            )}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if (confere) void apagar(); }} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="apagar-matricula">Digite a matrícula para confirmar.</Label>
            <Input id="apagar-matricula" value={digitada} autoComplete="off" placeholder={ficha.matricula} onChange={(e) => setDigitada(e.target.value)} />
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="secundario" onClick={aoFechar}>Cancelar</Button>
            <Button type="submit" variant="perigoso-cheio" disabled={!confere || salvando || !junto.data}>Apagar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
