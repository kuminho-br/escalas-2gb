import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Mes, type OcupanteDaVaga } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEscalaDoMes, desfazerRemocao, removerAlocacao, tirarAcumulo } from '@/api/escala-do-mes';
import { listaComE } from '@/lib/escala';
import { consultaEscalas } from '@/api/escalas';
import type { VagaDaTela } from '@/componentes/escala-do-mes/CardDaGuarnicao';
import { DiaDaEscalaVista } from '@/componentes/escala-do-mes/DiaDaEscala';
import { EscolherMilitar } from '@/componentes/escala-do-mes/EscolherMilitar';
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
  const queryClient = useQueryClient();
  const [soVazias, setSoVazias] = useState(false);
  const [vaga, setVaga] = useState<VagaDaTela | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ativas = escalas.data?.filter((e) => e.ativa) ?? [];
  const escalaId = busca.escala ?? ativas[0]?.id;
  const mes = busca.mes ?? mesAtual();
  const dados = useQuery({ ...consultaEscalaDoMes(escalaId ?? '', mes), enabled: Boolean(escalaId) });
  const opcoes = escalas.data?.filter((e) => e.ativa || e.id === escalaId) ?? [];

  async function remover(o: OcupanteDaVaga, guarnicao: string, dia: number, vaga: string) {
    // um acúmulo sai sozinho (o militar continua na vaga original); a original leva os acúmulos junto
    const acumulo = o.acumuloId !== null;
    const pergunta = acumulo
      ? `Tirar ${o.nomeGuerra} de ${vaga}? Ele continua em ${o.acumulaCom[0] ?? 'sua vaga'}.`
      : `Remover ${o.nomeGuerra} de ${guarnicao}, dia ${dia}? Ele não volta para este turno quando a pré-escala for gerada de novo.` +
        (o.acumulaCom.length ? ` Sai também de: ${listaComE(o.acumulaCom)}.` : '');
    if (!window.confirm(pergunta)) return;
    setErro(null);
    try {
      await (acumulo ? tirarAcumulo(queryClient, o.acumuloId!) : removerAlocacao(queryClient, o.alocacaoId));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }
  async function desfazer(remocaoId: string) {
    setErro(null);
    try {
      await desfazerRemocao(queryClient, remocaoId);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }

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

      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      {dados.isPending && <p className="text-apagado">Carregando…</p>}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {dados.data && (
        <div className="grid gap-3">
          {dados.data.dias.map((d) => <DiaDaEscalaVista key={d.data} dia={d} soVazias={soVazias} aoEscolher={setVaga} aoRemover={(o, g, n, v) => void remover(o, g, n, v)} aoDesfazer={(id) => void desfazer(id)} />)}
        </div>
      )}
      {vaga && <EscolherMilitar key={`${vaga.data}|${vaga.inicio}|${vaga.guarnicaoId}|${vaga.funcaoId}`} escalaId={escalaId} vaga={vaga} aoFechar={() => setVaga(null)} />}
    </section>
  );
}
