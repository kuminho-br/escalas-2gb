import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { Eu } from '@/api/eu';
import { consultaAvisos } from '@/api/avisos';
import { consultaProximosServicos } from '@/api/visualizacao';
import { QuadroDeAvisos } from '@/componentes/inicio/QuadroDeAvisos';
import { ProximosServicos } from '@/componentes/inicio/ProximosServicos';
import { SeuProximoServico } from '@/componentes/inicio/SeuProximoServico';
import { MODULOS, type Modulo } from '@/lib/modulos';
import { buscaDaGrade, temBuscaDaGrade, type BuscaDaGrade } from '@/lib/busca-da-grade';
import { alturaDaCena, quadroAoRolar } from '@/lib/cena-inicial';
import { diaDaSemanaLongo, diaDoMes, horarioCurto } from '@/lib/proximos-servicos';
import { dataPorExtenso, saudacao } from '@/lib/saudacao';
import { useTransicao } from '@/lib/transicao-login/armazem';
import { POSICAO_VERTICAL } from '@/lib/transicao-login/recorte';
import { pedeMenosMovimento } from '@/lib/transicao-login/regra';

type Busca = BuscaDaGrade & { aviso?: 'outro-papel' };

export const Route = createFileRoute('/_app/')({
  // a Grade geral era a página inicial: os favoritos antigos (/?mes=…) continuam levando a ela, agora em /grade
  validateSearch: (s: Record<string, unknown>): Busca => ({ ...buscaDaGrade(s), aviso: s.aviso === 'outro-papel' ? 'outro-papel' : undefined }),
  beforeLoad: ({ search }) => {
    const { aviso: _aviso, ...grade } = search;
    if (temBuscaDaGrade(grade)) throw redirect({ to: '/grade', search: grade });
  },
  component: Inicio,
});

/** A altura do Topo (h-14), abaixo do qual o quadro fica grudado. */
const TOPO = 56;
/** O espaço entre o Topo e o quadro: o `py-6` do main, que o quadro cobre enquanto está grudado. */
const MARGEM = 24;

/**
 * A cena num quadro que encolhe ao rolar (6.42): a altura cheia vem da largura (3:1, até 400 px desde a 6.55), e a cada rolagem o quadro perde o que a
 * página subiu, até virar uma barra de 64 px. O quadro fica grudado abaixo do Topo; um espaçador compensa o que ele encolheu, para o que a pessoa
 * rola não mudar de tamanho enquanto rola. Escreve direto nos estilos (sem estado do React): é um quadro por rolagem. Mede antes da primeira
 * pintura (`useLayoutEffect`), para a tela não nascer com o quadro de um tamanho e saltar para outro.
 */
function useQuadroQueEncolhe(quadro: RefObject<HTMLElement | null>, espaco: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = quadro.current;
    const esp = espaco.current;
    if (!el || !esp) return;
    let alturaCheia = 0;
    let pedido = 0;
    const menos = pedeMenosMovimento();
    const pintar = () => {
      pedido = 0;
      const { altura, encolhido } = quadroAoRolar(alturaCheia, window.scrollY, menos);
      el.style.height = `${altura}px`;
      el.style.setProperty('--e', String(encolhido));
      // passada a metade do caminho, o painel de avisos sai da cena: o estilo o esconde, e ele deixa de receber foco e clique
      el.toggleAttribute('data-encolhida', encolhido > 0.45);
      esp.style.height = `${alturaCheia - altura}px`;
    };
    const medir = () => {
      alturaCheia = alturaDaCena(el.getBoundingClientRect().width, window.innerWidth < 768);
      pintar();
    };
    const aoRolar = () => {
      if (pedido) return;
      pedido = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(pintar) : (pintar(), 0);
    };
    medir();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', medir);
    };
  }, [quadro, espaco]);
}

/** A tela é larga (1024 px ou mais)? Então o painel de avisos fica na cena, à direita; senão desce para logo abaixo dela. Sem `matchMedia` (testes), vale larga. */
const LARGA = '(min-width: 1024px)';
function useTelaLarga(): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = typeof window.matchMedia === 'function' ? window.matchMedia(LARGA) : null;
      m?.addEventListener?.('change', aviso);
      return () => m?.removeEventListener?.('change', aviso);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(LARGA).matches : true),
    () => true,
  );
}

/** A tela inicial: a cena num quadro que encolhe ao rolar e um atalho por módulo que a pessoa pode usar (docs/telas/refatoracao/tela-inicial/index.html). */
function Inicio() {
  const { eu } = Route.useRouteContext();
  const { aviso: avisoDoEndereco } = Route.useSearch();
  const navigate = useNavigate();
  // o aviso aparece uma vez: depois de mostrado sai do endereço, e recarregar a página não o mostra de novo
  const [aviso, setAviso] = useState(avisoDoEndereco);
  useEffect(() => {
    if (!avisoDoEndereco) return;
    setAviso(avisoDoEndereco);
    void navigate({ to: '/', search: (s: Record<string, unknown>) => ({ ...s, aviso: undefined }) as never, replace: true });
  }, [avisoDoEndereco, navigate]);
  const agora = new Date();
  // os próximos serviços (6.55): se a API não responde (404 de conta que não é de militar, ou erro), a área inteira some, sem mensagem
  const proximos = useQuery(consultaProximosServicos()).data?.servicos;
  const primeiro = proximos?.[0];
  // os avisos (6.56): idem; sem resposta, o painel não aparece
  const avisos = useQuery(consultaAvisos()).data;
  const primeiroAviso = avisos?.avisos[0];
  const larga = useTelaLarga();
  // a chegada pela animação do login: a cena pousa nesta faixa; a saudação entra no pouso e recebe o foco, e os cartões sobem durante o afastamento
  const { fase, cartoes } = useTransicao();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (fase === 'pousou') titulo.current?.focus({ preventScroll: true });
  }, [fase]);
  const chegadaDaSaudacao = fase === 'pousou' ? 'entrando' : fase === 'parada' ? undefined : 'escondida';
  const chegadaDosCartoes = fase === 'parada' ? undefined : cartoes ? 'entrando' : 'escondida';
  const quadro = useRef<HTMLElement>(null);
  const espaco = useRef<HTMLDivElement>(null);
  useQuadroQueEncolhe(quadro, espaco);
  return (
    <div className="-mt-6">
      {/* o que gruda abaixo do Topo é este bloco, com o fundo da página: ele cobre a margem entre o Topo e o quadro enquanto o conteúdo passa por baixo */}
      <div className="sticky z-10 bg-fundo" style={{ top: TOPO, paddingTop: MARGEM }}>
        {/* a altura das classes é a cheia, para a tela já nascer do tamanho certo; o script a sobrescreve ao medir e ao rolar */}
        <section ref={quadro} data-faixa-boas-vindas data-com-linha={primeiro ? '' : undefined} className="cena-inicial relative h-[250px] overflow-hidden rounded-superficie bg-tinta text-white shadow-apoiada md:h-[400px]">
          {/* a cena final da animação do login: a imagem cobre o quadro, centrada, a 66% na vertical. A animação pousa nesta mesma conta (recorte.ts) */}
          <img src="/boas-vindas.jpg" alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: `center ${POSICAO_VERTICAL * 100}%` }} />
          {/* ao encolher, a cena escurece um pouco, para a saudação e a linha do próximo serviço lerem bem sobre a imagem clara */}
          <div aria-hidden className="escurece pointer-events-none absolute inset-0" />
          <div data-chegada={chegadaDaSaudacao} className="saudacao-da-chegada saudacao absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_1fr] bg-gradient-to-br from-tinta/90 via-tinta/40 to-transparent px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:px-7">
            <h1 ref={titulo} tabIndex={-1} className="col-start-1 origin-[0_60%] font-cond font-semibold text-balance outline-none">{`${saudacao(agora)}, ${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`}</h1>
            <p className="data col-start-1 text-corpo text-white/90 md:text-nome">{dataPorExtenso(agora)}</p>
            {/* os cartões entram junto com a saudação (o mesmo data-chegada) e somem antes da barra */}
            {proximos && <div className="proximos-da-cena col-start-1 min-w-0 self-end pb-4 md:pb-6"><ProximosServicos servicos={proximos} /></div>}
            {/* o lugar dos avisos (6.56): à direita da cena, a partir de 1024 px; abaixo disso o painel desce para logo abaixo da cena */}
            <div data-lugar-dos-avisos className="hidden lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:items-end lg:pb-6">
              {larga && avisos && <QuadroDeAvisos eu={eu} quadro={avisos} className="w-full" />}
            </div>
          </div>
          {/* a barra, quando o quadro encolhe: a saudação já é o título menor; aqui entra o próximo serviço (a leitura de tela o encontra nos cartões e no detalhe) */}
          {(primeiro || primeiroAviso) && (
            <p data-barra-do-servico={primeiro ? '' : undefined} aria-hidden className="barra-do-servico pointer-events-none absolute right-4 bottom-2 left-4 flex h-[18px] items-center gap-4 md:right-7 md:bottom-0 md:left-auto md:h-16 md:max-w-[75%]">
              {/* no celular a linha fica embaixo da saudação, na largura toda; no computador, à direita dela, e o título do primeiro aviso depois (só no computador) */}
              {primeiro && <span className="min-w-0 truncate text-apoio text-white md:text-corpo">{`Próximo serviço: ${diaDaSemanaLongo(primeiro.data)}, ${diaDoMes(primeiro.data)}, ${primeiro.servico}, ${horarioCurto(primeiro.inicio, primeiro.fim)}`}</span>}
              {primeiroAviso && <span data-barra-do-aviso className="hidden md:inline max-w-[40%] min-w-0 shrink-0 truncate text-corpo font-medium text-white">{primeiroAviso.titulo}</span>}
            </p>
          )}
        </section>
      </div>
      <div ref={espaco} data-espaco-da-cena aria-hidden />
      {/* abaixo de 1024 px o painel de avisos fica logo abaixo da cena, na largura da coluna */}
      {!larga && avisos && (avisos.avisos.length > 0 || avisos.podePublicar) && (
        <div data-chegada={chegadaDosCartoes} className="cartao-da-chegada mt-4">
          <QuadroDeAvisos eu={eu} quadro={avisos} className="bg-tinta backdrop-blur-none" />
        </div>
      )}
      {aviso === 'outro-papel' && (
        <p role="status" className="mt-4 rounded-controle bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">Essa área é de outro nível de acesso.</p>
      )}
      {/* os módulos, um atalho por módulo que a pessoa pode usar: o nome e uma linha do que está acontecendo nele */}
      <nav aria-label="Módulos" className="pt-5 pb-8 md:pt-6 md:pb-10">
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {MODULOS.filter((m) => m.ve(eu)).map((m, i) => (
            <li key={m.id} data-chegada={chegadaDosCartoes} style={chegadaDosCartoes ? { animationDelay: `${i * 135}ms` } : undefined} className="cartao-da-chegada flex min-w-0">
              <Atalho modulo={m} eu={eu} agora={agora} />
            </li>
          ))}
        </ul>
      </nav>
      {/* o detalhe do primeiro cartão (6.55) */}
      {primeiro && <div data-chegada={chegadaDosCartoes} className="cartao-da-chegada pb-8 md:pb-10"><SeuProximoServico servico={primeiro} /></div>}
    </div>
  );
}

const classeDoAtalho = 'grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-x-2 rounded-controle border px-2.5 py-2 md:min-h-16 md:grid-cols-[36px_minmax(0,1fr)] md:gap-x-3 md:px-3.5 md:py-2.5';

/** Um atalho: o ícone, o nome do módulo e a linha de situação. O módulo que ainda não existe não é link: fica tracejado, e a situação diz quando chega. */
function Atalho({ modulo, eu, agora }: { modulo: Modulo; eu: Eu; agora: Date }) {
  const rota = modulo.rotaDe?.(eu) ?? modulo.rota;
  const Icone = modulo.icone;
  const corpo = (
    <>
      <Icone aria-hidden className="row-span-2 size-[22px] justify-self-center" />
      <b className="font-cond text-nome leading-5 font-semibold">{modulo.nome}</b>
      <small className="text-apoio leading-[18px] text-apagado md:truncate">{modulo.situacao(eu, agora)}</small>
    </>
  );
  if (!rota) return <div className={`${classeDoAtalho} border-dashed border-encaixe text-apagado`}>{corpo}</div>;
  return (
    <Link to={rota} className={`${classeDoAtalho} border-linha bg-superficie text-tinta transition-colors hover:border-encaixe hover:bg-passa motion-reduce:transition-none [&>svg]:text-vinho`}>
      {corpo}
    </Link>
  );
}
