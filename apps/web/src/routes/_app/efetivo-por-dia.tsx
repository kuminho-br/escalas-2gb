import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Data, type DesfazerDesativacao, type FuncaoNoEfetivo, type GuarnicaoNoEfetivo, type OpcaoDaVaga, type TrechoNoEfetivo } from 'contratos';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEfetivoDoDia, desativar, desfazerDesativacao, gravarMetaDoDia, voltarMetaAoPadrao } from '@/api/efetivo-do-dia';
import { CotasRestantes } from '@/componentes/CotasRestantes';
import { AdicionarGuarnicao } from '@/componentes/efetivo-por-dia/AdicionarGuarnicao';
import { AlocacoesDoTrecho } from '@/componentes/efetivo-por-dia/AlocacoesDoTrecho';
import { CardDoEfetivo } from '@/componentes/efetivo-por-dia/CardDoEfetivo';
import { EscolherHorarioDaVaga } from '@/componentes/efetivo-por-dia/EscolherHorarioDaVaga';
import type { VagaDaTela } from '@/componentes/escala-do-mes/CardDaGuarnicao';
import { EscolherMilitar } from '@/componentes/escala-do-mes/EscolherMilitar';
import { AvisoDesfazer } from '@/componentes/efetivo-por-dia/AvisoDesfazer';
import { ConfirmarVoltarAoPadrao } from '@/componentes/efetivo-por-dia/ConfirmarVoltarAoPadrao';
import { Desativadas } from '@/componentes/efetivo-por-dia/Desativadas';
import { DesativarGuarnicao } from '@/componentes/efetivo-por-dia/DesativarGuarnicao';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { guardarUltimoDia, janelaDoDia, ultimoDiaVisto } from '@/lib/efetivo';
import { diaDaSemanaPorExtenso, hoje, somarDias } from '@/lib/meses';

export const Route = createFileRoute('/_app/efetivo-por-dia')({
  validateSearch: (s: Record<string, unknown>): { data?: string } => ({ data: typeof s.data === 'string' && Data.safeParse(s.data).success ? s.data : undefined }),
  component: EfetivoPorDia,
});

type VagaClicada = { g: GuarnicaoNoEfetivo; funcao: FuncaoNoEfetivo; trecho: TrechoNoEfetivo };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A tela de trabalho do escalante: navegar pelos dias e escalar com a visão diária, atravessando todas as escalas da área. */
function EfetivoPorDia() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  // sem data no endereço, abre no último dia visto nesta tela (guardado no navegador); sem ele, hoje
  const [inicial] = useState(() => ultimoDiaVisto() ?? hoje());
  const data = busca.data ?? inicial;
  useEffect(() => guardarUltimoDia(data), [data]);
  const dados = useQuery(consultaEfetivoDoDia(eu.unidade.id, data));
  const [adicionando, setAdicionando] = useState(false);
  const [desativando, setDesativando] = useState<GuarnicaoNoEfetivo | null>(null);
  const [voltando, setVoltando] = useState(false);
  // o que a última desativação tirou, para o "Desfazer" (some em 10 s, ao trocar de dia ou na próxima ação de meta)
  const [aviso, setAviso] = useState<{ texto: string; desfazer: DesfazerDesativacao } | null>(null);
  const [erroDoAviso, setErroDoAviso] = useState<string | null>(null);
  useEffect(() => {
    setAviso(null);
    setErroDoAviso(null);
  }, [data]);
  const limparAviso = () => {
    setAviso(null);
    setErroDoAviso(null);
  };
  // o erro de uma gravação feita num diálogo aparece no próprio diálogo (achado da revisão final)
  const [erroNoDialogo, setErroNoDialogo] = useState<string | null>(null);
  // escalar: a vaga clicada (e, quando ela cai em mais de uma escala, a escolhida); remover: o trecho ocupado clicado
  const [vaga, setVaga] = useState<VagaClicada | null>(null);
  const [opcao, setOpcao] = useState<OpcaoDaVaga | null>(null);
  const [ocupado, setOcupado] = useState<{ funcao: string; trecho: TrechoNoEfetivo } | null>(null);
  const fecharVaga = () => {
    setVaga(null);
    setOpcao(null);
  };
  const clicarVaga = (g: GuarnicaoNoEfetivo) => (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => {
    setVaga({ g, funcao, trecho });
    setOpcao(trecho.opcoes.length === 1 ? trecho.opcoes[0]! : null);
  };
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const irPara = (d: string) => void navigate({ search: (s) => ({ ...s, data: d }) });

  const voltarAoPadrao = travar(async () => {
    setErro(null);
    setErroNoDialogo(null);
    limparAviso();
    try {
      await voltarMetaAoPadrao(queryClient, eu.unidade.id, data);
      setVoltando(false);
    } catch (e) {
      setErroNoDialogo(mensagemDe(e));
    }
  });

  const e = dados.data;
  const janela = e ? janelaDoDia(e.guarnicoes) : null;
  // a meta do dia muda pela própria tela (decisão de 20/11/2026): subir, descer, adicionar e tirar gravam a lista do dia
  const naMeta = (e?.guarnicoes ?? []).filter((g) => g.ordem !== null).map((g) => g.guarnicaoId);
  const gravarMeta = travar(async (lista: string[], noDialogo = false) => {
    setErro(null);
    setErroNoDialogo(null);
    limparAviso();
    try {
      await gravarMetaDoDia(queryClient, eu.unidade.id, data, lista);
      setAdicionando(false);
    } catch (x) {
      (noDialogo ? setErroNoDialogo : setErro)(mensagemDe(x));
    }
  });
  const mover = (i: number, passo: -1 | 1) => {
    const lista = [...naMeta];
    [lista[i], lista[i + passo]] = [lista[i + passo]!, lista[i]!];
    void gravarMeta(lista);
  };
  const desativarGuarnicao = travar(async (g: GuarnicaoNoEfetivo, noDialogo = false) => {
    setErro(null);
    setErroNoDialogo(null);
    limparAviso();
    try {
      const r = await desativar(queryClient, eu.unidade.id, data, g.guarnicaoId);
      setDesativando(null);
      setAviso({ texto: `${g.nome} desativada.`, desfazer: r.desfazer });
    } catch (x) {
      (noDialogo ? setErroNoDialogo : setErro)(mensagemDe(x));
    }
  });
  const desfazerUltima = travar(async () => {
    if (!aviso) return;
    setErroDoAviso(null);
    try {
      await desfazerDesativacao(queryClient, eu.unidade.id, data, aviso.desfazer);
      limparAviso();
    } catch (x) {
      setErroDoAviso(mensagemDe(x));
    }
  });
  const controlesDa = (g: GuarnicaoNoEfetivo) => {
    const i = naMeta.indexOf(g.guarnicaoId);
    if (i < 0) return undefined;
    return {
      aoMoverAntes: i > 0 ? () => mover(i, -1) : undefined,
      aoMoverDepois: i < naMeta.length - 1 ? () => mover(i, 1) : undefined,
      // sem ninguém escalado no dia, desativa direto; com gente, pergunta
      aoDesativar: () => {
        setErroNoDialogo(null);
        if (g.alocados === 0) void desativarGuarnicao(g);
        else setDesativando(g);
      },
      salvando,
    };
  };
  return (
    <section className="grid gap-4">
      <h1 className="font-cond text-[28px] leading-tight font-semibold">Efetivo por dia</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" size="icon" aria-label="Dia anterior" onClick={() => irPara(somarDias(data, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="grid gap-1.5">
          <Label htmlFor="ed-data">Dia</Label>
          <Input id="ed-data" type="date" value={data} onChange={(ev) => ev.target.value && irPara(ev.target.value)} className="w-44" />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Dia seguinte" onClick={() => irPara(somarDias(data, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        <p className="text-sm text-apagado">{diaDaSemanaPorExtenso(data)}</p>
      </div>

      {dados.isPending && <p className="text-apagado">Carregando…</p>}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {e && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-medium">
              Meta do dia: {e.meta.total === 0 ? 'nenhuma guarnição' : `${plural(e.meta.total, 'guarnição', 'guarnições')}, ${plural(e.meta.ativadas, 'ativada', 'ativadas')}`}
            </p>
            {e.meta.origem === 'dia' && <span className="rounded-full bg-pendencia-fundo px-2 py-0.5 text-xs font-medium text-pendencia">Meta alterada neste dia</span>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={salvando || e.meta.origem === 'padrao'}
              onClick={() => {
                setErroNoDialogo(null);
                setVoltando(true);
              }}
            >
              Voltar ao padrão
            </Button>
          </div>
          <CotasRestantes cotas={e.cotas} />
          {aviso && <AvisoDesfazer texto={aviso.texto} erro={erroDoAviso} salvando={salvando} aoDesfazer={() => void desfazerUltima()} aoSumir={limparAviso} />}
          {e.guarnicoes.length === 0 ? (
            <p className="text-apagado">Nenhuma guarnição na meta nem escalada neste dia.</p>
          ) : (
            <div data-cards-do-efetivo className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] items-start gap-3">
              {e.guarnicoes.map((g) => (
                <CardDoEfetivo
                  key={g.guarnicaoId}
                  g={g}
                  janela={janela}
                  acoes={{ aoClicarVaga: clicarVaga(g), aoClicarOcupado: (funcao, trecho) => setOcupado({ funcao: funcao.funcao, trecho }) }}
                  meta={controlesDa(g)}
                />
              ))}
            </div>
          )}
          <Desativadas guarnicoes={e.desativadas} salvando={salvando} aoReativar={(id) => void gravarMeta([...naMeta, id])} />
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => {
                setErroNoDialogo(null);
                setAdicionando(true);
              }}
            >
              Adicionar guarnição
            </Button>
          </div>
          {vaga && !opcao && vaga.trecho.opcoes.length > 1 && <EscolherHorarioDaVaga opcoes={vaga.trecho.opcoes} aoEscolher={setOpcao} aoFechar={fecharVaga} />}
          {vaga && opcao && (
            <EscolherMilitar
              escalaId={opcao.escalaId}
              vaga={{
                data, inicio: opcao.inicio, fim: opcao.fim, guarnicaoId: vaga.g.guarnicaoId, guarnicao: vaga.g.nome,
                funcaoId: vaga.funcao.funcaoId, funcao: vaga.funcao.funcao, cnhExigida: vaga.funcao.cnhExigida as VagaDaTela['cnhExigida'],
              }}
              aoFechar={fecharVaga}
            />
          )}
          {ocupado && <AlocacoesDoTrecho funcao={ocupado.funcao} trecho={ocupado.trecho} aoFechar={() => setOcupado(null)} />}
          {adicionando && (
            <AdicionarGuarnicao
              unidadeId={eu.unidade.id}
              data={data}
              naMeta={naMeta}
              salvando={salvando}
              erro={erroNoDialogo}
              aoEscolher={(id) => void gravarMeta([...naMeta, id], true)}
              aoFechar={() => setAdicionando(false)}
            />
          )}
          {desativando && (
            <DesativarGuarnicao nome={desativando.nome} salvando={salvando} erro={erroNoDialogo} aoDesativar={() => void desativarGuarnicao(desativando, true)} aoFechar={() => setDesativando(null)} />
          )}
          {voltando && <ConfirmarVoltarAoPadrao salvando={salvando} erro={erroNoDialogo} aoVoltar={() => void voltarAoPadrao()} aoFechar={() => setVoltando(false)} />}
        </>
      )}
    </section>
  );
}
