import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { PROCURAR_EM_PADRAO, type FiltrosDaBusca, type LinhaDaBusca, type LinhaDaConsulta, type UnidadeDaConsulta } from 'contratos';
import { Search } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { buscarTodos, consultaDaBuscaComFiltros, consultaUnidadesDaBusca } from '@/api/consulta';
import { ehMilitarComum } from '@/api/eu';
import { podeCadastrarMilitar, unidadeDoPeculio } from '@/api/peculio';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { Moldura } from '@/componentes/Moldura';
import { BotaoDosCriterios, PainelDosCriterios, rotuloDoCampo, type Aba } from '@/componentes/peculio/CriteriosDePesquisa';
import { CRITERIOS_VAZIOS, usePesquisaDoPeculio, type Criterios, type ProcurarEm } from '@/componentes/peculio/EstadoDaPesquisa';
import { EtiquetasDosCriterios, semOCriterio, useEtiquetasDosCriterios } from '@/componentes/peculio/EtiquetasDosCriterios';
import { ExportarMilitares } from '@/componentes/peculio/ExportarMilitares';
import { contarExtras, extrasParaFiltros } from '@/componentes/peculio/FiltrosDaPesquisa';
import { classeDaLinhaDeMilitar, ListaDeMilitares } from '@/componentes/peculio/ListaDeMilitares';
import { PainelDeSelecionados } from '@/componentes/peculio/PainelDeSelecionados';
import { useSelecao } from '@/componentes/peculio/Selecao';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { marcarTrecho, palavrasDoCampo } from '@/lib/marcar-trecho';
import { useEhCelular } from '@/lib/useEhCelular';
import { cn } from '@/lib/utils';

export const MSG_BUSCA_CURTA = 'Digite pelo menos 3 letras ou escolha uma unidade.';
export const MSG_HA_MAIS = 'Há mais militares. Refine a busca.';
/** Tirar a última etiqueta deixa a busca sem critério: a tela pede um, sem apagar o texto da barra nem a seleção (6.63). */
export const MSG_ESCOLHA_UM_FILTRO = 'Escolha pelo menos um filtro.';
const DICA_DA_BUSCA = 'Busque pela matrícula ou pelo nome de guerra. Para ver quem está lotado numa unidade, escolha a unidade em “Lotados em”.';
const SEM_UNIDADES: UnidadeDaConsulta[] = [];

type Busca = { texto?: string; unidade?: string };

export const Route = createFileRoute('/_app/peculio_/pesquisar')({
  // a busca fica no endereço: voltar da ficha de consulta traz o mesmo resultado
  validateSearch: (s: Record<string, unknown>): Busca => ({
    texto: typeof s.texto === 'string' && s.texto.trim() ? s.texto.trim() : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  component: Consulta,
});

const ehPadrao = (p: ProcurarEm) => p.matricula === PROCURAR_EM_PADRAO.matricula && p.nomeDeGuerra === PROCURAR_EM_PADRAO.nomeDeGuerra && p.nomeCompleto === PROCURAR_EM_PADRAO.nomeCompleto;

/** Os filtros da busca: o texto da barra, "Lotados em" (ou as marcas da árvore, que valem no lugar) e os critérios das abas. O padrão de onde procurar nem vai. */
function filtrosDe(campo: string, escolhida: string, c: Criterios, nivel: boolean): FiltrosDaBusca {
  return {
    ...(campo.trim() ? { texto: campo.trim() } : {}),
    ...(c.marcas.length ? { unidades: c.marcas } : escolhida ? { unidades: [{ id: escolhida, comAsDeBaixo: true }] } : {}),
    ...(ehPadrao(c.procurarEm) ? {} : { procurarEm: c.procurarEm }),
    ...(nivel && c.matriculas.length ? { matriculas: c.matriculas } : {}),
    ...(nivel ? extrasParaFiltros(c.extras) : {}),
  };
}

/** Os filtros em vigor dizem o que buscar (texto de 3 letras ou mais, uma unidade ou qualquer outro filtro)? Onde o texto procura não é filtro. */
const temBusca = (f: FiltrosDaBusca): boolean => (f.texto ?? '').length >= 3 || Boolean(f.unidades?.length) || Object.keys(f).some((k) => k !== 'texto' && k !== 'unidades' && k !== 'procurarEm');

/**
 * Pesquisar militares (era a "Consulta de militares", 6.11; é uma tela do Pecúlio Geral desde a 6.50): todo militar com conta busca qualquer militar da corporação.
 * A linha mostra a identificação; abrir leva à ficha dentro do Pecúlio, completa para quem tem nível de acesso sobre ele e de consulta para os outros.
 * Desde a 6.51 a busca tem a lotação pela árvore (várias unidades), e, para quem tem nível de acesso, o arquivo de matrículas e outros filtros. A busca só sai no "Buscar".
 * Desde a 6.63, os filtros vivem num botão só, "Critérios de pesquisa", com uma etiqueta por critério em uso; os selecionados ficam num painel ao lado; Importar e Exportar ficam no alto.
 */
function Consulta() {
  const { eu } = Route.useRouteContext();
  const nivel = !ehMilitarComum(eu);
  const { texto = '', unidade = '' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const chaveDoEndereco = `${texto}|${unidade}`;
  const { reler } = useSelecao();
  // o que a pessoa montou (os critérios das abas, a busca em vigor) vive acima das rotas (6.52): abrir a ficha e voltar não o perde
  const { estado, mudar, reiniciar } = usePesquisaDoPeculio();
  // o endereço mudou por fora (voltar ou avançar no navegador, ou outro caminho até aqui): vale o que ele diz, sem o que estava montado. O "Buscar" muda o endereço e a chave
  // do estado juntos, então não cai aqui. Só o endereço faz o efeito rodar de novo (as funções do estado são estáveis).
  const chaveDoEstado = useRef(estado.chave);
  chaveDoEstado.current = estado.chave;
  useLayoutEffect(() => {
    if (chaveDoEstado.current !== chaveDoEndereco) reiniciar(chaveDoEndereco);
  }, [chaveDoEndereco, reiniciar]);
  const { aplicados, valendo } = estado;
  const criterios: Criterios = { marcas: estado.marcas, matriculas: estado.matriculas, extras: estado.extras, procurarEm: estado.procurarEm };

  /** Faz a busca com os critérios dados; devolve a frase do que falta, ou null quando a busca saiu. `semFiltro`: a frase para quando nada está valendo. */
  const buscar = (campo: string, escolhida: string, c: Criterios, semFiltro = MSG_BUSCA_CURTA): string | null => {
    const f = filtrosDe(campo, escolhida, c, nivel);
    if (campo.trim().length < 3 && !f.unidades?.length && !f.matriculas?.length && contarExtras(c.extras) === 0) {
      return semFiltro;
    }
    // o endereço guarda só o texto e a unidade escolhida no campo (os critérios das abas ficam no estado, que o acompanha pela chave)
    const novoTexto = campo.trim();
    const novaUnidade = c.marcas.length ? '' : escolhida;
    mudar({ ...c, aplicados: f, valendo: c, chave: `${novoTexto}|${novaUnidade}` });
    void navigate({ search: { texto: novoTexto || undefined, unidade: novaUnidade || undefined } });
    return null;
  };
  /** O x de uma etiqueta (ou "Limpar critérios"): tira o critério dos que valem e busca de novo; sem nada que buscar, o resultado some e a tela pede um critério. */
  const aplicarCriterios = (novo: Criterios, campo: string, escolhida: string): string | null => {
    const problema = buscar(campo, escolhida, novo, MSG_ESCOLHA_UM_FILTRO);
    if (problema) mudar({ ...novo, aplicados: {}, valendo: novo });
    return problema;
  };

  const vigentes: FiltrosDaBusca = aplicados ?? { ...(texto ? { texto } : {}), ...(unidade ? { unidades: [{ id: unidade, comAsDeBaixo: true }] } : {}) };
  const unidadeDoPecu = unidadeDoPeculio(eu);
  return (
    <Moldura
      titulo="Pesquisar militares"
      acaoPrincipal={
        // Importar e Exportar ficam sempre no mesmo lugar, ao lado do título (6.63). O Importar é o do Pecúlio, na unidade do Pecúlio, de quem cuida do pessoal
        <div className="flex flex-wrap gap-2">
          {podeCadastrarMilitar(eu) && <ImportarPlanilha cadastro="peculio" rotulo="o Pecúlio" unidadeId={unidadeDoPecu.id} destino={unidadeDoPecu.sigla} aoConcluir={reler} />}
          {nivel && <ExportarMilitares filtros={temBusca(vigentes) ? vigentes : null} />}
        </div>
      }
    >
      {/* key: voltar ou avançar no navegador põe os campos no que a busca do endereço diz */}
      <Formulario
        key={chaveDoEndereco}
        texto={texto}
        unidade={unidade}
        nivel={nivel}
        criterios={criterios}
        valendo={valendo}
        aoMudar={(parte) => mudar(parte)}
        aoBuscar={(campo, escolhida) => buscar(campo, escolhida, criterios)}
        aoTirar={(chave, campo, escolhida) => aplicarCriterios(semOCriterio(valendo, chave), campo, escolhida)}
        aoLimpar={(campo, escolhida) => aplicarCriterios(CRITERIOS_VAZIOS, campo, escolhida)}
      />
      <div className={cn('grid gap-5', nivel && 'md:grid-cols-[minmax(0,1fr)_20rem] md:items-start')}>
        <Resultado filtros={vigentes} nivel={nivel} endereco={{ texto, unidade }} />
        {nivel && <PainelDeSelecionados />}
      </div>
    </Moldura>
  );
}

function Formulario({
  texto, unidade, nivel, criterios, valendo, aoMudar, aoBuscar, aoTirar, aoLimpar,
}: {
  texto: string;
  unidade: string;
  nivel: boolean;
  criterios: Criterios;
  valendo: Criterios;
  aoMudar: (parte: Partial<Criterios>) => void;
  aoBuscar: (campo: string, escolhida: string) => string | null;
  aoTirar: (chave: string, campo: string, escolhida: string) => string | null;
  aoLimpar: (campo: string, escolhida: string) => string | null;
}) {
  const unidades = useQuery(consultaUnidadesDaBusca);
  const [campo, setCampo] = useState(texto);
  const [escolhida, setEscolhida] = useState(unidade);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Aba>('texto');
  const celular = useEhCelular();
  const idDoPainel = useId();
  const etiquetas = useEtiquetasDosCriterios(valendo, unidades.data ?? SEM_UNIDADES);
  const buscar = (e?: FormEvent) => {
    e?.preventDefault();
    const problema = aoBuscar(campo, escolhida);
    setErro(problema);
    // buscou: o painel se fecha, para o resultado aparecer logo abaixo; o que ele montou fica resumido nas etiquetas
    if (!problema) setAberto(false);
  };
  const limparRascunho = () => {
    aoMudar(CRITERIOS_VAZIOS);
    setErro(null);
  };
  return (
    <div className="grid gap-3">
      <form onSubmit={buscar} role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto_auto] sm:items-end">
        <div className="grid min-w-0 gap-1.5 sm:col-auto">
          <Label htmlFor="consulta-texto">{rotuloDoCampo(criterios.procurarEm)}</Label>
          <Input
            id="consulta-texto"
            type="search"
            value={campo}
            onChange={(e) => setCampo(e.target.value)}
            className="bg-superficie"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? 'consulta-erro' : undefined}
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="consulta-unidade">Lotados em</Label>
          {/* pela árvore, nó a nó (6.45): a busca pega a unidade escolhida e as de baixo; sem unidade, toda a corporação. Com nós marcados na árvore dos critérios, valem eles */}
          <EscolherUnidade id="consulta-unidade" rotulo="Lotados em" unidades={unidades.data ?? []} valor={criterios.marcas.length ? '' : escolhida} aoEscolher={setEscolhida} permiteLimpar textoVazio={criterios.marcas.length ? 'Marcadas na árvore' : 'Toda a corporação'} disabled={criterios.marcas.length > 0} />
        </div>
        <BotaoDosCriterios emUso={etiquetas.length} aberto={aberto} aoAlternar={() => setAberto((a) => !a)} idDoPainel={idDoPainel} />
        <Button type="submit">
          <Search aria-hidden />
          Buscar
        </Button>
      </form>
      {erro && <p id="consulta-erro" role="alert" className="text-sm text-alerta">{erro}</p>}
      <EtiquetasDosCriterios
        etiquetas={etiquetas}
        aoTirar={(chave) => setErro(aoTirar(chave, campo, escolhida))}
        aoLimpar={() => setErro(aoLimpar(campo, escolhida))}
      />
      <PainelDosCriterios
        id={idDoPainel}
        aberto={aberto}
        celular={celular}
        criterios={criterios}
        aoMudar={aoMudar}
        nivel={nivel}
        unidades={unidades.data ?? SEM_UNIDADES}
        aba={aba}
        aoMudarAba={setAba}
        aoBuscar={buscar}
        aoLimpar={limparRascunho}
        aoFechar={() => setAberto(false)}
      />
    </div>
  );
}

function Resultado({ filtros, nivel, endereco }: { filtros: FiltrosDaBusca; nivel: boolean; endereco: { texto: string; unidade: string } }) {
  const tem = temBusca(filtros);
  const busca = useQuery({ ...consultaDaBuscaComFiltros(filtros), enabled: tem });
  if (!tem) return <p className="max-w-xl text-apagado">{DICA_DA_BUSCA}</p>;
  if (busca.isPending) return <p className="text-apagado">Buscando…</p>;
  if (busca.error) return <p role="alert" className="text-alerta">{mensagemDe(busca.error)}</p>;
  const { militares, haMais, naoEncontradas } = busca.data;
  const em = filtros.procurarEm ?? PROCURAR_EM_PADRAO;
  const palavras = palavrasDoCampo(filtros.texto ?? '');
  return (
    <div className="min-w-0">
      {naoEncontradas.length > 0 && <NaoEncontradas matriculas={naoEncontradas} />}
      {haMais && <p role="status" className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{nivel ? `Mais de ${militares.length} militares. Afine a busca.` : MSG_HA_MAIS}</p>}
      {militares.length === 0 ? (
        <p className="max-w-xl text-apagado">
          Nenhum militar encontrado. Confira o texto e os critérios em uso.
          {!em.nomeCompleto && (filtros.texto ?? '').length >= 3 && ' O nome completo está desligado nos critérios.'}
        </p>
      ) : (
        <>
          {/* a seleção é de quem tem nível de acesso: o militar comum vê só a lista */}
          {nivel && <SelecionarEstes key={JSON.stringify(filtros)} militares={militares} haMais={haMais} filtros={filtros} />}
          <ListaDeMilitares rotulo="Militares encontrados">
            {militares.map((m) => <LinhaDaPesquisa key={m.id} m={m} selecionavel={nivel} texto={endereco.texto} unidade={endereco.unidade} palavras={palavras} em={em} />)}
          </ListaDeMilitares>
        </>
      )}
    </div>
  );
}

/**
 * "Selecionar estes {n}": as linhas da tela sobre as quais a pessoa tem nível de acesso. Com "mais de 500" a tela só mostra 500, e o botão vira "Selecionar todos" (6.54): busca a
 * lista inteira do filtro (até 5000) e seleciona quem a pessoa pode alterar; passando de 5000, a API pede para afinar a busca. Quantos ficam de fora vem da lista inteira,
 * e não dos 500 da tela (6.63).
 */
function SelecionarEstes({ militares, haMais, filtros }: { militares: LinhaDaBusca[]; haMais: boolean; filtros: FiltrosDaBusca }) {
  const { incluir } = useSelecao();
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // a lista inteira do filtro: a mesma que a exportação lê (o cache é um só); só quando a tela cortou em 500
  const inteira = useQuery({ queryKey: ['consulta', 'militares', 'todos', filtros], queryFn: () => buscarTodos(filtros), enabled: haMais, retry: false });
  const alteraveis = militares.filter((m) => m.podeAlterar);
  const fora = haMais ? (inteira.data ? inteira.data.militares.filter((m) => !m.podeAlterar).length : null) : militares.length - alteraveis.length;
  const selecionarTodos = async () => {
    setBuscando(true);
    setErro(null);
    try {
      const todos = (await buscarTodos(filtros)).militares;
      incluir(todos.filter((m) => m.podeAlterar));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setBuscando(false);
    }
  };
  if (alteraveis.length === 0 && !fora && !haMais) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {haMais ? (
        <Button type="button" variant="secundario" disabled={buscando} onClick={() => void selecionarTodos()}>{buscando ? 'Buscando…' : 'Selecionar todos'}</Button>
      ) : (
        alteraveis.length > 0 && <Button type="button" variant="secundario" onClick={() => incluir(alteraveis)}>{`Selecionar estes ${alteraveis.length}`}</Button>
      )}
      {erro && <span role="alert" className="text-apoio text-alerta">{erro}</span>}
      {fora !== null && fora > 0 && <span className="text-apoio text-apagado">{fora === 1 ? '1 militar fica de fora: você não tem nível de acesso sobre ele.' : `${fora} militares ficam de fora: você não tem nível de acesso sobre eles.`}</span>}
      {!haMais && <span className="ml-auto text-apoio text-apagado">{militares.length === 1 ? '1 militar' : `${militares.length} militares`}</span>}
    </div>
  );
}

function NaoEncontradas({ matriculas }: { matriculas: string[] }) {
  return (
    <details className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia" open>
      <summary className="cursor-pointer">{matriculas.length === 1 ? '1 matrícula não encontrada' : `${matriculas.length} matrículas não encontradas`}</summary>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">{matriculas.map((m) => <li key={m}>{m}</li>)}</ul>
    </details>
  );
}

/** O texto com o trecho achado marcado (6.63): só nos campos em que a busca procurou. */
function Marcado({ texto, palavras, ligado }: { texto: string; palavras: string[]; ligado: boolean }) {
  if (!ligado || palavras.length === 0) return <>{texto}</>;
  return (
    <>
      {marcarTrecho(texto, palavras).map((p, i) => (p.marcado ? <mark key={i} className="rounded-xs bg-pendencia-fundo text-inherit">{p.texto}</mark> : <span key={i}>{p.texto}</span>))}
    </>
  );
}

/**
 * A linha do resultado: posto e nome de guerra, a lotação no canto, e embaixo o nome completo, a matrícula e o quadro; com a situação, mostra-a também. O trecho que a busca achou
 * fica marcado, nos campos em que ela procurou. Para quem tem nível de acesso (`selecionavel`), a marca de selecionar fica ao lado, fora do link: marcar não abre a ficha.
 * Quem a pessoa não pode alterar tem a marca desligada.
 */
function LinhaDaPesquisa({ m, texto, unidade, palavras, em, selecionavel = false }: { m: LinhaDaConsulta & Partial<LinhaDaBusca>; texto: string; unidade: string; palavras: string[]; em: ProcurarEm; selecionavel?: boolean }) {
  const selecao = useSelecao();
  const situacao = [m.equipe, m.jornada === 'pronto' ? 'Pronto' : m.jornada === 'adm' ? 'ADM' : null, m.situacao].filter(Boolean);
  const alteravel = m.podeAlterar === true;
  return (
    <li className="flex items-stretch">
      {selecionavel && (
        <span className="grid w-12 shrink-0 place-items-center">
          <Checkbox
            aria-label={`Selecionar ${m.postoGrad} ${m.nomeGuerra}`}
            checked={selecao.tem(m.id)}
            disabled={!alteravel}
            title={alteravel ? undefined : 'Você não tem nível de acesso sobre este militar.'}
            onChange={() => alteravel && selecao.alternar(m as LinhaDaBusca)}
          />
        </span>
      )}
      <Link to="/peculio/militar/$id" params={{ id: m.id }} search={{ de: 'pesquisa', texto: texto || undefined, unidade: unidade || undefined }} className={`${classeDaLinhaDeMilitar} min-w-0 flex-1`}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-cond text-apoio text-apagado">{m.postoGrad}</span>
          <span className="shrink-0 font-cond text-base font-semibold"><Marcado texto={m.nomeGuerra} palavras={palavras} ligado={em.nomeDeGuerra} /></span>
          {/* o caminho longo corta com reticências; o nome não encolhe (em 360 px) */}
          <span title={m.lotacaoCaminho ?? m.lotacao ?? undefined} className="ml-auto min-w-0 truncate rounded border border-linha px-1.5 font-cond text-xs">{m.lotacaoCaminho ?? m.lotacao ?? 'Sem lotação'}</span>
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
          {m.nomeCompleto && <span><Marcado texto={m.nomeCompleto} palavras={palavras} ligado={em.nomeCompleto} /></span>}
          <span><Marcado texto={m.matricula} palavras={palavras} ligado={em.matricula} /></span>
          {m.quadro && <span>{m.quadro}</span>}
          {situacao.length > 0 && <span>{situacao.join(' · ')}</span>}
        </span>
      </Link>
    </li>
  );
}
