import { useQueryClient } from '@tanstack/react-query';
import type { EscalaDosOficiais } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { calcularCotas, encerrarMes, fecharEscala, gravarOrdem, gravarParticipantes, trocarTurno } from '@/api/oficiais';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { CalendarioDosOficiais, LegendaDosTurnos } from './CalendarioDosOficiais';
import { ListaDeCotas, VezDeEscolher } from './ListaDeCotas';
import { EtapasDoMes, MensagensDoMes, type Confirmacao } from './MensagensDoMes';

type Turno = EscalaDosOficiais['turnos'][number];

interface Props {
  unidadeId: string;
  escala: EscalaDosOficiais;
  aoVer: (aba: 'saldo' | 'regras') => void;
}

/** A aba Escala do mês: as etapas e os botões, o calendário com os turnos do serviço e, ao lado, a vez de escolher e a lista de cotas. */
export function EscalaDoMes({ unidadeId, escala: e, aoVer }: Props) {
  const queryClient = useQueryClient();
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [turnoAberto, setTurnoAberto] = useState<Turno | null>(null);
  // o erro de uma troca feita no diálogo aparece nele (atrás do diálogo ninguém o veria)
  const [erroDoTurno, setErroDoTurno] = useState<string | null>(null);
  // depois de mudar quem participa: os turnos de quem saiu que ficaram sem ninguém
  const [liberados, setLiberados] = useState<string[]>([]);
  // o último turno lançado: fica marcado no calendário, e o aviso diz quem ficou com ele, até o próximo lançamento
  const [recente, setRecente] = useState<{ dia: string; turnoId: string; texto: string } | null>(null);

  const semParticipantes = e.etapa === 'sem-cotas' && e.oficiais.length === 0;
  if (semParticipantes) return <p className="text-apagado">Nenhum oficial QOC ou QOA nesta unidade neste mês.</p>;

  const rodar = (f: () => Promise<unknown>, depois?: () => void, mostrar: (m: string | null) => void = setErro) =>
    travar(async () => {
      mostrar(null);
      try {
        await f();
        depois?.();
      } catch (x) {
        mostrar(mensagemDe(x));
      }
    });
  // as mudanças que refazem as cotas dizem os turnos de quem saiu da rodada que ficaram sem ninguém; uma ação nova limpa o aviso anterior
  const comAviso = (f: () => Promise<EscalaDosOficiais>) => async () => {
    setLiberados([]);
    setLiberados((await f()).liberados ?? []);
  };
  const calcular = rodar(comAviso(() => calcularCotas(queryClient, unidadeId, e.mes)));
  const fechar = rodar(() => fecharEscala(queryClient, unidadeId, e.mes), () => setConfirmacao(null));
  const encerrar = rodar(() => encerrarMes(queryClient, unidadeId, e.mes), () => setConfirmacao(null));
  const ordenar = (ids: string[]) => void rodar(comAviso(() => gravarOrdem(queryClient, unidadeId, e.mes, ids)))();
  const marcar = (ids: string[]) => void rodar(comAviso(() => gravarParticipantes(queryClient, unidadeId, e.mes, ids)))();
  const lancar = (t: Turno, militarId: string | null, noDialogo = false) =>
    rodar(
      () => trocarTurno(queryClient, unidadeId, e.mes, t.dia, t.turnoId, militarId),
      () => {
        setTurnoAberto(null);
        const o = e.oficiais.find((x) => x.militarId === militarId);
        const rotulo = e.turnosDoServico.find((x) => x.id === t.turnoId)?.rotulo ?? 'turno';
        setRecente(o ? { dia: t.dia, turnoId: t.turnoId, texto: `${o.posto} ${o.nomeGuerra} ficou com o turno ${rotulo} de ${t.dia.slice(8)}/${t.dia.slice(5, 7)}.` } : null);
      },
      noDialogo ? setErroDoTurno : setErro,
    )();
  const fecharDialogo = () => {
    setTurnoAberto(null);
    setErroDoTurno(null);
  };

  const aoCalcular = () => (e.etapa === 'fechada' ? setConfirmacao('calcular-fechada') : void calcular());
  const aoFechar = () => (e.turnos.some((t) => t.militarId === null) ? setConfirmacao('fechar') : void fechar());
  const aoEncerrar = () => setConfirmacao(e.etapa === 'fechada' ? 'encerrar' : 'encerrar-antes');
  const clicarTurno = (t: Turno) => {
    if (e.etapa !== 'escolhas') {
      setErroDoTurno(null);
      setTurnoAberto(t);
    } else if (e.vez) void lancar(t, e.vez);
  };
  const aberto = e.etapa === 'escolhas' || e.etapa === 'fechada';

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <EtapasDoMes etapa={e.etapa} />
        <div className="flex flex-wrap gap-2">
          {e.etapa !== 'encerrada' && (
            <Button type="button" variant={e.etapa === 'fechada' ? 'outline' : 'default'} disabled={salvando || !e.servico} onClick={aoCalcular}>
              Calcular cotas
            </Button>
          )}
          {e.etapa === 'escolhas' && <Button type="button" variant="outline" disabled={salvando} onClick={aoFechar}>Fechar a escala</Button>}
          {(e.etapa === 'escolhas' || e.etapa === 'fechada') && (
            <Button type="button" variant={e.etapa === 'fechada' ? 'default' : 'outline'} disabled={salvando} onClick={aoEncerrar}>Encerrar o mês</Button>
          )}
          {e.etapa === 'encerrada' && <Button type="button" variant="outline" onClick={() => aoVer('saldo')}>Ver o saldo</Button>}
          <Button type="button" variant="outline" onClick={() => aoVer('regras')}>Regras</Button>
        </div>
      </div>
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {liberados.length > 0 && (
        <div role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">
          {liberados.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}
      <MensagensDoMes
        escala={e}
        confirmacao={confirmacao}
        ocupado={salvando}
        aoFechar={() => void fechar()}
        aoEncerrar={() => void encerrar()}
        aoDesistir={() => setConfirmacao(null)}
      />
      {e.etapa === 'sem-cotas' && (
        <p className="text-apagado">
          {!e.servico
            ? 'Escolha o serviço da escala. Ele vem do cadastro de serviços (tela Turnos).'
            : e.oficiais.some((o) => o.participa)
              ? 'Calcule as cotas para abrir os turnos do mês.'
              : 'Marque na lista quem participa da rodada e calcule as cotas.'}
        </p>
      )}
      {/* o painel é largo (30 rem) e o calendário cede; abaixo de 1280 px ele vem antes dos dias, na largura toda */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_30rem]">
        {aberto || e.etapa === 'encerrada' ? (
          <section className="grid gap-2 rounded-lg border border-linha bg-superficie p-2">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-cond text-lg font-semibold">Turnos do mês</h2>
              <small className="text-[13px] text-apagado">{`${e.turnos.filter((t) => t.militarId !== null).length} de ${e.turnos.length} turnos com nome`}</small>
            </header>
            <LegendaDosTurnos turnos={e.turnosDoServico} />
            {recente && recente.dia.startsWith(e.mes) && <p role="status" className="text-[15px] leading-[22px] font-medium">{recente.texto}</p>}
            <CalendarioDosOficiais
              escala={e}
              aoClicarTurno={aberto ? clicarTurno : undefined}
              aoTirar={e.etapa === 'escolhas' ? (t) => void lancar(t, null) : undefined}
              desabilitado={salvando}
              recente={recente && recente.dia.startsWith(e.mes) ? recente : null}
            />
          </section>
        ) : (
          <div />
        )}
        {/* no celular a vez de escolher e as cotas vêm antes dos dias, como no mockup */}
        <aside className="order-first grid min-w-0 gap-3 xl:order-none">
          <VezDeEscolher escala={e} />
          <section className="grid gap-2 rounded-lg border border-linha bg-superficie p-3">
            <h2 className="font-cond text-lg font-semibold">Cotas</h2>
            <ListaDeCotas escala={e} aoOrdenar={e.etapa === 'sem-cotas' ? undefined : ordenar} aoMarcar={marcar} desabilitado={salvando} />
          </section>
        </aside>
      </div>
      <Dialog open={turnoAberto !== null} onOpenChange={(o) => !o && fecharDialogo()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quem fica neste turno?</DialogTitle>
            <DialogDescription>
              {turnoAberto ? `${turnoAberto.dia.slice(8)}/${turnoAberto.dia.slice(5, 7)}. Quem cobre ganha o turno, e quem saiu não fica devendo.` : ''}
            </DialogDescription>
          </DialogHeader>
          {erroDoTurno && <p role="alert" className="text-alerta">{erroDoTurno}</p>}
          <div className="grid gap-1.5">
            {e.oficiais.filter((o) => o.participa).map((o) => (
              <Button key={o.militarId} type="button" variant="outline" disabled={salvando} onClick={() => turnoAberto && lancar(turnoAberto, o.militarId, true)}>
                {`${o.posto} ${o.nomeGuerra}`}
              </Button>
            ))}
            <Button type="button" variant="outline" disabled={salvando} onClick={() => turnoAberto && lancar(turnoAberto, null, true)}>Ninguém</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
