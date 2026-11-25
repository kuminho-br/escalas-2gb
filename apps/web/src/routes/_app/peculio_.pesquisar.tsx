import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { FiltrosDaBusca, LinhaDaBusca, LinhaDaConsulta } from 'contratos';
import { ListFilter, Network, Search, FileText } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ehMilitarComum } from '@/api/eu';
import { mensagemDe } from '@/api/cliente';
import { buscarTodos, consultaDaBusca, consultaDaBuscaComFiltros, consultaUnidadesDaBusca } from '@/api/consulta';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { ArquivoDeMatriculas } from '@/componentes/peculio/ArquivoDeMatriculas';
import { ArvoreDeMarcar, type Marca } from '@/componentes/peculio/ArvoreDeMarcar';
import { usePesquisaDoPeculio } from '@/componentes/peculio/EstadoDaPesquisa';
import { PainelDeSelecionados, useSelecao } from '@/componentes/peculio/Selecao';
import { Checkbox } from '@/componentes/ui/checkbox';
import { contarExtras, EXTRAS_VAZIOS, extrasParaFiltros, FiltrosDaPesquisa, type Extras } from '@/componentes/peculio/FiltrosDaPesquisa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Moldura } from '@/componentes/Moldura';
import { classeDaLinhaDeMilitar, ListaDeMilitares } from '@/componentes/peculio/ListaDeMilitares';

export const MSG_BUSCA_CURTA = 'Digite pelo menos 3 letras ou escolha uma unidade.';
export const MSG_HA_MAIS = 'Há mais militares. Refine a busca.';

type Busca = { texto?: string; unidade?: string };

export const Route = createFileRoute('/_app/peculio_/pesquisar')({
  // a busca fica no endereço: voltar da ficha de consulta traz o mesmo resultado
  validateSearch: (s: Record<string, unknown>): Busca => ({
    texto: typeof s.texto === 'string' && s.texto.trim() ? s.texto.trim() : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  component: Consulta,
});

/**
 * Pesquisar militares (era a "Consulta de militares", 6.11; é uma tela do Pecúlio Geral desde a 6.50): todo militar com conta busca qualquer militar da corporação.
 * A linha mostra a identificação; abrir leva à ficha dentro do Pecúlio, completa para quem tem nível de acesso sobre ele e de consulta para os outros.
 * Desde a 6.51 a busca tem a lotação pela árvore (várias unidades), e, para quem tem nível de acesso, o arquivo de matrículas e "Mais filtros". A busca só sai no "Buscar".
 */
function Consulta() {
  const { eu } = Route.useRouteContext();
  const nivel = !ehMilitarComum(eu);
  const { texto = '', unidade = '' } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const chaveDoEndereco = `${texto}|${unidade}`;
  // o que a pessoa montou (marcas da árvore, arquivo, "Mais filtros", a busca em vigor) vive acima das rotas (6.52): abrir a ficha e voltar não o perde
  const { estado, mudar, reiniciar } = usePesquisaDoPeculio();
  // o endereço mudou por fora (voltar ou avançar no navegador, ou outro caminho até aqui): vale o que ele diz, sem o que estava montado. O "Buscar" muda o endereço e a chave
  // do estado juntos, então não cai aqui. Só o endereço faz o efeito rodar de novo (as funções do estado são estáveis).
  const chaveDoEstado = useRef(estado.chave);
  chaveDoEstado.current = estado.chave;
  useLayoutEffect(() => {
    if (chaveDoEstado.current !== chaveDoEndereco) reiniciar(chaveDoEndereco);
  }, [chaveDoEndereco, reiniciar]);
  const { marcas, matriculas, extras, aplicados } = estado;

  const buscar = (campo: string, escolhida: string): string | null => {
    const f: FiltrosDaBusca = {
      ...(campo.trim() ? { texto: campo.trim() } : {}),
      ...(marcas.length ? { unidades: marcas } : escolhida ? { unidades: [{ id: escolhida, comAsDeBaixo: true }] } : {}),
      ...(nivel && matriculas.length ? { matriculas } : {}),
      ...(nivel ? extrasParaFiltros(extras) : {}),
    };
    if (campo.trim().length < 3 && !f.unidades?.length && !f.matriculas?.length && contarExtras(extras) === 0) return MSG_BUSCA_CURTA;
    // o endereço guarda só o texto e a unidade escolhida no campo (as marcas da árvore ficam no estado, que o acompanha pela chave)
    const novoTexto = campo.trim();
    const novaUnidade = marcas.length ? '' : escolhida;
    mudar({ aplicados: f, chave: `${novoTexto}|${novaUnidade}` });
    void navigate({ search: { texto: novoTexto || undefined, unidade: novaUnidade || undefined } });
    return null;
  };
  const limpar = () => {
    reiniciar('|');
    void navigate({ search: { texto: undefined, unidade: undefined } });
  };

  const vigentes: FiltrosDaBusca = aplicados ?? { ...(texto ? { texto } : {}), ...(unidade ? { unidades: [{ id: unidade, comAsDeBaixo: true }] } : {}) };
  return (
    <Moldura titulo="Pesquisar militares">
      {/* key: voltar ou avançar no navegador põe os campos no que a busca do endereço diz */}
      <Formulario
        key={chaveDoEndereco}
        texto={texto}
        unidade={unidade}
        nivel={nivel}
        marcas={marcas}
        aoMarcar={(m) => mudar({ marcas: m })}
        matriculas={matriculas}
        aoLerArquivo={(m) => mudar({ matriculas: m })}
        extras={extras}
        aoMudarExtras={(e) => mudar({ extras: e })}
        aoBuscar={buscar}
        aoLimpar={limpar}
      />
      {nivel && <PainelDeSelecionados />}
      <Resultado filtros={vigentes} nivel={nivel} endereco={{ texto, unidade }} />
    </Moldura>
  );
}

type Painel = 'arvore' | 'arquivo' | 'filtros' | null;

function Formulario({
  texto, unidade, nivel, marcas, aoMarcar, matriculas, aoLerArquivo, extras, aoMudarExtras, aoBuscar, aoLimpar,
}: {
  texto: string;
  unidade: string;
  nivel: boolean;
  marcas: Marca[];
  aoMarcar: (m: Marca[]) => void;
  matriculas: string[];
  aoLerArquivo: (m: string[]) => void;
  extras: Extras;
  aoMudarExtras: (e: Extras) => void;
  aoBuscar: (campo: string, escolhida: string) => string | null;
  aoLimpar: () => void;
}) {
  const unidades = useQuery(consultaUnidadesDaBusca);
  const [campo, setCampo] = useState(texto);
  const [escolhida, setEscolhida] = useState(unidade);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const alternar = (p: Exclude<Painel, null>) => setPainel((atual) => (atual === p ? null : p));
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    const problema = aoBuscar(campo, escolhida);
    setErro(problema);
    // buscou: o painel aberto (árvore, arquivo, filtros) se fecha, para o resultado aparecer logo abaixo; o que ele montou fica resumido nos botões
    if (!problema) setPainel(null);
  };
  const nExtras = contarExtras(extras);
  const limpar = () => {
    setCampo('');
    setEscolhida('');
    setErro(null);
    setPainel(null);
    aoLimpar();
  };
  const algoParaLimpar = campo !== '' || escolhida !== '' || marcas.length > 0 || matriculas.length > 0 || nExtras > 0;
  return (
    <form onSubmit={buscar} className="mt-6 grid max-w-3xl gap-3" role="search">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="consulta-texto">Nome, nome de guerra ou matrícula</Label>
          <Input
            id="consulta-texto"
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
          {/* pela árvore, nó a nó (6.45): a busca pega a unidade escolhida e as de baixo; sem unidade, toda a corporação. Com nós marcados na árvore, valem eles */}
          <EscolherUnidade id="consulta-unidade" rotulo="Lotados em" unidades={unidades.data ?? []} valor={marcas.length ? '' : escolhida} aoEscolher={setEscolhida} permiteLimpar textoVazio={marcas.length ? 'Marcadas na árvore' : 'Toda a corporação'} disabled={marcas.length > 0} />
        </div>
        <Button type="submit">
          <Search aria-hidden />
          Buscar
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secundario" aria-expanded={painel === 'arvore'} onClick={() => alternar('arvore')}>
          <Network aria-hidden />
          Pela árvore
        </Button>
        {nivel && (
          <Button type="button" variant="secundario" aria-expanded={painel === 'arquivo'} onClick={() => alternar('arquivo')}>
            <FileText aria-hidden />
            Por arquivo de matrículas
          </Button>
        )}
        {nivel && (
          <Button type="button" variant="secundario" aria-expanded={painel === 'filtros'} onClick={() => alternar('filtros')}>
            <ListFilter aria-hidden />
            {nExtras > 0 ? `Mais filtros (${nExtras})` : 'Mais filtros'}
          </Button>
        )}
        {algoParaLimpar && <Button type="button" variant="discreto" onClick={limpar}>Limpar filtros</Button>}
        {marcas.length > 0 && <span className="text-apoio text-apagado">{marcas.length === 1 ? '1 unidade marcada' : `${marcas.length} unidades marcadas`}</span>}
        {nivel && painel !== 'arquivo' && matriculas.length > 0 && <span className="text-apoio text-apagado">{matriculas.length === 1 ? '1 matrícula lida' : `${matriculas.length} matrículas lidas`}</span>}
      </div>
      {painel === 'arvore' && <ArvoreDeMarcar unidades={unidades.data ?? []} marcas={marcas} aoMudar={aoMarcar} />}
      {painel === 'arquivo' && nivel && <ArquivoDeMatriculas matriculas={matriculas} aoLer={aoLerArquivo} />}
      {painel === 'filtros' && nivel && <FiltrosDaPesquisa valor={extras} aoMudar={aoMudarExtras} />}
      {erro && <p id="consulta-erro" role="alert" className="text-sm text-alerta">{erro}</p>}
    </form>
  );
}

/** A busca simples (o texto e a unidade com as de baixo) de quem não tem nível de acesso vai pela rota de sempre; o resto vai pela busca com filtros. */
function ehBuscaSimples(f: FiltrosDaBusca): boolean {
  const filtrosAlemDoTexto = Object.keys(f).filter((k) => k !== 'texto' && k !== 'unidades');
  const u = f.unidades ?? [];
  return filtrosAlemDoTexto.length === 0 && (u.length === 0 || (u.length === 1 && u[0]!.comAsDeBaixo));
}

function Resultado({ filtros, nivel, endereco }: { filtros: FiltrosDaBusca; nivel: boolean; endereco: { texto: string; unidade: string } }) {
  if (!nivel && ehBuscaSimples(filtros)) return <ResultadoSimples texto={filtros.texto ?? ''} unidade={filtros.unidades?.[0]?.id ?? ''} />;
  return <ResultadoDosFiltros filtros={filtros} nivel={nivel} endereco={endereco} />;
}

function ResultadoSimples({ texto, unidade }: { texto: string; unidade: string }) {
  const pode = texto.length >= 3 || unidade !== '';
  const busca = useQuery({ ...consultaDaBusca(texto, unidade), enabled: pode });
  if (!pode) return <p className="mt-8 max-w-xl text-apagado">Busque pelo nome, pelo nome de guerra ou pela matrícula. Para ver quem está lotado numa unidade, escolha a unidade em “Lotados em”.</p>;
  if (busca.isPending) return <p className="mt-8 text-apagado">Buscando…</p>;
  if (busca.error) return <p role="alert" className="mt-8 text-alerta">{mensagemDe(busca.error)}</p>;
  const { militares, haMais } = busca.data;
  if (militares.length === 0) return <p className="mt-8 max-w-xl text-apagado">Nenhum militar encontrado. Confira o nome ou a matrícula, ou escolha outra unidade.</p>;
  return (
    <div className="mt-6 max-w-3xl">
      {haMais && <p role="status" className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{MSG_HA_MAIS}</p>}
      <ListaDeMilitares rotulo="Militares encontrados">
          {militares.map((m) => <LinhaDaPesquisa key={m.id} m={m} texto={texto} unidade={unidade} />)}
      </ListaDeMilitares>
    </div>
  );
}

function ResultadoDosFiltros({ filtros, nivel, endereco }: { filtros: FiltrosDaBusca; nivel: boolean; endereco: { texto: string; unidade: string } }) {
  const tem = (filtros.texto ?? '').length >= 3 || Boolean(filtros.unidades?.length) || Object.keys(filtros).some((k) => k !== 'texto' && k !== 'unidades');
  const busca = useQuery({ ...consultaDaBuscaComFiltros(filtros), enabled: tem });
  if (!tem) return <p className="mt-8 max-w-xl text-apagado">Busque pelo nome, pelo nome de guerra ou pela matrícula. Para ver quem está lotado numa unidade, escolha a unidade em “Lotados em”.</p>;
  if (busca.isPending) return <p className="mt-8 text-apagado">Buscando…</p>;
  if (busca.error) return <p role="alert" className="mt-8 text-alerta">{mensagemDe(busca.error)}</p>;
  const { militares, haMais, naoEncontradas } = busca.data;
  return (
    <div className="mt-6 max-w-3xl">
      {naoEncontradas.length > 0 && <NaoEncontradas matriculas={naoEncontradas} />}
      {haMais && <p role="status" className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{`Mais de ${militares.length} militares. Afine a busca.`}</p>}
      {militares.length === 0 ? (
        <p className="max-w-xl text-apagado">Nenhum militar encontrado. Confira o nome ou a matrícula, ou escolha outra unidade.</p>
      ) : (
        <>
          {/* a seleção é de quem tem nível de acesso: o militar comum (que também cai aqui pela árvore) vê só a lista */}
          {nivel && <SelecionarEstes key={JSON.stringify(filtros)} militares={militares} haMais={haMais} filtros={filtros} />}
          <ListaDeMilitares rotulo="Militares encontrados">
            {militares.map((m) => <LinhaDaPesquisa key={m.id} m={m} selecionavel={nivel} texto={endereco.texto} unidade={endereco.unidade} />)}
          </ListaDeMilitares>
        </>
      )}
    </div>
  );
}

/**
 * "Selecionar estes {n}": as linhas da tela sobre as quais a pessoa tem nível de acesso. Com "mais de 500" a tela só mostra 500, e o botão vira "Selecionar todos" (6.54): busca a
 * lista inteira do filtro (até 5000) e seleciona quem a pessoa pode alterar; passando de 5000, a API pede para afinar a busca.
 */
function SelecionarEstes({ militares, haMais, filtros }: { militares: LinhaDaBusca[]; haMais: boolean; filtros: FiltrosDaBusca }) {
  const { incluir } = useSelecao();
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foraDoFiltro, setForaDoFiltro] = useState<number | null>(null);
  const alteraveis = militares.filter((m) => m.podeAlterar);
  const fora = haMais && foraDoFiltro !== null ? foraDoFiltro : militares.length - alteraveis.length;
  const selecionarTodos = async () => {
    setBuscando(true);
    setErro(null);
    try {
      const inteira = (await buscarTodos(filtros)).militares;
      incluir(inteira.filter((m) => m.podeAlterar));
      setForaDoFiltro(inteira.filter((m) => !m.podeAlterar).length);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setBuscando(false);
    }
  };
  if (alteraveis.length === 0 && fora === 0 && !haMais) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
      {haMais ? (
        <Button type="button" variant="secundario" disabled={buscando} onClick={() => void selecionarTodos()}>{buscando ? 'Buscando…' : 'Selecionar todos'}</Button>
      ) : (
        alteraveis.length > 0 && <Button type="button" variant="secundario" onClick={() => incluir(alteraveis)}>{`Selecionar estes ${alteraveis.length}`}</Button>
      )}
      {erro && <span role="alert" className="text-apoio text-alerta">{erro}</span>}
      {fora > 0 && <span className="text-apoio text-apagado">{fora === 1 ? '1 militar fica de fora: você não tem nível de acesso sobre ele.' : `${fora} militares ficam de fora: você não tem nível de acesso sobre eles.`}</span>}
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

/**
 * A linha do resultado (a mesma nas duas buscas): posto e nome de guerra, a lotação no canto, e embaixo o nome completo, a matrícula e o quadro; com a situação, mostra-a também.
 * Para quem tem nível de acesso (`selecionavel`), a marca de selecionar fica ao lado, fora do link: marcar não abre a ficha. Quem a pessoa não pode alterar tem a marca desligada.
 */
function LinhaDaPesquisa({ m, texto, unidade, selecionavel = false }: { m: LinhaDaConsulta & Partial<LinhaDaBusca>; texto: string; unidade: string; selecionavel?: boolean }) {
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
        <span className="flex items-center gap-2">
          <span className="font-cond text-apoio text-apagado">{m.postoGrad}</span>
          <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
          <span className="ml-auto rounded border border-linha px-1.5 font-cond text-xs">{m.lotacao ?? 'Sem lotação'}</span>
        </span>
        <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
          {m.nomeCompleto && <span>{m.nomeCompleto}</span>}
          <span>{m.matricula}</span>
          {m.quadro && <span>{m.quadro}</span>}
          {situacao.length > 0 && <span>{situacao.join(' · ')}</span>}
        </span>
      </Link>
    </li>
  );
}
