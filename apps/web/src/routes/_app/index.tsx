import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Eu } from '@/api/eu';
import { MODULOS, type Modulo } from '@/lib/modulos';
import { buscaDaGrade, temBuscaDaGrade, type BuscaDaGrade } from '@/lib/busca-da-grade';
import { alturaDaCena, quadroAoRolar } from '@/lib/cena-inicial';
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
 * A cena num quadro que encolhe ao rolar (6.42): a altura cheia vem da largura (3:1, até 300 px), e a cada rolagem o quadro perde o que a
 * página subiu, até virar uma barra de 64 px. O quadro fica grudado abaixo do Topo; um espaçador compensa o que ele encolheu, para o que a pessoa
 * rola não mudar de tamanho enquanto rola. Escreve direto nos estilos (sem estado do React): é um quadro por rolagem.
 */
function useQuadroQueEncolhe(quadro: RefObject<HTMLElement | null>, espaco: RefObject<HTMLElement | null>) {
  useEffect(() => {
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
        <section ref={quadro} data-faixa-boas-vindas className="cena-inicial relative overflow-hidden rounded-superficie bg-tinta text-white shadow-apoiada">
          {/* a cena final da animação do login: a imagem cobre o quadro, centrada, a 66% na vertical. A animação pousa nesta mesma conta (recorte.ts) */}
          <img src="/boas-vindas.jpg" alt="" className="absolute inset-0 size-full object-cover" style={{ objectPosition: `center ${POSICAO_VERTICAL * 100}%` }} />
          <div data-chegada={chegadaDaSaudacao} className="saudacao-da-chegada saudacao absolute inset-0 flex flex-col bg-gradient-to-br from-tinta/90 via-tinta/40 to-transparent px-4 md:px-7">
            <h1 ref={titulo} tabIndex={-1} className="origin-[0_60%] font-cond font-semibold text-balance outline-none">{`${saudacao(agora)}, ${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`}</h1>
            <p className="data text-corpo text-white/90 md:text-nome">{dataPorExtenso(agora)}</p>
          </div>
        </section>
      </div>
      <div ref={espaco} data-espaco-da-cena aria-hidden />
      {aviso === 'outro-papel' && (
        <p role="status" className="mt-4 rounded-controle bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">Essa área é de outro nível de acesso.</p>
      )}
      <ul className="grid gap-3 pt-5 pb-8 md:grid-cols-3 md:gap-[18px] md:pt-7 md:pb-10">
        {MODULOS.filter((m) => m.ve(eu)).map((m, i) => (
          <li key={m.id} data-chegada={chegadaDosCartoes} style={chegadaDosCartoes ? { animationDelay: `${i * 135}ms` } : undefined} className="cartao-da-chegada flex">
            <Cartao modulo={m} eu={eu} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const classeDoCartao =
  'flex w-full flex-col gap-2.5 rounded-xl border border-transparent bg-superficie p-4 shadow-[0_1px_2px_rgba(28,36,48,.08),0_8px_24px_rgba(28,36,48,.08)] md:p-[22px]';

function Cartao({ modulo, eu }: { modulo: Modulo; eu: Eu }) {
  const rota = modulo.rotaDe?.(eu) ?? modulo.rota;
  const Icone = modulo.icone;
  const corpo = (
    <>
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-passa text-vinho md:size-12">
        <Icone className="size-[22px] md:size-6" />
      </span>
      <h2 className="font-cond text-xl leading-[1.15] font-semibold md:text-2xl">{modulo.nome}</h2>
      <p className="text-sm text-apagado md:text-base">{modulo.descricao}</p>
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-linha pt-3 text-sm font-medium">
        {rota ? (
          <>
            Abrir
            <ArrowRight className="size-[18px] text-vinho" aria-hidden />
          </>
        ) : (
          'Em breve'
        )}
      </span>
    </>
  );
  if (!rota) return <div className={`${classeDoCartao} opacity-75`}>{corpo}</div>;
  return (
    <Link to={rota} className={`${classeDoCartao} transition-colors hover:border-vinho focus-visible:outline-2 focus-visible:outline-tinta motion-reduce:transition-none`}>
      {corpo}
    </Link>
  );
}
