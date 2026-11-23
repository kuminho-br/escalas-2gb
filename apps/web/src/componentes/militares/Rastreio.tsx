import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { alterarSituacao, atualizarMilitares, consultaEquipes, consultaSecoes } from '@/api/militares';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { ddmmaaaa, linhaDoTempoDoMilitar, situacaoInteira } from '@/lib/linha-do-tempo-militar';
import { hoje } from '@/lib/meses';
import { Secao } from './Secao';

/** A situação de hoje: o período que cobre o dia de hoje (uma mudança marcada para depois ainda não vale). */
function periodoAtual(rastreio: FichaMilitar['rastreio']) {
  const dia = hoje();
  return rastreio.find((p) => p.desde <= dia && (!p.ate || p.ate >= dia)) ?? null;
}

/** "Histórico de rastreio": a situação atual (lotação, equipe e jornada) e a linha do tempo, com "Alterar situação". */
export function Rastreio({ ficha, unidadeId }: { ficha: FichaMilitar; unidadeId: string }) {
  const [alterando, setAlterando] = useState(false);
  const atual = periodoAtual(ficha.rastreio);
  const situacaoAtual = atual ? `${situacaoInteira(atual)} (desde ${ddmmaaaa(atual.desde)})` : 'Sem lotação';
  const itens = linhaDoTempoDoMilitar(ficha.rastreio, ficha.afastamentos);
  return (
    <Secao
      titulo="Histórico de rastreio"
      recolhida
      resumo={situacaoAtual}
      acoes={<Button size="sm" variant="outline" onClick={() => setAlterando(true)}>Alterar situação</Button>}
    >
      <p className="mb-3 text-sm">Situação atual: {situacaoAtual}</p>
      <ol className="relative grid gap-3 border-l-2 border-linha pl-4">
        {itens.map((i, n) => (
          <li key={`${i.tipo}-${i.quando}-${n}`} className="relative">
            <span className={`absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ${n === 0 ? 'bg-vinho' : 'bg-linha'}`} aria-hidden />
            <span className="mr-2 font-cond text-apagado">{ddmmaaaa(i.quando)}</span>
            <span className={i.tipo === 'afastamento' ? 'text-apagado' : 'font-medium'}>{i.texto}</span>
          </li>
        ))}
        {itens.length === 0 && <li className="text-apagado">Sem lotação registrada.</li>}
      </ol>
      {alterando && <AlterarSituacao ficha={ficha} unidadeAtualId={unidadeId} aoFechar={() => setAlterando(false)} />}
    </Secao>
  );
}

/** O formulário flutuante: lotação, equipe (da lotação escolhida), jornada e "a partir de" (um dia, sugerido o de hoje). */
function AlterarSituacao({ ficha, unidadeAtualId, aoFechar }: { ficha: FichaMilitar; unidadeAtualId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const secoes = useQuery(consultaSecoes);
  const atual = periodoAtual(ficha.rastreio);
  // a lotação sugerida é a do período de hoje (as seções vêm com a sigla); sem ela, a unidade em que a tela trabalha
  const daSigla = secoes.data?.find((s) => s.sigla === atual?.unidadeSigla)?.id;
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const unidadeId = escolhida ?? daSigla ?? unidadeAtualId;
  const equipes = useQuery(consultaEquipes(unidadeId));
  // a equipe sugerida é a de hoje, se a lotação não mudou; trocar de lotação zera a equipe (cada unidade tem as suas)
  const [equipeEscolhida, setEquipeEscolhida] = useState<string | null>(null);
  const equipeId = equipeEscolhida ?? (unidadeId === (daSigla ?? unidadeAtualId) ? (equipes.data?.find((e) => e.nome === atual?.equipe)?.id ?? '') : '');
  const [jornada, setJornada] = useState<'pronto' | 'adm'>(atual?.jornada ?? 'pronto');
  const [desde, setDesde] = useState(hoje());
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

  const salvar = travar(async () => {
    setErro(null);
    try {
      await alterarSituacao(ficha.id, { unidadeId, equipeId: equipeId || null, jornada, desde });
      atualizarMilitares(queryClient, ficha.id);
      aoFechar();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  });

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar situação</DialogTitle>
          <DialogDescription>A situação atual termina no dia anterior ao escolhido. No mesmo dia do período aberto, ele é substituído.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rs-lotacao">Lotação</Label>
              <Selecao
                id="rs-lotacao"
                value={unidadeId}
                disabled={!ficha.podeEditar.peculio}
                onChange={(e) => {
                  setEscolhida(e.target.value);
                  setEquipeEscolhida('');
                }}
              >
                {(secoes.data ?? [{ id: unidadeId, sigla: atual?.unidadeSigla ?? '…', nome: '' }]).map((s) => <option key={s.id} value={s.id}>{s.sigla}</option>)}
              </Selecao>
              {!ficha.podeEditar.peculio && <p className="text-xs text-apagado">{`A lotação é alterada por quem tem nível de acesso em ${ficha.podeEditar.unidadeDeCima ?? 'uma unidade acima'}.`}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rs-equipe">Equipe</Label>
              <Selecao id="rs-equipe" value={equipeId} onChange={(e) => setEquipeEscolhida(e.target.value)}>
                <option value="">Sem equipe</option>
                {equipes.data?.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rs-jornada">Jornada</Label>
              <Selecao id="rs-jornada" value={jornada} onChange={(e) => setJornada(e.target.value === 'adm' ? 'adm' : 'pronto')}>
                <option value="pronto">Pronto</option>
                <option value="adm">Adm</option>
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rs-desde">A partir de</Label>
              <Input id="rs-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando || !desde}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
