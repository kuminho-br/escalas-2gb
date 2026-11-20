import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Data, Mes } from 'contratos';
import { mensagemDe } from '@/api/cliente';
import { ehMilitarComum } from '@/api/eu';
import { consultaGrade } from '@/api/grade';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { LegendaDaGrade } from '@/componentes/grade/LegendaDaGrade';
import { PainelDoDia } from '@/componentes/grade/PainelDoDia';
import { TabelaDaGrade, maximosDaGrade } from '@/componentes/grade/TabelaDaGrade';
import { Label } from '@/componentes/ui/label';
import { useEhCelular } from '@/lib/useEhCelular';
import { mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';

type Busca = { mes?: string; equipe?: string; militar?: string; dia?: string };

export const Route = createFileRoute('/_app/')({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    equipe: typeof s.equipe === 'string' && s.equipe ? s.equipe : undefined,
    militar: typeof s.militar === 'string' && s.militar ? s.militar : undefined,
    dia: typeof s.dia === 'string' && Data.safeParse(s.dia).success ? s.dia : undefined,
  }),
  component: GradeGeral,
});

/** A Grade geral: todo o efetivo da seção no mês, em equipes. Clicar numa célula (militar e dia) escolhe o dia dele. */
function GradeGeral() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? mesAtual();
  // o militar comum não vê a grade (é dos escalantes e gestores): sem consulta e sem alerta
  const comum = ehMilitarComum(eu);
  const dados = useQuery({ ...consultaGrade(eu.unidade.id, mes), enabled: !comum });
  const celular = useEhCelular();
  const grade = dados.data;
  // um filtro de equipe que não existe neste mês (a equipe não tem ninguém nele) vale como "Todas": nunca deixa a página em branco
  const equipe = grade?.grupos.some((g) => g.chave === busca.equipe) ? busca.equipe : undefined;
  const grupos = grade ? (equipe ? grade.grupos.filter((g) => g.chave === equipe) : grade.grupos) : [];
  const escolhida = busca.militar && busca.dia ? { militarId: busca.militar, dia: busca.dia } : null;
  const filtrar = (equipe: string | undefined) => void navigate({ search: (s) => ({ ...s, equipe }) });

  return (
    <section className="grid gap-4">
      <h1 className="font-cond text-[28px] leading-tight font-semibold">Grade geral</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="gg-mes">Mês</Label>
          <CampoDeMes id="gg-mes" valor={mes} aoMudar={(m) => void navigate({ search: (s) => ({ ...s, mes: m, militar: undefined, dia: undefined }) })} />
        </div>
        {grade && grade.grupos.length > 1 && (
          <div role="group" aria-label="Equipes" className="flex flex-wrap items-center gap-1.5">
            {[{ chave: undefined, nome: 'Todas' }, ...grade.grupos].map((g) => {
              const ligado = equipe === g.chave;
              return (
                <button
                  key={g.chave ?? 'todas'}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => filtrar(g.chave)}
                  className={cn('h-9 rounded-md border px-3 text-sm', ligado ? 'border-tinta bg-tinta text-white' : 'border-linha bg-superficie hover:bg-accent')}
                >
                  {g.nome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {comum && <p className="text-apagado">A grade geral é dos escalantes e gestores.</p>}
      {!comum && dados.isPending && <p className="text-apagado">Carregando…</p>}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {grade && grade.grupos.length === 0 && <p className="text-apagado">Ninguém para mostrar neste mês.</p>}
      {grade && grupos.length > 0 && (
        <div className={cn('grid items-start gap-4', escolhida && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
          {/* no celular o painel do dia cobre a tela: a grade atrás fica inerte (nem o leitor de tela nem o teclado chegam nela) */}
          <div data-grade inert={celular && !!escolhida} className="min-w-0 overflow-hidden rounded-xl border border-linha bg-superficie">
            <TabelaDaGrade
              grade={grade}
              grupos={grupos}
              maximos={maximosDaGrade(grade.grupos)}
              escolhida={escolhida}
              aoEscolher={(militar, dia) => void navigate({ search: (s) => ({ ...s, militar, dia }) })}
            />
            <LegendaDaGrade grupos={grupos} />
          </div>
          {escolhida && (
            <PainelDoDia
              key={`${escolhida.militarId}|${escolhida.dia}`}
              unidadeId={eu.unidade.id}
              militarId={escolhida.militarId}
              data={escolhida.dia}
              aoFechar={() => {
                void navigate({ search: (s) => ({ ...s, militar: undefined, dia: undefined }) });
                // o foco volta à célula que abriu o painel
                setTimeout(() => document.querySelector<HTMLElement>(`tr[data-militar="${escolhida.militarId}"] [data-data="${escolhida.dia}"]`)?.focus(), 0);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
