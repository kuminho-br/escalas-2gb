import { useQueryClient } from '@tanstack/react-query';
import type { EscalaDosOficiais, LetraTurno, ServicoDaRodada } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { abrirMes, encerrarMes, fecharEscala, gravarOrdem, gravarParticipantes, lancarNoLugar, marcarDiasVermelhos, tirarDoLugar } from '@/api/oficiais';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { CalendarioDosOficiais, LegendaDosTurnos } from './CalendarioDosOficiais';
import { ListaDeCotas, VezDeEscolher } from './ListaDeCotas';
import { RegrasDosOficiais } from './RegrasDosOficiais';
import { EtapasDoMes, MensagensDoMes, type Confirmacao } from './MensagensDoMes';

type Lugar = EscalaDosOficiais['turnos'][number];

interface Props {
  unidadeId: string;
  escala: EscalaDosOficiais;
  aoVer: (aba: 'saldo') => void;
}

const dm = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;
const NOME_DO_SERVICO = { jes: 'JES', saldo: 'Saldo' } as const;

/**
 * A aba Escala do mês: as etapas e os botões, o calendário com os lugares do dia (um por letra de turno) e, ao lado, a vez de escolher e a lista de cotas de saldo.
 * Cada lugar é tomado por um lançamento de JES (à mão) ou de Saldo (a rodada). A ordem é só sugerida: lançar fora da vez grava e avisa.
 */
export function EscalaDoMes({ unidadeId, escala: e, aoVer }: Props) {
  const queryClient = useQueryClient();
  const escalaId = e.escala?.id;
  const { salvando, travar } = useTrava();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao>(null);
  const [lugarAberto, setLugarAberto] = useState<Lugar | null>(null);
  // o botão "Regras" abre o texto das regras numa janela (6.28: a aba do alto saiu)
  const [verRegras, setVerRegras] = useState(false);
  // o que se lança no lugar livre aberto: Saldo (a rodada) ou JES (à mão)
  const [servico, setServico] = useState<ServicoDaRodada>('saldo');
  // o erro de um lançamento feito no diálogo aparece nele (atrás do diálogo ninguém o veria)
  const [erroDoLugar, setErroDoLugar] = useState<string | null>(null);
  // depois de mudar quem participa: os lugares de quem saiu que ficaram sem ninguém
  const [liberados, setLiberados] = useState<string[]>([]);
  // "Fora da ordem: a vez era de…": o aviso do último lançamento de Saldo que não foi para o da vez (não impede nada)
  const [foraDaOrdem, setForaDaOrdem] = useState<string | null>(null);
  // o último lugar lançado: fica marcado no calendário, e o aviso diz quem ficou com ele, até o próximo lançamento
  const [recente, setRecente] = useState<{ dia: string; turnoId: string; texto: string } | null>(null);

  const semParticipantes = e.etapa === 'nao-aberto' && e.oficiais.length === 0;
  if (semParticipantes) return <p className="text-apagado">Nenhum oficial QOC ou QOA nesta unidade neste mês.</p>;

  const rodar = (f: () => Promise<unknown>, depois?: () => void, mostrar: (m: string | null) => void = setErro) =>
    travar(async () => {
      mostrar(null);
      try {
        await f();
        depois?.();
      } catch (x) {
        mostrar(mensagemDe(x));
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
  const lancar = (l: Lugar, militarId: string, qual: ServicoDaRodada, noDialogo = false) =>
    rodar(
      async () => {
        setLiberados([]);
        const r = await lancarNoLugar(queryClient, unidadeId, e.mes, { dia: l.dia, letra: l.letra as LetraTurno, servico: qual, militarId }, escalaId);
        setLiberados(r.liberados ?? []);
        setForaDaOrdem(r.foraDaOrdem ?? null);
      },
      () => {
        setLugarAberto(null);
        const o = e.oficiais.find((x) => x.militarId === militarId);
        const rotulo = e.turnosDoServico.find((x) => x.id === l.turnoId)?.rotulo ?? 'turno';
        setRecente(o ? { dia: l.dia, turnoId: l.turnoId, texto: `${o.posto} ${o.nomeGuerra} ficou com o turno ${rotulo} de ${dm(l.dia)} (${NOME_DO_SERVICO[qual]}).` } : null);
      },
      noDialogo ? setErroDoLugar : setErro,
    )();
  const tirar = (l: Lugar, noDialogo = false) =>
    rodar(
      async () => {
        setLiberados([]);
        setForaDaOrdem(null);
        const r = await tirarDoLugar(queryClient, unidadeId, e.mes, l.alocacaoId!, escalaId);
        setLiberados(r.liberados ?? []);
      },
      () => {
        setLugarAberto(null);
        setRecente(null);
      },
      noDialogo ? setErroDoLugar : setErro,
    )();
  // marcar ou tirar um dia vermelho: a lista inteira do mês vai de novo, com o dia a mais ou a menos (vale até o mês ser encerrado)
  const marcarDia = (d: string) =>
    void rodar(async () => {
      const nova = e.diasVermelhos.includes(d) ? e.diasVermelhos.filter((x) => x !== d) : [...e.diasVermelhos, d].sort();
      await marcarDiasVermelhos(queryClient, unidadeId, e.mes, nova, escalaId);
    })();
  const fecharDialogo = () => {
    setLugarAberto(null);
    setErroDoLugar(null);
  };

  const aoAbrir = () => (e.etapa === 'fechada' ? setConfirmacao('abrir-fechada') : void abrir());
  const aoFechar = () => (e.turnos.some((t) => t.militarId === null) ? setConfirmacao('fechar') : void fechar());
  const aoEncerrar = () => setConfirmacao(e.etapa === 'fechada' ? 'encerrar' : 'encerrar-antes');
  const clicarLugar = (l: Lugar) => {
    setErroDoLugar(null);
    // o lugar livre começa em Saldo (a rodada); o ocupado só aceita o serviço que já o tomou
    setServico(l.servico ?? 'saldo');
    setLugarAberto(l);
  };
  const aberto = e.etapa === 'escolhas' || e.etapa === 'fechada';
  // o lugar aberto no diálogo, como está agora (a resposta do servidor troca a lista)
  const lugar = lugarAberto ? (e.turnos.find((x) => x.dia === lugarAberto.dia && x.letra === lugarAberto.letra) ?? lugarAberto) : null;
  const donoDoLugar = lugar ? e.oficiais.find((o) => o.militarId === lugar.militarId) : undefined;
  const qualServico: ServicoDaRodada = lugar?.servico ?? servico;
  // quem se oferece: no Saldo, quem participa da rodada (a vez primeiro); no JES, o voluntário JES
  const candidatos = e.oficiais.filter((o) => (qualServico === 'jes' ? o.voluntarioJes : o.participa));
  const ordenados = qualServico === 'saldo' ? [...candidatos].sort((a, b) => Number(b.militarId === e.vez) - Number(a.militarId === e.vez)) : candidatos;
  const afastadoEm = (o: EscalaDosOficiais['oficiais'][number], dia: string) => o.afastamentos.some((a) => a.inicio <= dia && dia <= a.fim);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 basis-full">
          <EtapasDoMes etapa={e.etapa} ocupado={salvando} podeAbrir={Boolean(e.escala && e.servicos.saldo)} aoAbrir={aoAbrir} aoFechar={aoFechar} aoEncerrar={aoEncerrar} />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {e.etapa === 'encerrada' && <Button type="button" variant="outline" onClick={() => aoVer('saldo')}>Ver o saldo</Button>}
          <Button type="button" variant="outline" onClick={() => setVerRegras(true)}>Regras</Button>
        </div>
      </div>
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {liberados.length > 0 && (
        <div role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">
          {liberados.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}
      {foraDaOrdem && <p role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{foraDaOrdem}</p>}
      <MensagensDoMes
        escala={e}
        confirmacao={confirmacao}
        ocupado={salvando}
        aoFechar={() => void fechar()}
        aoEncerrar={() => void encerrar()}
        aoDesistir={() => setConfirmacao(null)}
      />
      {e.etapa === 'nao-aberto' && (
        <p className="text-apagado">
          {!e.servicos.saldo
            ? 'A escala precisa de um serviço de Saldo, com turnos. Cadastre em Escalas.'
            : e.oficiais.some((o) => o.participa)
              ? 'Abra o mês para liberar os lugares e calcular as cotas.'
              : 'Marque na lista quem participa da rodada e abra o mês.'}
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
            {aberto && <p className="text-[13px] leading-[18px] text-apagado">Clique no número do dia para marcar ou tirar o dia vermelho.</p>}
            {recente && recente.dia.startsWith(e.mes) && <p role="status" className="text-[15px] leading-[22px] font-medium">{recente.texto}</p>}
            <CalendarioDosOficiais
              escala={e}
              aoClicarTurno={aberto ? clicarLugar : undefined}
              aoTirar={e.etapa === 'escolhas' ? (t) => void tirar(t) : undefined}
              aoMarcarDia={aberto ? marcarDia : undefined}
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
            <h2 className="font-cond text-lg font-semibold">Cota de saldo</h2>
            <ListaDeCotas escala={e} aoOrdenar={e.etapa === 'nao-aberto' ? undefined : ordenar} aoMarcar={marcar} desabilitado={salvando} />
          </section>
        </aside>
      </div>
      <Dialog open={verRegras} onOpenChange={setVerRegras}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Regras da escala dos oficiais</DialogTitle>
            <DialogDescription className="sr-only">Como a escala é montada, como a cota e o saldo são calculados e o que são os dias vermelhos.</DialogDescription>
          </DialogHeader>
          <RegrasDosOficiais />
        </DialogContent>
      </Dialog>
      <Dialog open={lugar !== null} onOpenChange={(o) => !o && fecharDialogo()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quem fica neste turno?</DialogTitle>
            <DialogDescription>
              {lugar
                ? `${dm(lugar.dia)}, turno ${e.turnosDoServico.find((x) => x.id === lugar.turnoId)?.rotulo ?? ''}${donoDoLugar ? `, hoje com ${donoDoLugar.posto} ${donoDoLugar.nomeGuerra} (${NOME_DO_SERVICO[lugar.servico!]})` : ', livre'}.${e.etapa === 'fechada' ? ' Quem cobre ganha o turno, e quem saiu não fica devendo.' : ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {erroDoLugar && <p role="alert" className="text-alerta">{erroDoLugar}</p>}
          {lugar && lugar.servico === null && (
            <fieldset role="radiogroup" aria-label="O que lançar" className="flex flex-wrap gap-4 text-sm">
              {(['saldo', 'jes'] as const).map((q) => (
                <label key={q} className="flex items-center gap-2">
                  <input type="radio" name="servico-do-lugar" value={q} checked={servico === q} disabled={q === 'jes' && !e.servicos.jes} onChange={() => setServico(q)} className="size-4 accent-vinho" />
                  {NOME_DO_SERVICO[q]}
                  {q === 'jes' && !e.servicos.jes && <span className="text-[13px] text-apagado">(a escala não tem o serviço JES)</span>}
                </label>
              ))}
            </fieldset>
          )}
          <div className="grid gap-1.5">
            {ordenados.map((o) => (
              <Button key={o.militarId} type="button" variant="outline" disabled={salvando} onClick={() => lugar && lancar(lugar, o.militarId, qualServico, true)}>
                {`${o.posto} ${o.nomeGuerra}`}
                {qualServico === 'saldo' && o.militarId === e.vez && <span className="text-[13px] text-apagado">(a vez)</span>}
                {lugar && afastadoEm(o, lugar.dia) && <span className="text-[13px] text-pendencia">(afastado neste dia)</span>}
              </Button>
            ))}
            {ordenados.length === 0 && <p className="text-sm text-apagado">{qualServico === 'jes' ? 'Nenhum oficial é voluntário JES.' : 'Ninguém participa da rodada.'}</p>}
            {lugar && lugar.alocacaoId && <Button type="button" variant="ghost" disabled={salvando} onClick={() => tirar(lugar, true)}>Tirar do turno</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
