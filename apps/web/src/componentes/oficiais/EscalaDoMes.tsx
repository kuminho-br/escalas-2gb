import { useQueryClient } from '@tanstack/react-query';
import type { EscalaDosOficiais, LetraTurno, ServicoDaRodada } from 'contratos';
import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { abrirMes, encerrarMes, fecharEscala, gravarOrdem, gravarParticipantes, lancarNoLugar, marcarDiaVermelho, tirarDoLugar } from '@/api/oficiais';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { cn } from '@/lib/utils';
import { CalendarioDosOficiais, LegendaDosTurnos } from './CalendarioDosOficiais';
import { EscolherOficial } from './EscolherOficial';
import { FaixaDoMes } from './FaixaDoMes';
import { ListaDeCotas } from './ListaDeCotas';
import { MensagensDoMes, type Confirmacao } from './MensagensDoMes';
import { BotaoDasRegras } from './RegrasDosOficiais';
import { SeletorDeServico } from './SeletorDeServico';

type Lugar = EscalaDosOficiais['turnos'][number];
type Oficial = EscalaDosOficiais['oficiais'][number];

interface Props {
  unidadeId: string;
  escala: EscalaDosOficiais;
  aoVer: (aba: 'saldo' | 'memorial') => void;
}

const dm = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;
const NOME_DO_SERVICO = { jes: 'JES', saldo: 'Saldo' } as const;
const nomeDe = (o: Oficial) => `${o.posto} ${o.nomeGuerra}`;

/**
 * A aba Escala do mês. O jeito de escalar: o serviço (Saldo, de começo, ou JES), um oficial clicado na lista (qualquer um, em qualquer ordem; a vez só fica destacada)
 * e os cliques nos turnos. Clicar fora de uma placa tira a escolha; sem oficial escolhido, a placa preenchida pergunta se remove e a livre abre a lista de nomes. Com JES,
 * a tela diz quantos JES ainda restam na cota da unidade. Os cliques vão para uma fila (cada um lança uma vez, na ordem). Nada bloqueia o escalante: cota de JES
 * acabada, fora da vez e sem cota cadastrada são avisos.
 */
export function EscalaDoMes({ unidadeId, escala: e, aoVer }: Props) {
  const queryClient = useQueryClient();
  const escalaId = e.escala?.id;
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [listaAberta, setListaAberta] = useState(true);
  // o serviço dos próximos cliques (Saldo, de começo) e o oficial escolhido à mão: nenhum vem escolhido, nem o da vez
  const [servico, setServico] = useState<ServicoDaRodada>(e.servicos.saldo ? 'saldo' : 'jes');
  const [manual, setManual] = useState<string | null>(null);
  // depois de mudar quem participa: os lugares de quem saiu que ficaram sem ninguém
  const [liberados, setLiberados] = useState<string[]>([]);
  // "Fora da ordem: a vez era de…": o aviso do último lançamento de Saldo que não foi para o da vez (não impede nada)
  const [foraDaOrdem, setForaDaOrdem] = useState<string | null>(null);
  // o modo de marcar dias vermelhos: ligado, o clique no dia marca ou tira a marca (e os turnos não respondem)
  const [modoVermelho, setModoVermelho] = useState(false);
  // sem oficial escolhido: a placa preenchida que espera a pergunta "Remover…?" e a livre que espera um nome
  const [remocao, setRemocao] = useState<{ lugar: Lugar; de: Oficial } | null>(null);
  const [aEscolher, setAEscolher] = useState<Lugar | null>(null);
  // a troca de nome que espera a confirmação ("Trocar X por Y?")
  const [troca, setTroca] = useState<{ lugar: Lugar; de: Oficial; para: Oficial } | null>(null);
  // a fila dos lançamentos: cada clique lança uma vez, na ordem, e decide sobre o estado mais novo (o da última resposta)
  const fila = useRef<Promise<void>>(Promise.resolve());
  const maisNova = useRef<EscalaDosOficiais>(e);
  const [pendentes, setPendentes] = useState(0);
  useEffect(() => {
    maisNova.current = e;
  }, [e]);

  const semParticipantes = e.etapa === 'nao-aberto' && e.oficiais.length === 0;
  if (semParticipantes)
    return (
      <div className="grid gap-3">
        <div className="flex justify-end">
          <BotaoDasRegras />
        </div>
        <p className="text-apagado">Nenhum oficial QOC ou QOA nesta unidade neste mês.</p>
      </div>
    );

  const participantes = e.oficiais.filter((o) => o.participa);
  const rotuloDoTurno = (l: Lugar) => e.turnosDoServico.find((t) => t.id === l.turnoId)?.rotulo ?? 'turno';
  const escolhido: Oficial | null = manual ? (participantes.find((o) => o.militarId === manual) ?? null) : null;

  const rodar = (f: () => Promise<unknown>, depois?: () => void) =>
    travar(async () => {
      setErro(null);
      try {
        await f();
        depois?.();
      } catch (x) {
        setErro(mensagemDe(x));
        // um 409 quer dizer que a escala mudou desde que a tela abriu: os dados vêm de novo
        void queryClient.invalidateQueries({ queryKey: ['oficiais', unidadeId] });
      }
    });
  // as mudanças que refazem as cotas dizem os lugares de quem saiu da rodada que ficaram sem ninguém; uma ação nova limpa o aviso anterior
  const comAviso = (f: () => Promise<EscalaDosOficiais>) => async () => {
    setLiberados([]);
    setForaDaOrdem(null);
    setLiberados((await f()).liberados ?? []);
  };
  const abrir = rodar(comAviso(() => abrirMes(queryClient, unidadeId, e.mes, escalaId)));
  const fechar = rodar(() => fecharEscala(queryClient, unidadeId, e.mes, escalaId), () => setConfirmacao(null));
  const encerrar = rodar(() => encerrarMes(queryClient, unidadeId, e.mes, escalaId), () => setConfirmacao(null));
  const ordenar = (ids: string[]) => void rodar(comAviso(() => gravarOrdem(queryClient, unidadeId, e.mes, ids, escalaId)))();
  const marcar = (ids: string[]) => void rodar(comAviso(() => gravarParticipantes(queryClient, unidadeId, e.mes, ids, escalaId)))();
  // marcar ou tirar um dia vermelho: a lista inteira do mês vai de novo, com o dia a mais ou a menos (vale até o mês ser encerrado)
  // um dia por vez: a outra tela aberta não perde as marcas dela (a lista inteira apagaria)
  const marcarDia = (d: string) => void rodar(() => marcarDiaVermelho(queryClient, unidadeId, e.mes, d, !e.diasVermelhos.includes(d), escalaId))();

  const enfileirar = (tarefa: () => Promise<void>) => {
    setPendentes((n) => n + 1);
    fila.current = fila.current.then(tarefa).catch(() => undefined).finally(() => setPendentes((n) => n - 1));
  };
  const lugarAgora = (dia: string, letra: string) => maisNova.current.turnos.find((x) => x.dia === dia && x.letra === letra);
  const lancar = (l: Lugar, o: Oficial, qual: ServicoDaRodada) =>
    enfileirar(async () => {
      // o estado mais novo: se o turno já é deste oficial neste serviço (um clique repetido), não há o que lançar
      const agora = lugarAgora(l.dia, l.letra);
      if (agora?.militarId === o.militarId && agora.servico === qual) return;
      try {
        setLiberados([]);
        const r = await lancarNoLugar(queryClient, unidadeId, e.mes, { dia: l.dia, letra: l.letra as LetraTurno, servico: qual, militarId: o.militarId }, escalaId);
        maisNova.current = r;
        setLiberados(r.liberados ?? []);
        setForaDaOrdem(r.foraDaOrdem ?? null);
      } catch (x) {
        setErro(mensagemDe(x));
        void queryClient.invalidateQueries({ queryKey: ['oficiais', unidadeId] });
      }
    });
  const tirar = (l: Lugar) =>
    enfileirar(async () => {
      const agora = lugarAgora(l.dia, l.letra);
      if (!agora?.alocacaoId) return;
      try {
        setLiberados([]);
        setForaDaOrdem(null);
        const r = await tirarDoLugar(queryClient, unidadeId, e.mes, agora.alocacaoId, escalaId);
        maisNova.current = r;
        setLiberados(r.liberados ?? []);
      } catch (x) {
        setErro(mensagemDe(x));
        void queryClient.invalidateQueries({ queryKey: ['oficiais', unidadeId] });
      }
    });

  const afastadoEm = (o: Oficial, dia: string) => o.afastamentos.find((a) => a.inicio <= dia && dia <= a.fim);
  /**
   * O clique num turno. Com oficial escolhido: livre lança; o dele tira; o de outro pergunta antes de trocar. Sem oficial escolhido: a placa preenchida pergunta
   * se remove, e a livre abre a lista de nomes.
   */
  const clicarTurno = (l: Lugar) => {
    setErro(null);
    setAviso(null);
    if (e.etapa !== 'escolhas' && e.etapa !== 'fechada') return;
    const agora = lugarAgora(l.dia, l.letra) ?? l;
    if (!escolhido) {
      const quem = agora.militarId ? e.oficiais.find((o) => o.militarId === agora.militarId) : undefined;
      if (quem) setRemocao({ lugar: agora, de: quem });
      else if (!agora.militarId) setAEscolher(agora);
      return;
    }
    if (agora.militarId === escolhido.militarId && agora.servico === servico) {
      tirar(agora);
      return;
    }
    // o lugar é do outro serviço: o servidor recusaria (e a pergunta de trocar enganaria); a tela avisa antes
    if (agora.militarId && agora.servico && agora.servico !== servico) {
      setAviso(`Este turno é ${NOME_DO_SERVICO[agora.servico]}. Mude para ${NOME_DO_SERVICO[agora.servico]} para tirar ou trocar.`);
      return;
    }
    const afastamento = afastadoEm(escolhido, l.dia);
    if (afastamento) {
      setAviso(`${nomeDe(escolhido)} está afastado em ${dm(l.dia)} (${afastamento.tipo}) e não pode ficar com este turno.`);
      return;
    }
    const dono = agora.militarId ? e.oficiais.find((o) => o.militarId === agora.militarId) : undefined;
    if (dono && dono.militarId !== escolhido.militarId) setTroca({ lugar: agora, de: dono, para: escolhido });
    else lancar(agora, escolhido, servico);
  };
  // um nome escolhido na lista de uma placa livre: as mesmas recusas do clique com oficial escolhido
  const lancarEscolhido = (o: Oficial) => {
    const l = aEscolher;
    setAEscolher(null);
    if (!l) return;
    const afastamento = afastadoEm(o, l.dia);
    if (afastamento) setAviso(`${nomeDe(o)} está afastado em ${dm(l.dia)} (${afastamento.tipo}) e não pode ficar com este turno.`);
    else lancar(l, o, servico);
  };
  const escolherOficial = (id: string) => {
    setAviso(null);
    setManual(id);
  };
  const mudarServico = (s: ServicoDaRodada) => {
    setServico(s);
    setManual(null);
    setAviso(null);
  };
  const confirmarTroca = () => {
    if (!troca) return;
    const { lugar, para } = troca;
    setTroca(null);
    lancar(lugar, para, servico);
  };
  const confirmarRemocao = () => {
    if (!remocao) return;
    const { lugar } = remocao;
    setRemocao(null);
    tirar(lugar);
  };
  // clicar fora de uma placa (e fora da lista de oficiais) tira a escolha; o que está em janela (portal) não conta
  const clicouFora = (ev: React.MouseEvent<HTMLDivElement>) => {
    const alvo = ev.target as Element;
    if (!ev.currentTarget.contains(alvo) || alvo.closest('[data-turno], [data-escolher-oficial], [role="dialog"]')) return;
    setManual(null);
  };

  const ocupado = salvando || pendentes > 0;
  const aoFechar = () => (e.turnos.some((t) => t.militarId === null) ? setConfirmacao('fechar') : void fechar());
  const aoEncerrar = () => setConfirmacao('encerrar');
  const editavel = e.etapa === 'escolhas' || e.etapa === 'fechada';

  return (
    <div className="grid gap-3" onClick={clicouFora}>
      <FaixaDoMes
        etapa={e.etapa}
        ocupado={ocupado}
        podeAbrir={Boolean(e.escala && e.servicos.saldo)}
        aoAbrir={() => void abrir()}
        aoFechar={aoFechar}
        aoEncerrar={aoEncerrar}
        extras={
          <>
            {e.etapa === 'encerrada' && <Button type="button" variant="outline" onClick={() => aoVer('saldo')}>Ver o saldo</Button>}
            {e.etapa !== 'nao-aberto' && <Button type="button" variant="outline" onClick={() => aoVer('memorial')}>Memorial de cálculo</Button>}
            <BotaoDasRegras />
          </>
        }
      />
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {liberados.length > 0 && (
        <div role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">
          {liberados.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}
      {foraDaOrdem && <p role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{foraDaOrdem}</p>}
      <MensagensDoMes escala={e} confirmacao={confirmacao} ocupado={ocupado} aoFechar={() => void fechar()} aoEncerrar={() => void encerrar()} aoDesistir={() => setConfirmacao(null)} />
      {e.etapa === 'nao-aberto' && (
        <p className="text-apagado">
          {!e.servicos.saldo
            ? 'A escala precisa de um serviço de Saldo, com turnos. Cadastre em Escalas.'
            : e.oficiais.some((o) => o.participa)
              ? 'Abra o mês para liberar os lugares e calcular as cotas.'
              : 'Marque na lista quem participa da rodada e abra o mês.'}
        </p>
      )}
      {/* a lista de oficiais (a de escolha) vem antes do calendário no celular e ao lado dele no computador, com 20 rem (22 a partir de 1536 px) */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        {editavel || e.etapa === 'encerrada' ? (
          <section className="grid min-w-0 gap-2.5 rounded-xl border border-linha bg-superficie p-3">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-cond text-[20px] leading-[26px] font-semibold">Turnos do mês</h2>
              <small className="text-[13px] text-apagado">{`${e.turnos.filter((t) => t.militarId !== null).length} de ${e.turnos.length} turnos com nome`}</small>
            </header>
            {editavel && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <SeletorDeServico servico={servico} aoMudar={mudarServico} jes={e.jes} temJes={Boolean(e.servicos.jes)} />
                <Button type="button" variant="outline" aria-pressed={modoVermelho} className={cn('ml-auto', modoVermelho && 'border-alerta text-alerta')} onClick={() => setModoVermelho((m) => !m)}>
                  {modoVermelho ? 'Concluir' : 'Marcar dias vermelhos'}
                </Button>
              </div>
            )}
            {editavel && (
              <p role="status" className={cn('min-h-[22px] text-[15px] leading-[22px]', aviso ? 'font-medium text-pendencia' : 'text-apagado')}>
                {aviso ?? (modoVermelho ? 'Clique nos dias para marcar ou tirar o dia vermelho.' : escolhido ? <>Escalando <b className="font-semibold text-tinta">{nomeDe(escolhido)}</b> no {NOME_DO_SERVICO[servico]}: clique nos turnos.</> : 'Escolha um oficial na lista.')}
              </p>
            )}
            {pendentes > 0 && <p role="status" className="text-[13px] text-apagado">Salvando…</p>}
            <CalendarioDosOficiais
              escala={e}
              aoClicarTurno={editavel && !modoVermelho ? clicarTurno : undefined}
              aoMarcarDia={editavel && modoVermelho ? marcarDia : undefined}
              oficialEscolhido={escolhido?.militarId ?? null}
            />
            <LegendaDosTurnos turnos={e.turnosDoServico} escala={e} />
          </section>
        ) : (
          <div />
        )}
        {/* no computador, o painel tem a altura do calendário e rola por dentro: a página termina logo depois do calendário. No celular, rola tudo junto */}
        <aside className="order-first min-w-0 xl:relative xl:order-none xl:min-h-96">
          <section className="grid content-start gap-2 rounded-xl border border-linha bg-superficie p-3 xl:absolute xl:inset-0 xl:overflow-y-auto">
            <header className="flex items-center justify-between gap-2">
              <h2 className="font-cond text-[20px] leading-[26px] font-semibold">Cota de saldo</h2>
              <Button type="button" variant="ghost" size="sm" className="xl:hidden" aria-expanded={listaAberta} aria-controls="lista-de-oficiais" onClick={() => setListaAberta((a) => !a)}>
                {listaAberta ? 'Recolher' : 'Mostrar'}
                <ChevronDown aria-hidden className={cn('transition-transform motion-reduce:transition-none', listaAberta && 'rotate-180')} />
              </Button>
            </header>
            <div id="lista-de-oficiais" className={cn(!listaAberta && 'max-xl:hidden')}>
              <ListaDeCotas
                escala={e}
                aoOrdenar={e.etapa === 'nao-aberto' ? undefined : ordenar}
                aoMarcar={marcar}
                desabilitado={ocupado}
                escolhido={editavel ? (escolhido?.militarId ?? null) : null}
                aoEscolher={editavel ? escolherOficial : undefined}
              />
            </div>
          </section>
        </aside>
      </div>
      <Dialog open={troca !== null} onOpenChange={(o) => !o && setTroca(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{troca ? `Trocar ${nomeDe(troca.de)} por ${nomeDe(troca.para)}?` : ''}</DialogTitle>
            <DialogDescription>
              {troca ? `O turno ${troca.lugar.letra} de ${dm(troca.lugar.dia)} passa para ${nomeDe(troca.para)}.${e.etapa === 'fechada' ? ' Quem cobre ganha o turno, e quem saiu não fica devendo.' : ''}` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTroca(null)}>Cancelar</Button>
            <Button type="button" onClick={confirmarTroca}>Trocar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={remocao !== null} onOpenChange={(o) => !o && setRemocao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{remocao ? `Remover ${nomeDe(remocao.de)} do dia ${dm(remocao.lugar.dia)} (${rotuloDoTurno(remocao.lugar)})?` : ''}</DialogTitle>
            <DialogDescription>{remocao ? 'O turno fica livre de novo.' : ''}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemocao(null)}>Cancelar</Button>
            <Button type="button" onClick={confirmarRemocao}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <EscolherOficial
        lugar={aEscolher ? { dia: aEscolher.dia, rotulo: rotuloDoTurno(aEscolher), servico: NOME_DO_SERVICO[servico] } : null}
        oficiais={participantes}
        aoEscolher={lancarEscolhido}
        aoFechar={() => setAEscolher(null)}
      />
    </div>
  );
}
