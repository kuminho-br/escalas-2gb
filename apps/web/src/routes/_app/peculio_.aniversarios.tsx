import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes, mesPorExtenso, type AniversarianteDoMes } from 'contratos';
import { diaDaSemana, diasDoMes } from 'dominio';
import { mensagemDe } from '@/api/cliente';
import { consultaPeculio, unidadeDoPeculio } from '@/api/peculio';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { diasDoMesComAniversariantes } from '@/lib/aniversarios';
import { hoje, mesAtual } from '@/lib/meses';
import { useEhCelular } from '@/lib/useEhCelular';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/peculio_/aniversarios')({
  // o mês fica no endereço: a tela abre no mesmo mês ao voltar ou recarregar
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: Aniversarios,
});

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Aniversários (Pecúlio Geral, 6.50): o calendário do mês dos militares da unidade de trabalho e das de baixo cujo nascimento a pessoa pode ver.
 * No computador é o mês em sete colunas; no celular, a lista dos dias que têm aniversário.
 */
function Aniversarios() {
  const { eu } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const celular = useEhCelular();
  const mes = Route.useSearch().mes ?? mesAtual();
  const unidade = unidadeDoPeculio(eu);
  const lista = useQuery(consultaPeculio(unidade.id, mes));
  const aniversariantes = lista.data?.aniversariantes;
  const dias = aniversariantes ? diasDoMesComAniversariantes(mes, aniversariantes) : [];

  return (
    <Moldura titulo="Aniversários" acaoPrincipal={<CampoDeMes id="aniversarios-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />}>
      {lista.isPending && <Espera />}
      {lista.error && <p role="alert" className="mt-6 text-alerta">{mensagemDe(lista.error)}</p>}
      {/* sem a chave, quem pede não vê o nascimento de ninguém: a tela diz isso, e não que ninguém faz aniversário */}
      {lista.data && !aniversariantes && <p className="mt-6 max-w-xl text-apagado">Você não tem acesso às datas de nascimento desta unidade.</p>}
      {aniversariantes && dias.length === 0 && <p className="mt-6 text-apagado">{`Nenhum aniversário em ${mesPorExtenso(mes)}.`}</p>}
      {aniversariantes && dias.length > 0 && (celular ? <ListaPorDia mes={mes} dias={dias} /> : <CalendarioDoMes mes={mes} dias={dias} />)}
    </Moldura>
  );
}

type Dia = { data: string; quem: AniversarianteDoMes[] };

function CalendarioDoMes({ mes, dias }: { mes: string; dias: Dia[] }) {
  const quemPorData = new Map(dias.map((d) => [d.data, d.quem]));
  const hojeData = hoje();
  const todos = diasDoMes(mes);
  return (
    <div className="mt-6">
      <div aria-hidden className="grid grid-cols-7 gap-px px-1 pb-1 text-apoio text-apagado">
        {SEMANA.map((s) => <span key={s} className="text-center">{s}</span>)}
      </div>
      <ol aria-label={`Aniversários de ${mesPorExtenso(mes)}`} className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-linha bg-linha">
        {todos.map((data, i) => {
          const quem = quemPorData.get(data) ?? [];
          return (
            <li
              key={data}
              aria-label={`Dia ${Number(data.slice(8))}`}
              style={i === 0 ? { gridColumnStart: diaDaSemana(data) + 1 } : undefined}
              className={cn('min-h-24 min-w-0 bg-superficie p-1.5', data === hojeData && 'bg-accent')}
            >
              <span className={cn('block font-cond text-apoio', quem.length > 0 ? 'font-semibold text-tinta' : 'text-apagado')} aria-hidden>{Number(data.slice(8))}</span>
              <ul className="mt-1 grid gap-1">
                {quem.map((q) => (
                  <li key={q.militarId}>
                    <Link to="/peculio/militar/$id" params={{ id: q.militarId }} search={{}} title={q.lotacao} className="block truncate rounded-md px-1 py-0.5 text-apoio leading-tight hover:bg-accent">
                      <span className="text-apagado">{q.posto}</span> <span className="font-medium">{q.nomeGuerra}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ListaPorDia({ mes, dias }: { mes: string; dias: Dia[] }) {
  return (
    <ol aria-label={`Aniversários de ${mesPorExtenso(mes)}`} className="mt-6 divide-y divide-linha rounded-xl border border-linha bg-superficie">
      {dias.map((d) => (
        <li key={d.data} aria-label={`Dia ${Number(d.data.slice(8))}`} className="grid grid-cols-[3.5rem_1fr] gap-2 px-4 py-3">
          <span className="font-cond font-semibold" aria-hidden>{`${d.data.slice(8)}/${d.data.slice(5, 7)}`}</span>
          <ul className="grid gap-1.5">
            {d.quem.map((q) => (
              <li key={q.militarId} className="flex items-baseline gap-2">
                <Link to="/peculio/militar/$id" params={{ id: q.militarId }} search={{}} className="hover:underline">
                  <span className="text-apagado">{q.posto}</span> <span className="font-medium">{q.nomeGuerra}</span>
                </Link>
                <span className="ml-auto text-apoio text-apagado">{q.lotacao}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
