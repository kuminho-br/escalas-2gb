import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ItemDoPeculio } from 'contratos';
import { CalendarClock, IdCard, Mail, Phone, TriangleAlert, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarPeculio, consultaPeculio, podeCadastrarMilitar, unidadeDoPeculio } from '@/api/peculio';
import { EtiquetaDeDado } from '@/componentes/EtiquetaDeDado';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { NovoMilitar } from '@/componentes/militares/NovoMilitar';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { abaixoDe, type UnidadeDaArvore } from '@/lib/arvore-de-unidades';
import { dataBr, mesAtual } from '@/lib/meses';
import { correspondeABusca, normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { classeItemEscolhido } from '@/componentes/ListaDetalhe';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';

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
  // a lista aparece de 100 em 100 (a busca e o filtro olham a lista inteira); mudar o filtro volta aos 100 primeiros
  const [limite, setLimite] = useState(100);
  // o filtro "Lotação" é a árvore (6.45): a unidade do Pecúlio e as de baixo, como a pessoa as tem; a lotação de alguém da lista que não está
  // na árvore dela (uma unidade encerrada, por exemplo) entra debaixo da unidade do Pecúlio: nunca falta no filtro, e filtrar pela de cima a pega
  const unidadesDoFiltro = useMemo(() => {
    const conhecidas = new Map<string, UnidadeDaArvore>([...eu.unidades, ...eu.unidadesSoConsulta].map((u) => [u.id, u]));
    const daUnidade = abaixoDe([...conhecidas.values()], unidade.id);
    const doFiltro = [...conhecidas.values()].filter((u) => daUnidade.has(u.id));
    for (const m of lista.data?.militares ?? []) {
      if (!doFiltro.some((u) => u.id === m.lotacaoId)) doFiltro.push({ id: m.lotacaoId, sigla: m.lotacao, maeId: m.lotacaoId === unidade.id ? null : unidade.id });
    }
    return doFiltro;
  }, [eu.unidades, eu.unidadesSoConsulta, unidade.id, lista.data]);
  // o filtro só vale enquanto a unidade escolhida está na árvore: ao trocar de unidade no Topo, ele volta a "Todas" em vez de esvaziar a lista
  const filtro = unidadesDoFiltro.some((u) => u.id === lotacao) ? lotacao : '';
  const filtrados = useMemo(() => {
    const b = normalizarBusca(busca);
    // escolher um nó filtra por ele e pelas unidades de baixo
    const doNo = filtro ? abaixoDe(unidadesDoFiltro, filtro) : null;
    return (lista.data?.militares ?? []).filter(
      (m) => (!doNo || doNo.has(m.lotacaoId)) && (!b || correspondeABusca(`${m.nomeGuerra} ${m.nomeCompleto ?? ''} ${m.matricula}`, busca)),
    );
  }, [lista.data, busca, filtro, unidadesDoFiltro]);
  // com texto na busca e um resultado só, ele fica em destaque e o Enter abre a ficha (a ficha nunca abre sozinha)
  const unico = busca.trim() !== '' && filtrados.length === 1 ? filtrados[0]! : null;

  return (
    <Moldura
      titulo="Pecúlio"
      acaoPrincipal={
        <>
          <div className="flex flex-wrap gap-2">
              {/* a importação é de quem cuida do pessoal (nível acima das seções), a mesma regra do cadastro de militar novo */}
              {podeCadastrarMilitar(eu) && <ImportarPlanilha cadastro="peculio" rotulo="o Pecúlio" unidadeId={unidade.id} aoConcluir={() => atualizarPeculio(queryClient)} />}
              {podeCadastrarMilitar(eu) && (
                <Button onClick={() => setNovo(true)}>
                  <UserPlus aria-hidden />
                  Novo militar
                </Button>
              )}
              {novo && <NovoMilitar eu={eu} aoFechar={() => setNovo(false)} />}
            </div>
        </>
      }
    >

      {lista.isPending && <Espera />}
      {lista.error && <p role="alert" className="text-alerta">{mensagemDe(lista.error)}</p>}
      {lista.data && (
        <div className={cn('mt-6 grid items-start gap-6', lista.data.aniversariantes && 'lg:grid-cols-[1fr_20rem]')}>
          <div className="rounded-xl border border-linha bg-superficie">
            <div className="grid gap-2 border-b border-linha p-3 sm:grid-cols-[1fr_14rem]">
              <div className="grid gap-1">
                <Label htmlFor="busca-peculio" className="sr-only">Buscar por nome ou matrícula</Label>
                <Input
                  id="busca-peculio"
                  placeholder="Buscar por nome ou matrícula"
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setLimite(100); }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !unico) return;
                    e.preventDefault();
                    void navigate({ to: '/militares/$id', params: { id: unico.militarId }, search: { de: 'peculio' } });
                  }}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="filtro-lotacao" className="text-xs text-apagado">Lotação</Label>
                <EscolherUnidade id="filtro-lotacao" rotulo="Lotação" unidades={unidadesDoFiltro} valor={filtro} aoEscolher={(id) => { setLotacao(id); setLimite(100); }} permiteLimpar textoVazio="Todas" />
              </div>
            </div>
            <p className="px-4 pt-3 text-apoio text-apagado">{filtrados.length > limite ? `Mostrando ${limite} de ${filtrados.length}` : `${filtrados.length} de ${lista.data.militares.length}`} militares</p>
            <ul aria-label="Militares do Pecúlio" className="p-2">
              {filtrados.slice(0, limite).map((m) => <ItemDoPeculioNaLista key={m.militarId} m={m} destaque={m.militarId === unico?.militarId} />)}
              {lista.data.militares.length === 0 && <li className="p-3 text-apagado">Nenhum militar lotado. Cadastre com "Novo militar" ou use "Importar".</li>}
            </ul>
            {filtrados.length > limite && (
              <div className="px-4 pb-3"><Button type="button" variant="secundario" onClick={() => setLimite((n) => n + 100)}>Mostrar mais</Button></div>
            )}
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
    </Moldura>
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
          <span className="font-cond text-apoio text-apagado">{m.posto}</span>
          <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
          {m.pendencias.length > 0 && <TriangleAlert className="size-4 text-pendencia" role="img" aria-label={`Cadastro incompleto: ${m.pendencias.join('; ')}`} />}
          <span className="ml-auto rounded-md border border-linha px-2 font-cond text-apoio font-medium">{m.lotacao}</span>
        </span>
        {m.nomeCompleto && <span className="text-corpo leading-[22px] text-tinta">{m.nomeCompleto}</span>}
        <span className="mt-1 flex flex-wrap gap-1.5">
          <EtiquetaDeDado icone={IdCard}>{m.matricula}</EtiquetaDeDado>
          {m.telefone ? <EtiquetaDeDado icone={Phone}>{m.telefone}</EtiquetaDeDado> : <EtiquetaDeDado icone={Phone} falta>Sem telefone</EtiquetaDeDado>}
          {m.email ? <EtiquetaDeDado icone={Mail}>{m.email}</EtiquetaDeDado> : <EtiquetaDeDado icone={Mail} falta>Sem e-mail</EtiquetaDeDado>}
          {m.lotacaoAPartirDe && <EtiquetaDeDado icone={CalendarClock}>{`Lotação a partir de ${dataBr(m.lotacaoAPartirDe)}`}</EtiquetaDeDado>}
        </span>
      </Link>
    </li>
  );
}
