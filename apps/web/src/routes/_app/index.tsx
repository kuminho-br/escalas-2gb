import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { MODULOS, type Modulo } from '@/lib/modulos';
import { buscaDaGrade, temBuscaDaGrade, type BuscaDaGrade } from '@/lib/busca-da-grade';
import { dataPorExtenso, saudacao } from '@/lib/saudacao';

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
  return (
    <div className="-mx-4 -my-6 md:-mx-8">
      <section className="relative aspect-video overflow-hidden bg-[#3a2626] text-white md:aspect-[8/3]">
        {/* a cena final da animação do login, cortada: no computador as linhas 300 a 876 (8:3); no celular, 16:9 pela direita */}
        <img src="/boas-vindas.jpg" alt="" className="absolute inset-0 size-full object-cover object-right md:object-[center_67%]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[rgba(28,36,48,.88)] via-[rgba(28,36,48,.4)] to-transparent" />
        <div className="relative flex flex-col gap-1 px-5 pt-6 md:px-12 md:pt-10">
          <h1 className="font-cond text-[28px] leading-[1.05] font-semibold md:text-[40px]">{`${saudacao(agora)}, ${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`}</h1>
          <p className="text-sm text-white/90 md:text-base">{dataPorExtenso(agora)}</p>
        </div>
      </section>
      {aviso === 'outro-papel' && (
        <p role="status" className="mx-4 mt-4 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia md:mx-12">Essa área é de outro nível de acesso.</p>
      )}
      <ul className="grid gap-3 px-4 pt-5 pb-8 md:grid-cols-3 md:gap-[18px] md:px-12 md:pt-7 md:pb-10">
        {MODULOS.filter((m) => m.ve(eu)).map((m) => (
          <li key={m.id} className="flex">
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
