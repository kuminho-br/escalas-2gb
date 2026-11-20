import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Data } from 'contratos';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEfetivoDoDia, voltarMetaAoPadrao } from '@/api/efetivo-do-dia';
import { podeMudarParametro } from '@/api/eu';
import { CotasRestantes } from '@/componentes/CotasRestantes';
import { AlterarMetaDoDia } from '@/componentes/efetivo-por-dia/AlterarMetaDoDia';
import { CardDoEfetivo } from '@/componentes/efetivo-por-dia/CardDoEfetivo';
import { ReguaDoEfetivo } from '@/componentes/efetivo-por-dia/ReguaDoEfetivo';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { guardarUltimoDia, janelaDoDia, marcasDoDia, ultimoDiaVisto } from '@/lib/efetivo';
import { dataPorExtenso, hoje, somarDias } from '@/lib/meses';

export const Route = createFileRoute('/_app/efetivo-por-dia')({
  validateSearch: (s: Record<string, unknown>): { data?: string } => ({ data: typeof s.data === 'string' && Data.safeParse(s.data).success ? s.data : undefined }),
  component: EfetivoPorDia,
});

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** A tela de trabalho do escalante: navegar pelos dias e escalar com a visão diária, atravessando todas as escalas da área. */
function EfetivoPorDia() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  // sem data no endereço, abre no último dia visto nesta tela (guardado no navegador); sem ele, hoje
  const [inicial] = useState(() => ultimoDiaVisto() ?? hoje());
  const data = busca.data ?? inicial;
  useEffect(() => guardarUltimoDia(data), [data]);
  const dados = useQuery(consultaEfetivoDoDia(eu.unidade.id, data));
  const [alterando, setAlterando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const podeAlterar = podeMudarParametro(eu);
  const irPara = (d: string) => void navigate({ search: (s) => ({ ...s, data: d }) });

  const voltarAoPadrao = travar(async () => {
    setErro(null);
    try {
      await voltarMetaAoPadrao(queryClient, eu.unidade.id, data);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const e = dados.data;
  const janela = e ? janelaDoDia(e.guarnicoes) : null;
  return (
    <section className="grid gap-4">
      <h1 className="font-cond text-[28px] leading-tight font-semibold">Efetivo por dia</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" size="icon" aria-label="Dia anterior" onClick={() => irPara(somarDias(data, -1))}>
          <ChevronLeft aria-hidden />
        </Button>
        <div className="grid gap-1.5">
          <Label htmlFor="ed-data">Dia</Label>
          <Input id="ed-data" type="date" value={data} onChange={(ev) => ev.target.value && irPara(ev.target.value)} className="w-44" />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Dia seguinte" onClick={() => irPara(somarDias(data, 1))}>
          <ChevronRight aria-hidden />
        </Button>
        <p className="text-sm text-apagado">{dataPorExtenso(data)}</p>
      </div>

      {dados.isPending && <p className="text-apagado">Carregando…</p>}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {e && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-medium">
              Meta do dia: {e.meta.total === 0 ? 'nenhuma guarnição' : `${plural(e.meta.total, 'guarnição', 'guarnições')}, ${plural(e.meta.ativadas, 'ativada', 'ativadas')}`}
            </p>
            {e.meta.origem === 'dia' && <span className="rounded-full bg-pendencia-fundo px-2 py-0.5 text-xs font-medium text-pendencia">Meta alterada neste dia</span>}
            {podeAlterar && e.meta.origem === 'dia' && (
              <Button type="button" variant="outline" size="sm" disabled={salvando} onClick={() => void voltarAoPadrao()}>Voltar ao padrão</Button>
            )}
            {podeAlterar && (
              <Button type="button" size="sm" className="ml-auto" onClick={() => setAlterando(true)}>Alterar a meta deste dia</Button>
            )}
          </div>
          <CotasRestantes cotas={e.cotas} />
          {e.guarnicoes.length === 0 ? (
            <p className="text-apagado">Nenhuma guarnição na meta nem escalada neste dia.</p>
          ) : (
            <div className="grid gap-3">
              {janela && <ReguaDoEfetivo janela={janela} marcas={marcasDoDia(e.guarnicoes, janela)} />}
              {e.guarnicoes.map((g) => <CardDoEfetivo key={g.guarnicaoId} g={g} janela={janela} />)}
            </div>
          )}
          {alterando && (
            <AlterarMetaDoDia
              key={data}
              unidadeId={eu.unidade.id}
              data={data}
              atuais={e.guarnicoes.filter((g) => g.ordem !== null).map((g) => ({ guarnicaoId: g.guarnicaoId, nome: g.nome }))}
              aoFechar={() => setAlterando(false)}
            />
          )}
        </>
      )}
    </section>
  );
}
