import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MilitarExterno } from 'contratos';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaParaTrazer } from '@/api/consulta';
import { consultaExternos, tirarExterno, trazerExterno } from '@/api/externos';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { dataBr } from '@/componentes/militares/Secao';
import { useAviso } from '@/componentes/resposta/useAviso';
import { useConfirmar } from '@/componentes/resposta/useConfirmar';
import { Espera } from '@/componentes/resposta/Espera';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

const MSG_CURTA = 'Digite pelo menos 3 letras.';
const MSG_HA_MAIS = 'Há mais militares. Refine a busca.';

/**
 * Os militares de outras unidades na escala (6.36), na aba Voluntariado das Configurações da escala: quem o gestor trouxe pode ser escalado à mão
 * em qualquer serviço da escala, até alguém tirar. A lotação dele não muda. O auxiliar só vê a lista; trazer e tirar é do gestor.
 */
export function MilitaresDeOutrasUnidades({ unidadeId, sigla, podeMudar }: { unidadeId: string; sigla: string; podeMudar: boolean }) {
  const externos = useQuery(consultaExternos(unidadeId));
  return (
    <section aria-labelledby="externos-titulo" className="mt-6 rounded-xl border border-linha bg-superficie">
      <header className="border-b border-linha px-4 py-3">
        <h3 id="externos-titulo" className="font-cond text-lg font-semibold">Militares de outras unidades</h3>
        <p className="text-sm text-apagado">
          Quem for trazido para a escala de {sigla} pode ser escalado à mão em qualquer serviço daqui, até alguém tirar. A lotação dele não muda.
          {podeMudar ? '' : ' Só o gestor ou o administrador traz e tira.'}
        </p>
      </header>
      {externos.isPending && <Espera className="py-6" />}
      {externos.error && <p role="alert" className="px-4 py-3 text-alerta">{mensagemDe(externos.error)}</p>}
      {externos.data && <ListaDosExternos externos={externos.data} unidadeId={unidadeId} sigla={sigla} podeMudar={podeMudar} />}
      {podeMudar && <BuscaParaTrazer unidadeId={unidadeId} sigla={sigla} jaNaEscala={new Set((externos.data ?? []).map((e) => e.militarId))} />}
    </section>
  );
}

const nomeDe = (posto: string, nomeGuerra: string) => `${posto} ${nomeGuerra}`;

function ListaDosExternos({ externos, unidadeId, sigla, podeMudar }: { externos: MilitarExterno[]; unidadeId: string; sigla: string; podeMudar: boolean }) {
  const queryClient = useQueryClient();
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const { salvando, travar } = useTrava();
  const tirar = travar(async (e: MilitarExterno) => {
    const quem = nomeDe(e.posto, e.nomeGuerra);
    if (!(await confirmar({ titulo: `Tirar ${quem} da escala de ${sigla}?`, texto: 'Os serviços já lançados ficam.', verbo: 'Tirar' }))) return;
    try {
      await tirarExterno(queryClient, unidadeId, e.vinculoId);
      avisar({ texto: `${quem} saiu da escala de ${sigla}.` });
    } catch (err) {
      avisar({ texto: mensagemDe(err), erro: true });
    }
  });
  if (externos.length === 0) return <p className="px-4 py-4 text-apagado">{`Nenhum militar de outra unidade na escala de ${sigla}.`}</p>;
  return (
    <ul aria-label="Militares de outras unidades na escala" className="divide-y divide-linha">
      {externos.map((e) => (
        <li key={e.vinculoId} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="grid min-w-0 gap-0.5">
            <span className="flex items-baseline gap-2">
              <span className="font-cond text-apoio text-apagado">{e.posto}</span>
              <span className="font-cond text-base font-semibold">{e.nomeGuerra}</span>
            </span>
            <span className="text-xs text-apagado">{`${e.matricula} · lotado em ${e.lotacaoSigla} · desde ${dataBr(e.desde)}`}</span>
          </span>
          {podeMudar && (
            <Button type="button" variant="secundario" size="sm" disabled={salvando} aria-label={`Tirar ${nomeDe(e.posto, e.nomeGuerra)}`} onClick={() => void tirar(e)}>Tirar</Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function BuscaParaTrazer({ unidadeId, sigla, jaNaEscala }: { unidadeId: string; sigla: string; jaNaEscala: Set<string> }) {
  const [campo, setCampo] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (campo.trim().length < 3) {
      setErro(MSG_CURTA);
      return;
    }
    setErro(null);
    setTexto(campo.trim());
  };
  return (
    <div className="border-t border-linha px-4 py-3">
      <form onSubmit={buscar} role="search" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="externo-busca">Buscar militar de outra unidade por nome ou matrícula</Label>
          <Input id="externo-busca" value={campo} onChange={(e) => setCampo(e.target.value)} autoComplete="off" aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'externo-busca-erro' : undefined} />
        </div>
        <Button type="submit" variant="secundario">
          <Search aria-hidden />
          Buscar
        </Button>
        {erro && <p id="externo-busca-erro" role="alert" className="text-sm text-alerta sm:col-span-2">{erro}</p>}
      </form>
      {texto && <ResultadoDaBusca texto={texto} unidadeId={unidadeId} sigla={sigla} jaNaEscala={jaNaEscala} />}
    </div>
  );
}

function ResultadoDaBusca({ texto, unidadeId, sigla, jaNaEscala }: { texto: string; unidadeId: string; sigla: string; jaNaEscala: Set<string> }) {
  const queryClient = useQueryClient();
  const avisar = useAviso();
  const { salvando, travar } = useTrava();
  const busca = useQuery(consultaParaTrazer(texto, unidadeId));
  const trazer = travar(async (id: string, quem: string) => {
    try {
      await trazerExterno(queryClient, unidadeId, id);
      avisar({ texto: `${quem} agora está na escala de ${sigla}.` });
    } catch (err) {
      avisar({ texto: mensagemDe(err), erro: true });
    }
  });
  if (busca.isPending) return <p className="mt-3 text-apagado">Buscando…</p>;
  if (busca.error) return <p role="alert" className="mt-3 text-alerta">{mensagemDe(busca.error)}</p>;
  const { militares, haMais } = busca.data;
  if (militares.length === 0) return <p className="mt-3 text-apagado">Nenhum militar encontrado. Confira o nome ou a matrícula.</p>;
  return (
    <div className="mt-3">
      {haMais && <p role="status" className="mb-2 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{MSG_HA_MAIS}</p>}
      <ul aria-label="Resultado da busca" className="divide-y divide-linha rounded-lg border border-linha">
        {militares.map((m) => {
          const quem = nomeDe(m.postoGrad, m.nomeGuerra);
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="grid min-w-0 gap-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="font-cond text-apoio text-apagado">{m.postoGrad}</span>
                  <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
                </span>
                <span className="text-xs text-apagado">{`${m.matricula} · ${m.lotacao ? `lotado em ${m.lotacao}` : 'sem lotação hoje'}`}</span>
              </span>
              {m.daUnidade ? (
                <span className="shrink-0 text-sm text-apagado">Já é desta unidade.</span>
              ) : jaNaEscala.has(m.id) ? (
                <span className="shrink-0 text-sm text-apagado">Já está na escala.</span>
              ) : (
                <Button type="button" variant="secundario" size="sm" disabled={salvando} aria-label={`Trazer ${quem}`} onClick={() => void trazer(m.id, quem)}>Trazer</Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
