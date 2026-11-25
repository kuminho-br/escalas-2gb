import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes } from 'contratos';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { consultaEscalaEmLeitura } from '@/api/visualizacao';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { DiaDaEscalaVista } from '@/componentes/escala-do-mes/DiaDaEscala';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { Button } from '@/componentes/ui/button';
import { Label } from '@/componentes/ui/label';
import { EtiquetaDoEstado } from '@/componentes/visualizacao/EtiquetaDoEstado';
import { diaEMesBr, mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/escalas-da-corporacao_/$id')({
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: EscalaAberta,
});

/** A linha do estado de uma escala aberta à leitura (textos fixos da 7.5). */
function linhaDoEstado(estado: string, em: string | null): string {
  const dia = em ? diaEMesBr(em) : '';
  if (estado === 'previa') return `Prévia lançada em ${dia}. Pode mudar até o dia do serviço.`;
  if (estado === 'retificada') return `Republicada em ${dia}.`;
  if (estado === 'remessada') return `Remessada em ${dia}.`;
  return `Publicada em ${dia}.`;
}

/**
 * Uma escala aberta à corporação (7.5): a Escala do mês só para leitura (os mesmos dias da tela de montagem, sem nenhum controle de escalar, tirar, trocar, lançar, publicar ou republicar),
 * com a linha do estado. Se ela deixou de estar aberta para a conta (a unidade a tirou do alcance, ou voltou a ser rascunho), a leitura responde 404 e a tela diz isso.
 */
function EscalaAberta() {
  const { id } = Route.useParams();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? mesAtual();
  const dados = useQuery(consultaEscalaEmLeitura(id, mes));
  const naoAberta = dados.error instanceof ErroApi && dados.error.status === 404;
  const e = dados.data;
  const emGrade = Boolean(e && e.dias.length > 0 && e.dias.every((d) => d.faixas.length <= 1));
  return (
    <Moldura
      titulo={e?.nome ?? 'Escala'}
      antes={<Button asChild variant="discreto" size="sm"><Link to="/escalas-da-corporacao" search={{ mes }}>Voltar às escalas</Link></Button>}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="ea-mes">Mês</Label>
        <CampoDeMes id="ea-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
      </div>
      {dados.isPending && <Espera />}
      {dados.error && (
        <p role="alert" className="max-w-xl text-alerta">
          {naoAberta ? 'Esta escala não está aberta para você.' : mensagemDe(dados.error)}
        </p>
      )}
      {e && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-linha bg-superficie px-4 py-3">
            <EtiquetaDoEstado estado={e.estado.estado} emRetificacao={e.estado.emRetificacao} />
            <p className="text-apoio text-apagado">{linhaDoEstado(e.estado.estado, e.estado.em)}</p>
          </div>
          <div
            data-dias-em-grade={emGrade ? '' : undefined}
            className={cn('grid gap-3', emGrade && 'grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start')}
          >
            {e.dias.map((d) => <DiaDaEscalaVista key={d.data} dia={d} soVazias={false} />)}
          </div>
        </>
      )}
    </Moldura>
  );
}
