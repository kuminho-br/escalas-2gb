import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Mes, somarMeses } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaVoluntariadoDoMes, consultaVoluntariadoDoMilitar, lancarVoluntariado } from '@/api/voluntariado';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { CalendarioDoVoluntariado } from '@/componentes/voluntariado/CalendarioDoVoluntariado';
import { ListaDoVoluntariado } from '@/componentes/voluntariado/ListaDoVoluntariado';
import { mesAtual } from '@/lib/meses';
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
  const militares = lista.data?.militares ?? [];
  const aberto = militares.find((m) => m.militarId === busca.militar) ?? militares.find((m) => !m.lancado) ?? militares[0];
  const dados = useQuery({ ...consultaVoluntariadoDoMilitar(aberto?.militarId ?? '', mes), enabled: Boolean(aberto) });

  return (
    <ProvedorDePendencias>
      <section className="grid gap-4">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Voluntariado</h1>
        <div className="grid gap-1.5">
          <Label htmlFor="vo-mes">Mês</Label>
          <Input id="vo-mes" type="month" value={mes} onChange={(e) => e.target.value && void navigate({ search: { mes: e.target.value } })} className="w-44" />
        </div>
        {lista.isPending && <p className="text-apagado">Carregando…</p>}
        {lista.error && <p role="alert" className="text-alerta">{mensagemDe(lista.error)}</p>}
        {lista.data && militares.length === 0 && <p className="text-apagado">Nenhum militar lotado na seção neste mês.</p>}
        {lista.data && aberto && (
          <div className="grid items-start gap-4 lg:grid-cols-[20rem_1fr]">
            <ListaDoVoluntariado militares={militares} abertoId={aberto.militarId} mes={mes} busca={texto} aoBuscar={setTexto} />
            <div className="grid gap-3">
              {dados.isPending && <p className="text-apagado">Carregando…</p>}
              {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
              {dados.data && (
                <CalendarioDoVoluntariado
                  key={`${aberto.militarId}|${mes}`}
                  militar={aberto}
                  mes={mes}
                  dados={dados.data}
                  aoSalvar={async (marcas, soltarPendencia) => {
                    setTodosLancados(false);
                    const nova = await lancarVoluntariado(queryClient, eu.unidade.id, aberto.militarId, mes, marcas);
                    soltarPendencia();
                    const proximo = proximoQueFalta(nova.militares, aberto.militarId);
                    if (proximo) await navigate({ search: { mes, militar: proximo } });
                    else setTodosLancados(true);
                  }}
                />
              )}
              {todosLancados && <p role="status" className="text-sm text-apagado">Todos os militares deste mês foram lançados.</p>}
            </div>
          </div>
        )}
      </section>
    </ProvedorDePendencias>
  );
}
