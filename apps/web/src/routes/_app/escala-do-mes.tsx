import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEscalaDoMes } from '@/api/escala-do-mes';
import { consultaEscalas } from '@/api/escalas';
import { DiaDaEscalaVista } from '@/componentes/escala-do-mes/DiaDaEscala';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/escala-do-mes')({
  validateSearch: (s: Record<string, unknown>): { escala?: string; mes?: string } => ({
    escala: typeof s.escala === 'string' ? s.escala : undefined,
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
  }),
  component: EscalaDoMes,
});

function EscalaDoMes() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const escalas = useQuery(consultaEscalas(eu.unidade.id));
  const [soVazias, setSoVazias] = useState(false);
  const ativas = escalas.data?.filter((e) => e.ativa) ?? [];
  const escalaId = busca.escala ?? ativas[0]?.id;
  const mes = busca.mes ?? mesAtual();
  const dados = useQuery({ ...consultaEscalaDoMes(escalaId ?? '', mes), enabled: Boolean(escalaId) });
  const opcoes = escalas.data?.filter((e) => e.ativa || e.id === escalaId) ?? [];

  if (escalas.isPending) return <p className="text-apagado">Carregando…</p>;
  if (escalas.error) return <p role="alert" className="text-alerta">{mensagemDe(escalas.error)}</p>;
  if (!escalaId) {
    return (
      <section>
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Escala do mês</h1>
        <p className="mt-4 text-apagado">
          Nenhuma escala ativa. Crie uma em <Link to="/escalas" className="font-medium text-vinho underline underline-offset-2">Escalas</Link>.
        </p>
      </section>
    );
  }

  const resumo = dados.data?.resumo;
  return (
    <section className="grid gap-4">
      <h1 className="font-cond text-[28px] leading-tight font-semibold">Escala do mês</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="em-escala">Escala</Label>
          <Selecao id="em-escala" value={escalaId} onChange={(e) => void navigate({ search: (s) => ({ ...s, escala: e.target.value }) })} className="w-56">
            {opcoes.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </Selecao>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="em-mes">Mês</Label>
          <Input id="em-mes" type="month" value={mes} onChange={(e) => e.target.value && void navigate({ search: (s) => ({ ...s, mes: e.target.value }) })} className="w-44" />
        </div>
        {resumo && (
          <p className="text-sm">
            {resumo.obrigatorias - resumo.obrigatoriasVazias} de {resumo.obrigatorias} vagas obrigatórias preenchidas,{' '}
            <span className={cn(resumo.obrigatoriasVazias > 0 && 'font-medium text-pendencia')}>{resumo.obrigatoriasVazias} vazias</span>
          </p>
        )}
        <Button type="button" variant="outline" aria-pressed={soVazias} onClick={() => setSoVazias(!soVazias)} className="ml-auto">
          Mostrar só vagas vazias
        </Button>
      </div>

      {dados.isPending && <p className="text-apagado">Carregando…</p>}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {dados.data && (
        <div className="grid gap-3">
          {dados.data.dias.map((d) => <DiaDaEscalaVista key={d.data} dia={d} soVazias={soVazias} />)}
        </div>
      )}
    </section>
  );
}
