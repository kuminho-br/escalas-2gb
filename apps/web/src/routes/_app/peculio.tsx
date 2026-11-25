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
import { Checkbox } from '@/componentes/ui/checkbox';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { abaixoDe, type UnidadeDaArvore } from '@/lib/arvore-de-unidades';
import { dataBr, mesAtual } from '@/lib/meses';
import { correspondeABusca, normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { classeItemEscolhido } from '@/componentes/ListaDetalhe';
import { Moldura } from '@/componentes/Moldura';
import { classeDaLinhaDeMilitar, ListaDeMilitares } from '@/componentes/peculio/ListaDeMilitares';
import { Espera } from '@/componentes/resposta/Espera';

export const Route = createFileRoute('/_app/peculio')({
  component: Peculio,
});

const CHAVE_DAS_DE_BAIXO = 'peculio:incluir-as-de-baixo';

/** "Incluir as unidades de baixo" começa ligado; a última escolha da pessoa fica lembrada no navegador (sem armazenamento, liga). */
function lembradoIncluirAsDeBaixo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_DAS_DE_BAIXO) !== 'nao';
  } catch {
    return true;
  }
}

/**
 * O Pecúlio da unidade (parte do Pecúlio Geral): os militares da unidade do usuário e, se ele quiser, das de baixo (o 2º GB para quem cuida do pessoal),
 * com a busca e o filtro por lotação. Os aniversários têm tela própria. Clicar num militar abre a ficha dele (cada bloco é editado pelo seu dono).
 */
function Peculio() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const unidade = unidadeDoPeculio(eu);
  const mes = mesAtual();
  const [incluirAsDeBaixo, setIncluirAsDeBaixo] = useState(lembradoIncluirAsDeBaixo);
  const lista = useQuery(consultaPeculio(unidade.id, mes, incluirAsDeBaixo));
  const mudarIncluirAsDeBaixo = (ligado: boolean) => {
    setIncluirAsDeBaixo(ligado);
    setLimite(100);
    try {
      window.localStorage.setItem(CHAVE_DAS_DE_BAIXO, ligado ? 'sim' : 'nao');
    } catch {
      /* sem armazenamento: a escolha vale só até sair da tela */
    }
  };
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
      titulo="Pecúlio da unidade"
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
        <div className="mt-6 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
            <div className="grid gap-1">
              <Label htmlFor="busca-peculio" className="sr-only">Buscar por nome ou matrícula</Label>
              <Input
                id="busca-peculio"
                placeholder="Buscar por nome ou matrícula"
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setLimite(100); }}
                className="bg-superficie"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !unico) return;
                  e.preventDefault();
                  void navigate({ to: '/peculio/militar/$id', params: { id: unico.militarId }, search: {} });
                }}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="filtro-lotacao" className="text-xs text-apagado">Lotação</Label>
              <EscolherUnidade id="filtro-lotacao" rotulo="Lotação" unidades={unidadesDoFiltro} valor={filtro} aoEscolher={(id) => { setLotacao(id); setLimite(100); }} permiteLimpar textoVazio="Todas" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-apoio text-apagado">{filtrados.length > limite ? `Mostrando ${limite} de ${filtrados.length}` : `${filtrados.length} de ${lista.data.militares.length}`} militares</p>
            {/* ligado: a unidade e as de baixo; desligado: só quem está lotado direto nela (a lembrança fica no navegador) */}
            <div className="flex items-center gap-2">
              <Checkbox id="incluir-as-de-baixo" checked={incluirAsDeBaixo} onChange={(e) => mudarIncluirAsDeBaixo(e.target.checked)} />
              <Label htmlFor="incluir-as-de-baixo">Incluir as unidades de baixo</Label>
            </div>
          </div>
          <ListaDeMilitares rotulo="Militares do Pecúlio">
            {filtrados.slice(0, limite).map((m) => <ItemDoPeculioNaLista key={m.militarId} m={m} destaque={m.militarId === unico?.militarId} />)}
            {lista.data.militares.length === 0 && (
              <li className="p-4 text-apagado">
                {incluirAsDeBaixo
                  ? 'Nenhum militar lotado. Cadastre com "Novo militar" ou use "Importar".'
                  : `Nenhum militar lotado direto em ${unidade.sigla}. Ligue "Incluir as unidades de baixo".`}
              </li>
            )}
          </ListaDeMilitares>
          {filtrados.length > limite && (
            <div><Button type="button" variant="secundario" onClick={() => setLimite((n) => n + 100)}>Mostrar mais</Button></div>
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
        to="/peculio/militar/$id"
        params={{ id: m.militarId }}
        search={{}}
        aria-current={destaque ? 'true' : undefined}
        className={cn(classeDaLinhaDeMilitar, destaque && classeItemEscolhido)}
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
