import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes, somarMeses } from 'contratos';
import { useEffect, useRef, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaVoluntariadoDoMes, consultaVoluntariadoDoMilitar, lancarVoluntariado } from '@/api/voluntariado';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { Label } from '@/componentes/ui/label';
import { CalendarioDoVoluntariado } from '@/componentes/voluntariado/CalendarioDoVoluntariado';
import { guiaJaFechado, lembrarGuiaFechado } from '@/componentes/voluntariado/GuiaComoMarcar';
import { ListaDoVoluntariado } from '@/componentes/voluntariado/ListaDoVoluntariado';
import { mesAtual } from '@/lib/meses';
import { useEhCelular } from '@/lib/useEhCelular';
import { proximoQueFalta } from '@/lib/voluntariado';

export const Route = createFileRoute('/_app/voluntariado')({
  validateSearch: (s: Record<string, unknown>): { mes?: string; militar?: string } => ({
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    militar: typeof s.militar === 'string' ? s.militar : undefined,
  }),
  component: Voluntariado,
});

function Voluntariado() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  // o voluntariado se lança antes de o mês começar: a tela abre no mês seguinte
  const mes = busca.mes ?? somarMeses(mesAtual(), 1);
  const lista = useQuery(consultaVoluntariadoDoMes(eu.unidade.id, mes));
  const [texto, setTexto] = useState('');
  const [todosLancados, setTodosLancados] = useState(false);
  // o guia "Como marcar" é da tela: o calendário é montado de novo a cada militar, e o "Entendi" não pode se perder (sem armazenamento, vale até sair da tela)
  const [guiaAberto, setGuiaAberto] = useState(() => !guiaJaFechado());
  const militares = lista.data?.militares ?? [];
  // no celular, a lista vem primeiro: só abre o militar que a pessoa tocou (modo foco); no computador, o primeiro que falta já vem aberto
  const celular = useEhCelular();
  const aberto = militares.find((m) => m.militarId === busca.militar) ?? (celular ? undefined : (militares.find((m) => !m.lancado) ?? militares[0]));
  // o militar aberto fica na URL: se a lista mudar (outro escalante lançou, a tela voltou ao foco), a tela não pula para outro militar
  useEffect(() => {
    if (aberto && busca.militar !== aberto.militarId) void navigate({ search: { mes, militar: aberto.militarId }, replace: true });
  }, [aberto?.militarId, busca.militar, mes]); // eslint-disable-line react-hooks/exhaustive-deps
  // modo foco: ao abrir um militar, a página vai ao topo para o calendário aparecer
  useEffect(() => {
    if (celular && aberto) window.scrollTo?.({ top: 0 });
  }, [celular, aberto?.militarId]); // eslint-disable-line react-hooks/exhaustive-deps
  const focoAoAbrir = useRef(false);
  const dados = useQuery({ ...consultaVoluntariadoDoMilitar(aberto?.militarId ?? '', mes), enabled: Boolean(aberto) });

  return (
    <ProvedorDePendencias>
      <section className="grid gap-4">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Voluntariado</h1>
        <div className="grid gap-1.5">
          <Label htmlFor="vo-mes">Mês</Label>
          <CampoDeMes id="vo-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
        </div>
        {lista.isPending && <p className="text-apagado">Carregando…</p>}
        {lista.error && <p role="alert" className="text-alerta">{mensagemDe(lista.error)}</p>}
        {lista.data && militares.length === 0 && <p className="text-apagado">Nenhum militar lotado na seção neste mês.</p>}
        {celular && !aberto && todosLancados && <p role="status" className="text-sm text-apagado">Todos os militares deste mês foram lançados.</p>}
        {lista.data && militares.length > 0 && (
          <div className={celular ? 'grid gap-4' : 'grid items-start gap-4 lg:grid-cols-[20rem_1fr]'}>
            {!(celular && aberto) && <ListaDoVoluntariado militares={militares} abertoId={aberto?.militarId} mes={mes} busca={texto} aoBuscar={setTexto} />}
            {aberto && (
            <div className="grid gap-3">
              {celular && (
                <Link to="/voluntariado" search={{ mes }} className="justify-self-start rounded-md border border-linha px-3 py-2 text-sm font-medium hover:bg-accent">‹ Militares</Link>
              )}
              {dados.isPending && <p className="text-apagado">Carregando…</p>}
              {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
              {dados.data && (
                <CalendarioDoVoluntariado
                  key={`${aberto.militarId}|${mes}`}
                  militar={aberto}
                  mes={mes}
                  dados={dados.data}
                  focarAoAbrir={focoAoAbrir.current}
                  aoAbrir={() => (focoAoAbrir.current = false)}
                  guiaAberto={guiaAberto}
                  aoAbrirGuia={() => setGuiaAberto(true)}
                  aoFecharGuia={() => {
                    setGuiaAberto(false);
                    lembrarGuiaFechado();
                  }}
                  aoSalvar={async (faixas, soltarPendencia) => {
                    setTodosLancados(false);
                    const nova = await lancarVoluntariado(queryClient, eu.unidade.id, aberto.militarId, mes, faixas);
                    soltarPendencia();
                    const proximo = proximoQueFalta(nova.militares, aberto.militarId);
                    if (celular) {
                      // celular: salvar volta à lista; o próximo que falta fica no alto de "Faltam lançar"
                      if (!proximo) setTodosLancados(true);
                      await navigate({ search: { mes } });
                    } else if (proximo) {
                      focoAoAbrir.current = true;
                      await navigate({ search: { mes, militar: proximo } });
                    }
                    else setTodosLancados(true);
                  }}
                />
              )}
              {!celular && todosLancados && <p role="status" className="text-sm text-apagado">Todos os militares deste mês foram lançados.</p>}
            </div>
            )}
          </div>
        )}
      </section>
    </ProvedorDePendencias>
  );
}
