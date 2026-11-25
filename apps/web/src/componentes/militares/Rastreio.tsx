import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { alterarSituacao, atualizarMilitares, consultaEquipes, consultaQuadros, consultaUnidadesDeLotacao, consultaSituacoesDoMilitar } from '@/api/militares';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { CAMPOS, ddmmaaaa, eventosDoRastreio, periodoAtual as periodoDoDia, ROTULO_DO_CAMPO, SEM_O_CAMPO, valorDoCampo, type EventoDoRastreio } from '@/lib/linha-do-tempo-militar';
import { hoje } from '@/lib/meses';
import { NOME_JORNADA, proximoPeriodo } from '@/lib/militares';
import { cn } from '@/lib/utils';
import { avisoDaLista, Secao } from './Secao';

/** Quantos itens (mudanças e vãos juntos) a linha do tempo mostra antes de "Ver todo o histórico". */
const MAIS_NOVOS = 5;

/** A situação de hoje: o período que cobre o dia de hoje (uma mudança marcada para depois ainda não vale). */
const periodoAtual = (rastreio: FichaMilitar['rastreio']) => periodoDoDia(rastreio, hoje());

/**
 * "Histórico de rastreio": o quadro "Hoje" (a situação que vale agora) e a linha do tempo das mudanças, com "Alterar situação". Recolhida, a seção mostra só a unidade e a jornada;
 * aberta, esse texto some, porque o quadro diz tudo.
 */
export function Rastreio({ ficha, unidadeId }: { ficha: FichaMilitar; unidadeId: string }) {
  const [alterando, setAlterando] = useState(false);
  const dia = hoje();
  const atual = periodoDoDia(ficha.rastreio, dia);
  const proximo = proximoPeriodo(ficha.rastreio);
  const resumo = atual ? `${atual.unidadeSigla} · ${NOME_JORNADA[atual.jornada]}` : proximo ? `Lotação a partir de ${ddmmaaaa(proximo.desde)}` : 'Sem lotação';
  const eventos = eventosDoRastreio(ficha.rastreio, dia);
  return (
    <Secao
      titulo="Histórico de rastreio"
      recolhidaDeInicio
      resumo={resumo}
      // alterar a situação (lotação, equipe, jornada, quadro) é de quem tem nível de acesso acima da lotação; a SB só vê o histórico
      acoes={ficha.podeEditar.peculio ? <Button size="sm" variant="secundario" onClick={() => setAlterando(true)}>Alterar situação</Button> : undefined}
    >
      <div className="@container">
        <QuadroHoje atual={atual} proximo={proximo} />
        <LinhaDoTempo eventos={eventos} />
      </div>
      {alterando && <AlterarSituacao ficha={ficha} unidadeAtualId={unidadeId} aoFechar={() => setAlterando(false)} />}
    </Secao>
  );
}

/** O quadro "Hoje": desde quando vale a situação e os cinco campos, a lotação em destaque. Sem lotação hoje, só a primeira linha (com o ponto vazado). */
function QuadroHoje({ atual, proximo }: { atual: FichaMilitar['rastreio'][number] | null; proximo: FichaMilitar['rastreio'][number] | null }) {
  if (!atual) {
    return (
      <section aria-label="Situação de hoje" className="rounded-controle bg-passa px-4 pt-3 pb-3.5">
        <p className="flex items-center gap-2 text-xs text-apagado">
          <span className="size-2.5 flex-none rounded-full border-2 border-encaixe" aria-hidden />
          <span><b className="font-semibold text-tinta">Hoje</b>, sem lotação{proximo ? ` · lotação a partir de ${ddmmaaaa(proximo.desde)}` : ''}</span>
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Situação de hoje" className="grid gap-2.5 rounded-controle bg-passa px-4 pt-3 pb-3.5">
      <p className="flex items-center gap-2 text-xs text-apagado">
        <span className="size-2.5 flex-none rounded-full bg-tinta" aria-hidden />
        <span><b className="font-semibold text-tinta">Hoje</b>, desde {ddmmaaaa(atual.desde)}</span>
      </p>
      <dl className="m-0 grid grid-cols-2 items-baseline gap-x-4 gap-y-2.5 @min-[521px]:grid-cols-[repeat(5,auto)] @min-[521px]:justify-start @min-[521px]:gap-x-9">
        {CAMPOS.map((campo) => {
          const valor = valorDoCampo(atual, campo);
          return (
            <div key={campo} className={cn('grid min-w-0', campo === 'lotacao' && 'col-span-2 @min-[521px]:col-span-1')}>
              <dt className="text-xs text-apagado">{ROTULO_DO_CAMPO[campo]}</dt>
              <dd className={cn('m-0 font-cond font-semibold [overflow-wrap:anywhere]', campo === 'lotacao' ? 'text-bloco' : 'text-nome', !valor && 'font-medium text-apagado')}>
                {valor ?? (SEM_O_CAMPO[campo] ?? '').replace(/^s/, 'S')}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// o ponto de cada marca (a forma diz o que é; nenhuma depende só da cor) e o trecho do trilho de cada evento, até o ponto do seguinte
const PONTO = {
  antes: 'top-[7px] left-[-25px] size-2 bg-encaixe',
  inicio: 'top-[6px] left-[-26px] size-2.5 border-2 border-encaixe bg-superficie',
  agora: 'top-[5px] left-[-27px] size-3 bg-tinta',
  marcada: 'top-[5px] left-[-27px] size-3 border-2 border-tinta bg-superficie',
} as const;
const TRILHO = "before:absolute before:left-[-22px] before:top-[11px] before:border-l-2 before:content-['']";

/** Uma mudança (ou o primeiro registro, ou os dias sem lotação) da linha do tempo. */
function Evento({ e, trilho }: { e: EventoDoRastreio; trilho: 'ate-o-proximo' | 'ate-o-vao' | 'nenhum' }) {
  if (e.tipo === 'vao') {
    return <li data-tipo="vao" className="text-apagado">{e.texto}</li>;
  }
  // a ordem importa: o que vale agora e o que ainda não vale pesam mais que ser o primeiro registro (o mockup deixa a marca "marcada" vencer a do início)
  const marca = e.vale === 'agora' ? 'agora' : e.vale === 'marcada' ? 'marcada' : e.tipo === 'inicio' ? 'inicio' : 'antes';
  return (
    <li
      data-tipo={e.tipo}
      data-vale={e.vale}
      data-trilho={trilho}
      className={cn(
        'relative',
        trilho !== 'nenhum' && TRILHO,
        trilho === 'ate-o-proximo' && 'before:-bottom-[35px]',
        trilho === 'ate-o-vao' && 'before:-bottom-2',
        e.vale === 'marcada' ? 'before:border-dashed before:border-encaixe' : 'before:border-linha',
      )}
    >
      <span data-ponto data-marca={marca} className={cn('absolute rounded-full shadow-[0_0_0_3px_var(--color-superficie)]', PONTO[marca])} aria-hidden />
      <h4 className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-cond text-corpo font-semibold text-apagado">
        <time dateTime={e.desde} className={cn((e.vale === 'agora' || e.vale === 'marcada') && 'text-tinta')}>{ddmmaaaa(e.desde)}</time>
        {e.vale === 'marcada' && <Etiqueta tipo="neutra" className="font-sans">Ainda não vale</Etiqueta>}
        {e.tipo === 'inicio' && e.vale !== 'marcada' && <span className="font-sans text-xs font-normal">Primeiro registro</span>}
        {e.vale === 'agora' && <span className="sr-only">, vale agora</span>}
      </h4>
      {e.tipo === 'inicio' ? (
        <p className="mt-1 text-apagado">{e.inteira}</p>
      ) : e.mudancas.length === 0 ? (
        <p className="mt-1 text-apagado">Sem mudança na situação</p>
      ) : (
        <dl className="m-0 mt-1 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2">
          {e.mudancas.map((m) => (
            <div key={m.campo} className="contents">
              <dt className="text-xs leading-[22px] text-apagado">{ROTULO_DO_CAMPO[m.campo]}</dt>
              <dd className="m-0 text-apagado [overflow-wrap:anywhere]">
                <span className="sr-only">de </span>
                {m.antes}
                <span className="mx-1.5" aria-hidden>→</span>
                <span className="sr-only"> para </span>
                <b className="font-semibold text-tinta">{m.depois}</b>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {e.autor && <p className="mt-1 text-xs text-apagado">{e.autor}</p>}
    </li>
  );
}

/** As mudanças do mais novo para o mais velho; com mais de 5 itens, os 5 mais novos e "Ver todo o histórico (n)" (o estado vale só para esta ficha). */
function LinhaDoTempo({ eventos }: { eventos: EventoDoRastreio[] }) {
  const [tudo, setTudo] = useState(false);
  if (eventos.length === 0) return <p className="mt-4 text-apagado">Para lançar a primeira lotação, use "Alterar situação".</p>;
  const longo = eventos.length > MAIS_NOVOS;
  const mostrados = longo && !tudo ? eventos.slice(0, MAIS_NOVOS) : eventos;
  return (
    <ol role="list" aria-label="Mudanças, da mais nova para a mais antiga" className="mt-5 grid list-none gap-6 pl-7">
      {mostrados.map((e, i) => {
        const seguinte = mostrados[i + 1];
        // o trilho vai até o ponto do seguinte; o primeiro registro o fecha; antes de um vão à vista, ele para antes e recomeça depois dele
        const trilho = e.tipo === 'inicio' || (i === mostrados.length - 1 && !longo) ? 'nenhum' : seguinte?.tipo === 'vao' ? 'ate-o-vao' : 'ate-o-proximo';
        return <Evento key={e.tipo === 'vao' ? `vao-${e.de}` : `${e.tipo}-${e.desde}`} e={e} trilho={e.tipo === 'vao' ? 'nenhum' : trilho} />;
      })}
      {longo && (
        <li className="-ml-3.5">
          <Button variant="discreto" size="sm" onClick={() => setTudo(!tudo)}>{tudo ? 'Mostrar só os mais novos' : `Ver todo o histórico (${eventos.length})`}</Button>
        </li>
      )}
    </ol>
  );
}

/** O formulário flutuante: lotação, equipe (da lotação escolhida), jornada, quadro (só os do posto), situação e "a partir de" (um dia, sugerido o de hoje). */
function AlterarSituacao({ ficha, unidadeAtualId, aoFechar }: { ficha: FichaMilitar; unidadeAtualId: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const secoes = useQuery(consultaUnidadesDeLotacao);
  // a árvore da corporação dá lugar às unidades de lotação (as de cima entram como passagem)
  const todas = useQuery(consultaUnidadesDaBusca);
  const atual = periodoAtual(ficha.rastreio);
  // a lotação sugerida é a do período de hoje (achada pelo id: a mesma sigla existe em mais de um grupamento); sem ela, a unidade em que a tela trabalha
  // sem período de hoje (só um marcado para depois), vale o período aberto; a unidade da tela (que pode ser o grupamento ou o CBMPE) só entra se nada mais houver
  const aberto = ficha.rastreio.find((p) => !p.ate) ?? null;
  const daLotacao = secoes.data?.find((s) => s.id === (atual?.unidadeId ?? aberto?.unidadeId))?.id;
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // sem lotação nenhuma (o primeiro lançamento, que o administrador faz): a unidade da tela, se for uma seção da lista; senão, nenhuma vem escolhida (a unidade da
  // tela de quem trabalha na raiz é o CBMPE, que não é seção, e uma seção escolhida por acaso lotaria o militar no lugar errado). A API só aceita seção como destino.
  const daTela = secoes.data?.find((x) => x.id === unidadeAtualId)?.id;
  const sugerida = daLotacao ?? daTela ?? '';
  const unidadeId = escolhida ?? sugerida;
  const equipes = useQuery({ ...consultaEquipes(unidadeId), enabled: Boolean(unidadeId) });
  // a equipe sugerida é a de hoje, se a lotação não mudou; trocar de lotação zera a equipe (cada unidade tem as suas)
  const [equipeEscolhida, setEquipeEscolhida] = useState<string | null>(null);
  const equipeId = equipeEscolhida ?? (unidadeId === sugerida ? (equipes.data?.find((e) => e.nome === atual?.equipe)?.id ?? '') : '');
  const [jornada, setJornada] = useState<'pronto' | 'adm'>(atual?.jornada ?? 'pronto');
  // o quadro e a situação do período de hoje valem de novo, se nada for escolhido
  const quadros = useQuery(consultaQuadros);
  const situacoes = useQuery(consultaSituacoesDoMilitar);
  const quadrosDoPosto = (quadros.data ?? []).filter((q) => q.postoGradIds.includes(ficha.postoGradId));
  const [quadroEscolhido, setQuadroEscolhido] = useState<string | null>(null);
  // o quadro e a situação que a API repete são os do período aberto (o que não tem fim, mesmo marcado para depois), e não os de hoje
  const abertoOuAtual = aberto ?? atual;
  const quadroId = quadroEscolhido ?? quadrosDoPosto.find((q) => q.sigla === abertoOuAtual?.quadro)?.id ?? '';
  const [situacaoEscolhida, setSituacaoEscolhida] = useState<string | null>(null);
  const situacaoAtual = situacoes.data?.find((s) => s.nome === abertoOuAtual?.situacao);
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
              {/* pela árvore, nó a nó (6.45): as unidades em que a pessoa pode lotar, no lugar delas; enquanto a lista não chega, o campo mostra a lotação de hoje */}
              <EscolherUnidade
                id="rs-lotacao"
                rotulo="Lotação"
                unidades={secoes.data ?? []}
                todas={todas.data}
                valor={unidadeId}
                textoDoValor={atual?.unidadeSigla ?? '…'}
                disabled={!ficha.podeEditar.peculio}
                aoEscolher={(id) => {
                  setEscolhida(id);
                  setEquipeEscolhida('');
                }}
              />
              {avisoDaLista(secoes) && <p className="text-xs text-alerta">{avisoDaLista(secoes)}</p>}
              {secoes.isError && <Button type="button" size="sm" variant="secundario" className="justify-self-start" disabled={secoes.isFetching} onClick={() => void secoes.refetch()}>Tentar de novo</Button>}
              {!ficha.podeEditar.peculio && <p className="text-xs text-apagado">{`A lotação, o quadro e a situação são alterados por quem tem nível de acesso ${ficha.podeEditar.unidadeDeCima ? `em ${ficha.podeEditar.unidadeDeCima}` : 'na raiz'}.`}</p>}
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
                <option value="adm">ADM</option>
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
            <Button type="submit" disabled={salvando || !desde || !secoes.data || !unidadeId}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
