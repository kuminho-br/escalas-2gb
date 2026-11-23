import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { MODULOS, type Modulo } from '@/lib/modulos';
import { buscaDaGrade, temBuscaDaGrade, type BuscaDaGrade } from '@/lib/busca-da-grade';
import { dataPorExtenso, saudacao } from '@/lib/saudacao';
import { useTransicao } from '@/lib/transicao-login/armazem';

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

/** A tela inicial: a faixa de boas-vindas e um cartão por módulo que a pessoa pode usar (docs/telas/login-e-inicio/mockup.html). */
function Inicio() {
  const { eu } = Route.useRouteContext();
  const { aviso } = Route.useSearch();
  const agora = new Date();
  // a chegada pela animação do login: a cena pousa nesta faixa; a saudação entra no pouso e recebe o foco, e os cartões sobem durante o afastamento
  const { fase, cartoes } = useTransicao();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (fase === 'pousou') titulo.current?.focus({ preventScroll: true });
  }, [fase]);
  const chegadaDaSaudacao = fase === 'pousou' ? 'entrando' : fase === 'parada' ? undefined : 'escondida';
  const chegadaDosCartoes = fase === 'parada' ? undefined : cartoes ? 'entrando' : 'escondida';
  return (
    <div className="-mx-4 -my-6 md:-mx-8">
      <section data-faixa-boas-vindas className="relative aspect-video overflow-hidden bg-[#1a0d0c] text-white md:aspect-[8/3]">
        {/* a cena final da animação do login: as linhas 300 a 876 da imagem na altura da faixa (177,78% = 1024/576; -52,08% = 300/576), encostada
            à direita. No computador (8:3) cabe a largura toda; no celular (16:9) fica a parte da direita. A animação pousa nesta mesma conta */}
        <img src="/boas-vindas.jpg" alt="" className="absolute top-[-52.0833%] right-0 h-[177.7778%] w-auto max-w-none" />
        <div data-chegada={chegadaDaSaudacao} className="saudacao-da-chegada absolute inset-0 flex flex-col gap-1 bg-gradient-to-br from-[rgba(28,36,48,.88)] via-[rgba(28,36,48,.4)] to-transparent px-5 pt-6 md:px-12 md:pt-10">
          <h1 ref={titulo} tabIndex={-1} className="origin-[0_60%] font-cond text-[28px] leading-[1.05] font-semibold outline-none md:text-[40px]">{`${saudacao(agora)}, ${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`}</h1>
          <p className="text-sm text-white/90 md:text-base">{dataPorExtenso(agora)}</p>
        </div>
      </section>
      {aviso === 'outro-papel' && (
        <p role="status" className="mx-4 mt-4 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia md:mx-12">Essa área é de outro nível de acesso.</p>
      )}
      <ul className="grid gap-3 px-4 pt-5 pb-8 md:grid-cols-3 md:gap-[18px] md:px-12 md:pt-7 md:pb-10">
        {MODULOS.filter((m) => m.ve(eu)).map((m, i) => (
          <li key={m.id} data-chegada={chegadaDosCartoes} style={chegadaDosCartoes ? { animationDelay: `${i * 135}ms` } : undefined} className="cartao-da-chegada flex">
            <Cartao modulo={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const classeDoCartao =
  'flex w-full flex-col gap-2.5 rounded-xl border border-transparent bg-superficie p-4 shadow-[0_1px_2px_rgba(28,36,48,.08),0_8px_24px_rgba(28,36,48,.08)] md:p-[22px]';

function Cartao({ modulo }: { modulo: Modulo }) {
  const Icone = modulo.icone;
  const corpo = (
    <>
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-[#F5E7E7] text-vinho md:size-12">
        <Icone className="size-[22px] md:size-6" />
      </span>
      <h2 className="font-cond text-xl leading-[1.15] font-semibold md:text-2xl">{modulo.nome}</h2>
      <p className="text-sm text-apagado md:text-base">{modulo.descricao}</p>
      <span className="mt-auto flex items-center justify-between gap-2 border-t border-linha pt-3 text-sm font-medium">
        {modulo.rota ? (
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
  if (!modulo.rota) return <div className={`${classeDoCartao} opacity-75`}>{corpo}</div>;
  return (
    <Link to={modulo.rota} className={`${classeDoCartao} transition-colors hover:border-vinho focus-visible:outline-2 focus-visible:outline-tinta motion-reduce:transition-none`}>
      {corpo}
    </Link>
  );
}
