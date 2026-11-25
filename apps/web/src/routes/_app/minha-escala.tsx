import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Mes, mesPorExtenso, type MeuServico } from 'contratos';
import { diaDaSemana } from 'dominio';
import { mensagemDe } from '@/api/cliente';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import { consultaMinhaEscala } from '@/api/visualizacao';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { Label } from '@/componentes/ui/label';
import { EtiquetaDoEstado } from '@/componentes/visualizacao/EtiquetaDoEstado';
import { mesAtual } from '@/lib/meses';
import { rotuloDaUnidade } from '@/lib/rotulo-da-unidade';

export const Route = createFileRoute('/_app/minha-escala')({
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: MinhaEscala,
});

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** O horário do serviço; o que passa da meia-noite (20:00 às 08:00) fica no dia em que começa e diz "até 08:00 do dia seguinte". */
const horarioDe = (s: Pick<MeuServico, 'inicio' | 'fim'>) => {
  // o que termina à meia-noite ("16:00 às 24:00") não vira "dia seguinte"; o que passa dela (20:00 às 08:00) diz até quando
  if (s.fim === '00:00' && s.inicio !== '00:00') return `${s.inicio} às 24:00`;
  return s.fim <= s.inicio ? `${s.inicio} até ${s.fim} do dia seguinte` : `${s.inicio} às ${s.fim}`;
};

/**
 * Minha escala (7.5): os serviços do mês do militar da conta, nas escalas que já saíram do rascunho, por dia, com o estado de cada escala e quem compõe a guarnição.
 * Sem tabela: uma lista por dia, que no celular fica uma coluna só.
 */
function MinhaEscala() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? mesAtual();
  const dados = useQuery(consultaMinhaEscala(mes));
  // duas unidades de mesma sigla entre os serviços do mês se distinguem pela unidade de cima, como na lista de Escalas
  const unidades = useQuery(consultaUnidadesDaBusca);
  const doMes = (dados.data?.servicos ?? []).map((s) => ({ id: s.unidadeId, sigla: s.unidadeSigla }));
  const porDia = new Map<string, MeuServico[]>();
  for (const s of dados.data?.servicos ?? []) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);
  return (
    <Moldura titulo="Minha escala">
      <div className="grid gap-1.5">
        <Label htmlFor="me-mes">Mês</Label>
        <CampoDeMes id="me-mes" valor={mes} aoMudar={(m) => void navigate({ search: { mes: m } })} />
      </div>
      {dados.isPending && <Espera />}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {dados.data && porDia.size === 0 && <p className="max-w-xl text-apagado">{`Você não tem serviço em ${mesPorExtenso(mes)} nas escalas que já foram abertas.`}</p>}
      {dados.data && porDia.size > 0 && (
        <div className="grid max-w-3xl gap-3">
          {[...porDia].map(([data, servicos]) => (
            <section key={data} aria-label={`Dia ${Number(data.slice(8))}`} className="grid grid-cols-[3.5rem_1fr] gap-3 rounded-xl border border-linha bg-superficie p-3 sm:grid-cols-[5rem_1fr]">
              <div className="self-start">
                <span className="block font-cond text-4xl leading-none font-semibold">{Number(data.slice(8))}</span>
                <span className="block text-xs text-apagado">{SEMANA[diaDaSemana(data)]}</span>
              </div>
              <ul className="grid gap-3">
                {servicos.map((s) => <Servico key={s.alocacaoId} s={s} unidade={rotuloDaUnidade({ id: s.unidadeId, sigla: s.unidadeSigla }, doMes, unidades.data)} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Moldura>
  );
}

function Servico({ s, unidade }: { s: MeuServico; unidade: string }) {
  return (
    <li className="grid gap-1.5 border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-cond text-base font-semibold">{horarioDe(s)}</span>
        <span className="text-corpo font-medium">{s.servico}</span>
        <EtiquetaDoEstado estado={s.estado} emRetificacao={s.emRetificacao} />
      </div>
      <p className="text-apoio text-apagado">
        {`${s.escala} · ${unidade}`}
        {s.estado === 'previa' && <> · Pode mudar até o dia do serviço.</>}
      </p>
      {s.guarnicao ? (
        <>
          <p className="text-corpo">{s.funcao ? `${s.guarnicao} · ${s.funcao}` : s.guarnicao}</p>
          {s.composicao.length > 0 && (
            <ul aria-label={`Quem compõe ${s.guarnicao}`} className="grid gap-0.5 text-corpo">
              {s.composicao.map((c, i) => (
                <li key={`${c.nomeGuerra}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-cond text-apoio text-apagado">{c.patente}</span>
                  <span className={c.eu ? 'font-semibold' : undefined}>{c.eu ? 'Você' : c.nomeGuerra}</span>
                  {c.funcao && <span className="text-apoio text-apagado">{c.funcao}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-corpo text-apagado">Guarnição a definir</p>
      )}
    </li>
  );
}
