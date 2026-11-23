import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ItemDoPeculio } from 'contratos';
import { IdCard, Mail, Phone, TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarPeculio, consultaPeculio, podeCadastrarMilitar, unidadeDoPeculio } from '@/api/peculio';
import { EtiquetaDeDado } from '@/componentes/EtiquetaDeDado';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { NovoMilitar } from '@/componentes/militares/NovoMilitar';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { correspondeABusca, normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { classeItemEscolhido } from '@/componentes/ListaDetalhe';

export const Route = createFileRoute('/_app/peculio')({
  component: Peculio,
});

const dois = (n: number) => String(n).padStart(2, '0');

/**
 * O módulo Pecúlio: todos os militares da unidade do usuário e das de baixo (o 2º GB para quem cuida do pessoal), com a busca, o filtro
 * por lotação e os aniversariantes do mês. Clicar num militar abre a ficha dele, que é a mesma de sempre (cada bloco é editado pelo seu dono).
 */
function Peculio() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const unidade = unidadeDoPeculio(eu);
  const mes = mesAtual();
  const lista = useQuery(consultaPeculio(unidade.id, mes));
  const [busca, setBusca] = useState('');
  const [lotacao, setLotacao] = useState('');
  const [novo, setNovo] = useState(false);
  const lotacoes = useMemo(() => [...new Set((lista.data?.militares ?? []).map((m) => m.lotacao))].sort(), [lista.data]);
  const filtrados = useMemo(() => {
    const b = normalizarBusca(busca);
    return (lista.data?.militares ?? []).filter(
      (m) => (!lotacao || m.lotacao === lotacao) && (!b || correspondeABusca(`${m.nomeGuerra} ${m.nomeCompleto ?? ''} ${m.matricula}`, busca)),
    );
  }, [lista.data, busca, lotacao]);
  // com texto na busca e um resultado só, ele fica em destaque e o Enter abre a ficha (a ficha nunca abre sozinha)
  const unico = busca.trim() !== '' && filtrados.length === 1 ? filtrados[0]! : null;

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Pecúlio</h1>
        <div className="flex flex-wrap gap-2">
          <ImportarPlanilha cadastro="peculio" rotulo="o Pecúlio" unidadeId={unidade.id} aoConcluir={() => atualizarPeculio(queryClient)} />
          {podeCadastrarMilitar(eu) && (
            <Button onClick={() => setNovo(true)}>
              <UserPlus aria-hidden />
              Novo militar
            </Button>
          )}
          {novo && <NovoMilitar eu={eu} aoFechar={() => setNovo(false)} />}
        </div>
      </header>

      {lista.isPending && <p className="mt-6 text-apagado">Carregando…</p>}
      {lista.error && <p role="alert" className="mt-6 text-alerta">{mensagemDe(lista.error)}</p>}
      {lista.data && (
        <div className={cn('mt-6 grid items-start gap-6', lista.data.aniversariantes && 'lg:grid-cols-[1fr_20rem]')}>
          <div className="rounded-xl border border-linha bg-superficie">
            <div className="grid gap-2 border-b border-linha p-3 sm:grid-cols-[1fr_12rem]">
              <div className="grid gap-1">
                <Label htmlFor="busca-peculio" className="sr-only">Buscar por nome ou matrícula</Label>
                <Input
                  id="busca-peculio"
                  placeholder="Buscar por nome ou matrícula"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !unico) return;
                    e.preventDefault();
                    void navigate({ to: '/militares/$id', params: { id: unico.militarId }, search: { de: 'peculio' } });
                  }}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filtro-lotacao" className="text-xs text-apagado">Lotação</Label>
                <Selecao id="filtro-lotacao" value={lotacao} onChange={(e) => setLotacao(e.target.value)}>
                  <option value="">Todas</option>
                  {lotacoes.map((l) => <option key={l} value={l}>{l}</option>)}
                </Selecao>
              </div>
            </div>
            <p className="px-4 pt-3 text-xs text-apagado">{filtrados.length} de {lista.data.militares.length} militares</p>
            <ul aria-label="Militares do Pecúlio" className="p-2">
              {filtrados.map((m) => <ItemDoPeculioNaLista key={m.militarId} m={m} destaque={m.militarId === unico?.militarId} />)}
              {lista.data.militares.length === 0 && <li className="p-3 text-apagado">Nenhum militar lotado. Cadastre com "Novo militar" ou use "Importar".</li>}
            </ul>
          </div>

          {/* o nascimento é de quem cuida do Pecúlio: sem poder ver o de ninguém da lista, a seção nem aparece (e não diz que ninguém faz aniversário) */}
          {lista.data.aniversariantes && (
          <section className="rounded-xl border border-linha bg-superficie p-4">
            <h2 className="font-cond text-lg font-semibold">Aniversariantes do mês</h2>
            {lista.data.aniversariantes.length === 0 ? (
              <p className="mt-2 text-sm text-apagado">Nenhum aniversariante neste mês.</p>
            ) : (
              <ul className="mt-2 grid gap-1.5 text-sm">
                {lista.data.aniversariantes.map((a) => (
                  <li key={a.militarId} className="flex items-baseline gap-2">
                    <span className="w-12 shrink-0 font-cond font-semibold">{`${dois(a.dia)}/${mes.slice(5)}`}</span>
                    <span>
                      <span className="text-apagado">{a.posto}</span> <span className="font-medium">{a.nomeGuerra}</span>
                    </span>
                    <span className="ml-auto text-xs text-apagado">{a.lotacao}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </div>
      )}
    </section>
  );
}

function ItemDoPeculioNaLista({ m, destaque }: { m: ItemDoPeculio; destaque: boolean }) {
  return (
    <li>
      <Link
        to="/militares/$id"
        params={{ id: m.militarId }}
        search={{ de: 'peculio' }}
        aria-current={destaque ? 'true' : undefined}
        className={cn('grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent', destaque && classeItemEscolhido)}
      >
        <span className="flex items-center gap-2">
          <span className="font-cond text-[13px] text-apagado">{m.posto}</span>
          <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
          {m.pendencias.length > 0 && <TriangleAlert className="size-4 text-pendencia" role="img" aria-label={`Cadastro incompleto: ${m.pendencias.join('; ')}`} />}
          <span className="ml-auto rounded-md border border-linha px-2 font-cond text-[13px] font-medium">{m.lotacao}</span>
        </span>
        {m.nomeCompleto && <span className="text-[15px] leading-[22px] text-tinta">{m.nomeCompleto}</span>}
        <span className="mt-1 flex flex-wrap gap-1.5">
          <EtiquetaDeDado icone={IdCard}>{m.matricula}</EtiquetaDeDado>
          {m.telefone ? <EtiquetaDeDado icone={Phone}>{m.telefone}</EtiquetaDeDado> : <EtiquetaDeDado icone={Phone} falta>Sem telefone</EtiquetaDeDado>}
          {m.email ? <EtiquetaDeDado icone={Mail}>{m.email}</EtiquetaDeDado> : <EtiquetaDeDado icone={Mail} falta>Sem e-mail</EtiquetaDeDado>}
        </span>
      </Link>
    </li>
  );
}
