import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Data, Mes, type OcupanteDaVaga } from 'contratos';
import { useEffect, useState } from 'react';
import { foiCancelado, justificativa, mensagemDe } from '@/api/cliente';
import { consultaCotas } from '@/api/cotas';
import { acumular, consultaEscalaDoMes, desfazerRemocao, devolverRemocao, removerAlocacao, tirarAcumulo } from '@/api/escala-do-mes';
import { restantesPorServico } from '@/lib/cotas';
import { listaComE } from '@/lib/escala';
import { consultaEscalas } from '@/api/escalas';
import type { VagaDaTela } from '@/componentes/escala-do-mes/CardDaGuarnicao';

// a vaga de uma placa, sem o dia e a faixa (a tela só precisa de quem e de onde)
type DaVaga = Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>;
import { DiaDaEscalaVista } from '@/componentes/escala-do-mes/DiaDaEscala';
import { EscolherMilitar } from '@/componentes/escala-do-mes/EscolherMilitar';
import { EstadoDaEscala } from '@/componentes/escala-do-mes/EstadoDaEscala';
import { GerarPreEscala } from '@/componentes/escala-do-mes/GerarPreEscala';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { CotasRestantes } from '@/componentes/CotasRestantes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';
import { Moldura } from '@/componentes/Moldura';
import { useAviso } from '@/componentes/resposta/useAviso';
import { Espera } from '@/componentes/resposta/Espera';
import { Vazio } from '@/componentes/resposta/Vazio';

export const Route = createFileRoute('/_app/escala-do-mes')({
  validateSearch: (s: Record<string, unknown>): { escala?: string; mes?: string; dia?: string } => ({
    escala: typeof s.escala === 'string' ? s.escala : undefined,
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    // o atalho do Efetivo do dia: a escala abre já rolada até este dia
    dia: typeof s.dia === 'string' && Data.safeParse(s.dia).success ? s.dia : undefined,
  }),
  component: EscalaDoMes,
});

function EscalaDoMes() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const escalas = useQuery(consultaEscalas(eu.unidade.id));
  // numa unidade só de consulta a escala se vê e não se altera: sem gerar a pré-escala, escolher militar, remover nem permitir de novo
  const soConsulta = eu.soConsulta;
  const queryClient = useQueryClient();
  const avisar = useAviso();
  const [trocando, setTrocando] = useState<{ texto: string; desfazer: () => Promise<void> } | null>(null);
  // o motivo que o "Trocar militar" já pediu ao tirar (num turno passado): o escalar que vem em seguida o leva, e a pessoa não digita de novo
  const [motivoDaTroca, setMotivoDaTroca] = useState<string | undefined>(undefined);
  const [soVazias, setSoVazias] = useState(false);
  const [vaga, setVaga] = useState<VagaDaTela | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [gravadas, setGravadas] = useState<number | null>(null);
  // a escala de rodada de cotas (a dos oficiais) é montada em Oficiais: não aparece aqui
  const daPreEscala = escalas.data?.filter((e) => e.distribuicao === 'pre_escala') ?? [];
  const ativas = daPreEscala.filter((e) => e.ativa);
  // ao abrir, a escala do ordinário (a que tem o serviço Pronto, reconhecido pelo nome como os outros serviços fixos); sem ela, a primeira ativa. `?escala=` vence sempre
  const doOrdinario = ativas.find((e) => e.servicos.some((s) => s.trim().toLowerCase() === 'pronto'));
  const escalaId = busca.escala ?? doOrdinario?.id ?? ativas[0]?.id;
  const mes = busca.mes ?? mesAtual();
  const dados = useQuery({ ...consultaEscalaDoMes(escalaId ?? '', mes), enabled: Boolean(escalaId) });
  const cotas = useQuery({ ...consultaCotas(eu.unidade.id, mes), enabled: Boolean(escalaId) });
  const opcoes = daPreEscala.filter((e) => e.ativa || e.id === escalaId);
  // rola uma vez ao carregar a escala (não a cada gravação, que troca os dados mas não a escala nem o mês)
  const carregada = dados.data ? `${dados.data.escalaId}|${dados.data.mes}` : null;
  useEffect(() => {
    if (busca.dia && carregada) document.getElementById(`dia-${busca.dia}`)?.scrollIntoView({ block: 'start' });
  }, [busca.dia, carregada]);

  /** O que saiu da vaga e como desfazer: o aviso diz quem saiu de onde, e "Desfazer" devolve à mesma vaga (a API recusa se a escala mudou desde então). */
  async function tirar(o: OcupanteDaVaga, guarnicao: string, daVaga?: DaVaga): Promise<{ texto: string; desfazer: () => Promise<void> }> {
    const texto = daVaga ? `${o.posto} ${o.nomeGuerra} saiu de ${daVaga.funcao} da ${guarnicao}.` : `${o.posto} ${o.nomeGuerra} saiu do turno.`;
    if (o.acumuloId !== null) {
      // um acúmulo sai sozinho (o militar continua na vaga original)
      await tirarAcumulo(queryClient, o.acumuloId);
      return { texto, desfazer: async () => void (await acumular(queryClient, o.alocacaoId, { guarnicaoId: daVaga!.guarnicaoId, funcaoId: daVaga!.funcaoId })) };
    }
    const { remocaoId } = await removerAlocacao(queryClient, o.alocacaoId);
    return { texto, desfazer: async () => void (await devolverRemocao(queryClient, remocaoId)) };
  }
  async function remover(o: OcupanteDaVaga, guarnicao: string, _dia: number, _vaga: string, daVaga?: DaVaga) {
    setErro(null);
    try {
      avisar(await tirar(o, guarnicao, daVaga));
    } catch (e) {
      if (!foiCancelado(e)) avisar({ texto: mensagemDe(e), erro: true });
    }
  }
  // "Trocar militar": tira quem está na vaga (sem perguntar: a pessoa acabou de escolher trocar) e abre a escolha da mesma vaga em seguida;
  // se a pessoa desistir da escolha, a vaga fica vazia e o aviso de quem saiu, com o "Desfazer", aparece
  async function trocar(o: OcupanteDaVaga, guarnicao: string, daVaga: VagaDaTela) {
    setErro(null);
    try {
      const antes = justificativa.ultimo()?.n;
      setTrocando(await tirar(o, guarnicao, daVaga));
      const depois = justificativa.ultimo();
      setMotivoDaTroca(depois && depois.n !== antes ? depois.texto : undefined);
      setVaga(daVaga);
    } catch (e) {
      if (!foiCancelado(e)) avisar({ texto: mensagemDe(e), erro: true });
    }
  }
  async function desfazer(remocaoId: string) {
    setErro(null);
    try {
      await desfazerRemocao(queryClient, remocaoId);
    } catch (e) {
      setErro(foiCancelado(e) ? null : mensagemDe(e));
    }
  }

  if (escalas.isPending) return <Espera />;
  if (escalas.error) return <p role="alert" className="text-alerta">{mensagemDe(escalas.error)}</p>;
  if (!escalaId) {
    return (
      <Moldura titulo="Escala do mês">
        {/* numa unidade só de consulta a pessoa não cria escala: sem o caminho */}
        <Vazio titulo="Nenhuma escala ativa" frase={soConsulta ? 'Esta unidade ainda não tem escala ativa.' : 'Crie uma escala para montar o mês.'} acao={soConsulta ? undefined : { rotulo: 'Ir para Escalas', para: '/escalas' }} />
      </Moldura>
    );
  }

  const resumo = dados.data?.resumo;
  // as cotas dos serviços que aparecem nos turnos das faixas do mês
  const servicosDaEscala = [...new Set((dados.data?.dias ?? []).flatMap((d) => d.faixas.flatMap((f) => f.turnos.map((t) => t.servicoId))))];
  return (
    <Moldura titulo="Escala do mês">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="em-escala">Escala</Label>
          <Selecao id="em-escala" value={escalaId} onChange={(e) => void navigate({ search: (s) => ({ ...s, escala: e.target.value }) })} className="w-56">
            {opcoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="em-mes">Mês</Label>
          <CampoDeMes id="em-mes" valor={mes} aoMudar={(m) => void navigate({ search: (s) => ({ ...s, mes: m }) })} />
        </div>
        {resumo && (
          <p className="text-sm">
            {resumo.obrigatorias - resumo.obrigatoriasVazias} de {resumo.obrigatorias} vagas obrigatórias preenchidas,{' '}
            <span className={cn(resumo.obrigatoriasVazias > 0 && 'font-medium text-pendencia')}>{resumo.obrigatoriasVazias} vazias</span>
          </p>
        )}
        {!soConsulta && (
          <Button type="button" onClick={() => setGerando(true)} className="ml-auto">
            Gerar pré-escala
          </Button>
        )}
        <Button type="button" variant="secundario" aria-pressed={soVazias} onClick={() => setSoVazias(!soVazias)} className={soConsulta ? 'ml-auto' : undefined}>
          Ocultar guarnições completas
        </Button>
      </div>

      {dados.data && <EstadoDaEscala escala={dados.data} soConsulta={soConsulta} />}
      <CotasRestantes cotas={restantesPorServico(cotas.data ?? [], servicosDaEscala)} />
      {gravadas !== null && <p role="status" className="text-sm text-apagado">Pré-escala gravada: {gravadas} {gravadas === 1 ? 'serviço' : 'serviços'}.</p>}
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {dados.isPending && <Espera />}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {dados.data && (
        // um turno por dia em todo o mês (Defensoria, CPRH): os dias ficam lado a lado; basta um dia com mais de uma faixa para o mês todo ter um dia por linha
        <div
          data-dias-em-grade={dados.data.dias.length > 0 && dados.data.dias.every((d) => d.faixas.length <= 1) ? '' : undefined}
          className={cn('grid gap-3', dados.data.dias.length > 0 && dados.data.dias.every((d) => d.faixas.length <= 1) && 'grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start')}
        >
          {dados.data.dias.map((d) => <DiaDaEscalaVista key={d.data} dia={d} soVazias={soVazias} aoEscolher={soConsulta ? undefined : setVaga} aoRemover={soConsulta ? undefined : (o, g, n, v, daVaga) => void remover(o, g, n, v, daVaga)} aoTrocar={soConsulta ? undefined : (o, g, _n, _v, daVaga) => void trocar(o, g, daVaga)} aoDesfazer={soConsulta ? undefined : (id) => void desfazer(id)} />)}
        </div>
      )}
      {gerando && <GerarPreEscala escalaId={escalaId} mes={mes} aoFechar={() => setGerando(false)} aoGravar={setGravadas} />}
      {vaga && (
        <EscolherMilitar
          key={`${vaga.data}|${vaga.inicio}|${vaga.guarnicaoId}|${vaga.funcaoId}`}
          escalaId={escalaId}
          vaga={vaga}
          justificativa={motivoDaTroca}
          aoFechar={(escolheu) => {
            setVaga(null);
            setMotivoDaTroca(undefined);
            // desistiu da escolha depois de "Trocar militar": a vaga ficou vazia, e o aviso oferece o "Desfazer"
            if (trocando && !escolheu) avisar(trocando);
            setTrocando(null);
          }}
        />
      )}
    </Moldura>
  );
}
