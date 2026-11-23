import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useParams, useSearch } from '@tanstack/react-router';
import type { LinhaMilitar } from 'contratos';
import { Briefcase, CalendarOff, Car, Clock, IdCard, TriangleAlert } from 'lucide-react';
import { EtiquetaDeDado } from '@/componentes/EtiquetaDeDado';
import { useMemo, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaEquipes, consultaMilitares } from '@/api/militares';
import { classeItemEscolhido, ListaDetalhe } from '@/componentes/ListaDetalhe';
import { Selecao } from '@/componentes/Selecao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { NOME_JORNADA } from '@/lib/militares';
import { correspondeABusca, normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/militares')({
  component: Militares,
});

function Militares() {
  const { eu } = Route.useRouteContext();
  const { id } = useParams({ strict: false });
  return (
    <ListaDetalhe
      titulo="Militares"
      temDetalhe={Boolean(id)}
      lista={<ListaDeMilitares unidadeId={eu.unidade.id} escolhido={id} />}
      detalhe={<Outlet />}
    />
  );
}

function ListaDeMilitares({ unidadeId, escolhido }: { unidadeId: string; escolhido?: string }) {
  const mes = mesAtual();
  const militares = useQuery(consultaMilitares(unidadeId, mes));
  const equipes = useQuery(consultaEquipes(unidadeId));
  const [equipe, setEquipe] = useState('');
  const [jornada, setJornada] = useState('');
  const [busca, setBusca] = useState('');
  const [soIncompletos, setSoIncompletos] = useState(false);
  const incompletos = (militares.data ?? []).filter((m) => m.pendencias.length > 0).length;

  const filtrados = useMemo(() => {
    const b = normalizarBusca(busca);
    return (militares.data ?? []).filter(
      (m) =>
        (!soIncompletos || m.pendencias.length > 0) &&
        (!equipe || m.equipe === equipe) &&
        (!jornada || m.jornada === jornada) &&
        (!b || correspondeABusca(`${m.nomeGuerra} ${m.nomeCompleto ?? ''} ${m.matricula}`, busca)),
    );
  }, [militares.data, soIncompletos, equipe, jornada, busca]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 gap-2 border-b border-linha p-3">
        <div className="grid gap-1">
          <Label htmlFor="busca-militar" className="sr-only">Buscar por nome ou matrícula</Label>
          <Input id="busca-militar" placeholder="Buscar por nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="filtro-equipe" className="text-xs text-apagado">Equipe</Label>
            <Selecao id="filtro-equipe" value={equipe} onChange={(e) => setEquipe(e.target.value)}>
              <option value="">Todas</option>
              {equipes.data?.map((e) => <option key={e.id} value={e.nome}>{e.nome}</option>)}
            </Selecao>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filtro-jornada" className="text-xs text-apagado">Jornada</Label>
            <Selecao id="filtro-jornada" value={jornada} onChange={(e) => setJornada(e.target.value)}>
              <option value="">Todas</option>
              <option value="pronto">Pronto</option>
              <option value="adm">Adm</option>
            </Selecao>
          </div>
        </div>
      </div>
      {militares.isPending && <p className="p-4 text-apagado">Carregando…</p>}
      {militares.error && <p role="alert" className="p-4 text-alerta">{mensagemDe(militares.error)}</p>}
      {militares.data && (
        <>
          <p className="shrink-0 px-4 pt-3 text-xs text-apagado">{filtrados.length} de {militares.data.length} militares</p>
          {(incompletos > 0 || soIncompletos) && (
            <p className="shrink-0 px-4 pt-1 text-xs text-pendencia">
              {incompletos > 0 ? `Cadastro incompleto em ${incompletos} ${incompletos === 1 ? 'militar' : 'militares'}.` : 'Nenhum cadastro incompleto.'}{' '}
              <button type="button" onClick={() => setSoIncompletos(!soIncompletos)} className="font-medium underline underline-offset-2">
                {soIncompletos ? 'Ver todos' : 'Ver quais'}
              </button>
            </p>
          )}
          <ul data-lista-rolavel className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filtrados.map((m) => <ItemMilitar key={m.id} m={m} escolhido={m.id === escolhido} />)}
            {militares.data.length === 0 && <li className="p-3 text-apagado">Nenhum militar lotado. O militar novo é cadastrado no Pecúlio.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function ItemMilitar({ m, escolhido }: { m: LinhaMilitar; escolhido: boolean }) {
  // a ficha aberta pelo Pecúlio continua sendo do Pecúlio ao passar para outro militar da lista
  const { de } = useSearch({ strict: false }) as { de?: 'peculio' };
  const disponivel = m.situacao === 'Disponível';
  return (
    <li>
      <Link
        to="/militares/$id"
        params={{ id: m.id }}
        search={de === 'peculio' ? { de } : undefined}
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', escolhido && classeItemEscolhido)}
        aria-current={escolhido ? 'page' : undefined}
      >
        <span className="flex items-center gap-2">
          <span className="font-cond text-[13px] text-apagado">{m.posto}</span>
          <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
          {m.pendencias.length > 0 && (
            <TriangleAlert
              className="size-4 text-pendencia"
              role="img"
              aria-label={`Cadastro incompleto: ${m.pendencias.join('; ')}`}
            />
          )}
        </span>
        {m.nomeCompleto && <span className="text-[15px] leading-[22px] text-tinta">{m.nomeCompleto}</span>}
        <span className="mt-1 flex flex-wrap gap-1.5">
          <EtiquetaDeDado icone={IdCard}>{m.matricula}</EtiquetaDeDado>
          {m.jornada && <EtiquetaDeDado icone={m.jornada === 'adm' ? Briefcase : Clock}>{`${NOME_JORNADA[m.jornada]}${m.equipe ? ` · ${m.equipe.toUpperCase()}` : ''}`}</EtiquetaDeDado>}
          {m.motorista && <EtiquetaDeDado icone={Car}>{`Motorista ${m.motorista}`}</EtiquetaDeDado>}
          {!disponivel && <EtiquetaDeDado icone={CalendarOff}>{m.situacao}</EtiquetaDeDado>}
        </span>
      </Link>
    </li>
  );
}
