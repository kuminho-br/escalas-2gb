import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { alterarSituacao, atualizarMilitares, consultaEquipes, consultaQuadros, consultaSecoes, consultaSituacoesDoMilitar } from '@/api/militares';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { ddmmaaaa, linhaDoTempoDoMilitar, situacaoInteira } from '@/lib/linha-do-tempo-militar';
import { hoje } from '@/lib/meses';
import { proximoPeriodo } from '@/lib/militares';
import { Secao } from './Secao';

/** A situação de hoje: o período que cobre o dia de hoje (uma mudança marcada para depois ainda não vale). */
function periodoAtual(rastreio: FichaMilitar['rastreio']) {
  const dia = hoje();
  return rastreio.find((p) => p.desde <= dia && (!p.ate || p.ate >= dia)) ?? null;
}

/** "Histórico de rastreio": a situação atual (lotação, equipe, jornada, quadro e situação) e a linha do tempo, com "Alterar situação". */
export function Rastreio({ ficha, unidadeId }: { ficha: FichaMilitar; unidadeId: string }) {
  const [alterando, setAlterando] = useState(false);
  const atual = periodoAtual(ficha.rastreio);
  const proximo = proximoPeriodo(ficha.rastreio);
  const situacaoAtual = atual ? `${situacaoInteira(atual)} (desde ${ddmmaaaa(atual.desde)})` : proximo ? `Lotação a partir de ${ddmmaaaa(proximo.desde)}` : 'Sem lotação';
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
            <span className={i.tipo === 'situacao' ? 'font-medium' : 'text-apagado'}>{i.texto}</span>
          </li>
        ))}
        {itens.length === 0 && <li className="text-apagado">Sem lotação registrada.</li>}
      </ol>
      {alterando && <AlterarSituacao ficha={ficha} unidadeAtualId={unidadeId} aoFechar={() => setAlterando(false)} />}
    </Secao>
  );
}

/** O formulário flutuante: lotação, equipe (da lotação escolhida), jornada, quadro (só os do posto), situação e "a partir de" (um dia, sugerido o de hoje). */
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
  // o quadro e a situação do período de hoje valem de novo, se nada for escolhido
  const quadros = useQuery(consultaQuadros);
  const situacoes = useQuery(consultaSituacoesDoMilitar);
  const quadrosDoPosto = (quadros.data ?? []).filter((q) => q.postoGradIds.includes(ficha.postoGradId));
  const [quadroEscolhido, setQuadroEscolhido] = useState<string | null>(null);
  // o quadro e a situação que a API repete são os do período aberto (o que não tem fim, mesmo marcado para depois), e não os de hoje
  const aberto = ficha.rastreio.find((p) => !p.ate) ?? atual;
  const quadroId = quadroEscolhido ?? quadrosDoPosto.find((q) => q.sigla === aberto?.quadro)?.id ?? '';
  const [situacaoEscolhida, setSituacaoEscolhida] = useState<string | null>(null);
  const situacaoAtual = situacoes.data?.find((s) => s.nome === aberto?.situacao);
  const situacaoId = situacaoEscolhida ?? situacaoAtual?.id ?? '';
  // as desativadas não aparecem, a não ser a que o militar já tem
  const situacoesParaEscolher = (situacoes.data ?? []).filter((s) => s.ativo || s.id === situacaoId);
  const [desde, setDesde] = useState(hoje());
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();

  const salvar = travar(async () => {
    setErro(null);
    try {
      await alterarSituacao(ficha.id, {
        unidadeId, equipeId: equipeId || null, jornada, desde,
        // o que não foi tocado nem sabido fica de fora: a API repete o do período atual
        ...(ficha.podeEditar.peculio && (quadroEscolhido !== null) ? { quadroId: quadroEscolhido || null } : {}),
        ...(ficha.podeEditar.peculio && situacaoEscolhida ? { situacaoId: situacaoEscolhida } : {}),
      });
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
              {!ficha.podeEditar.peculio && <p className="text-xs text-apagado">{`A lotação, o quadro e a situação são alterados por quem tem nível de acesso em ${ficha.podeEditar.unidadeDeCima ?? 'uma unidade acima'}.`}</p>}
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
              <Label htmlFor="rs-quadro">Quadro</Label>
              <Selecao id="rs-quadro" value={quadroId} disabled={!ficha.podeEditar.peculio} onChange={(e) => setQuadroEscolhido(e.target.value)}>
                <option value="">Sem quadro</option>
                {quadrosDoPosto.map((q) => <option key={q.id} value={q.id}>{q.sigla}</option>)}
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rs-situacao">Situação</Label>
              <Selecao id="rs-situacao" value={situacaoId} disabled={!ficha.podeEditar.peculio} onChange={(e) => setSituacaoEscolhida(e.target.value)}>
                {situacaoId === '' && <option value="">…</option>}
                {situacoesParaEscolher.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Selecao>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rs-desde">A partir de</Label>
              <Input id="rs-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
            </div>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            {/* sem a lista de seções a lotação sugerida pode ser a da tela, e não a do período: espera chegar */}
            <Button type="submit" disabled={salvando || !desde || !secoes.data}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
