import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { GrupoDaGrade } from 'contratos';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { ehMilitarComum } from '@/api/eu';
import { consultaGrade } from '@/api/grade';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { LegendaDaGrade } from '@/componentes/grade/LegendaDaGrade';
import { FichaNaGrade } from '@/componentes/grade/FichaNaGrade';
import { PainelDoDia } from '@/componentes/grade/PainelDoDia';
import { TabelaDaGrade, maximosDaGrade, nomeDoGrupo } from '@/componentes/grade/TabelaDaGrade';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { afastadoNoMesTodo } from '@/lib/afastamento-na-grade';
import { buscaDaGrade } from '@/lib/busca-da-grade';
import { useEhCelular } from '@/lib/useEhCelular';
import { somarMeses } from 'contratos';
import { mesAtual, mesCurto } from '@/lib/meses';
import { normalizarBusca } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';

export const Route = createFileRoute('/_app/grade')({
  validateSearch: buscaDaGrade,
  component: GradeGeral,
});

/** A Grade geral: todo o efetivo da seção no mês, em equipes. Clicar numa célula (militar e dia) escolhe o dia dele. */
function GradeGeral() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? mesAtual();
  // o militar comum não vê a grade (é dos auxiliares administrativos e gestores): sem consulta e sem alerta. Quem a vê só para consulta (as camadas de visão) a abre
  const comum = ehMilitarComum(eu) && !eu.soConsulta;
  const dados = useQuery({ ...consultaGrade(eu.unidade.id, mes), enabled: !comum });
  const celular = useEhCelular();
  const grade = dados.data;
  // as equipes que não existem neste mês (não têm ninguém nele) são descartadas; sem nenhuma válida vale "Todas": nunca deixa a grade em branco
  const equipes = grade ? (busca.equipes ?? []).filter((c) => grade.grupos.some((g) => g.chave === c)) : [];
  const [texto, setTexto] = useState(busca.busca ?? '');
  const procura = normalizarBusca(texto);
  // só dígitos, ponto, hífen e espaço valem como matrícula: ela é comparada só pelos dígitos ("9900011" e "990001-1" acham o mesmo militar)
  const digitosDaBusca = /^[\d.\-\s]+$/.test(procura) ? procura.replace(/\D/g, '') : '';
  const porEquipe = grade ? (equipes.length ? grade.grupos.filter((g) => equipes.includes(g.chave)) : grade.grupos) : [];
  // a busca olha o nome de guerra e a matrícula, sem acento e sem maiúscula; o grupo que fica sem ninguém some
  const grupos = procura
    ? porEquipe
        .map((g) => ({ ...g, linhas: g.linhas.filter((l) => normalizarBusca(l.nomeGuerra).includes(procura) || (digitosDaBusca !== '' && l.matricula.replace(/\D/g, '').includes(digitosDaBusca))) }))
        .filter((g) => g.linhas.length > 0)
    : porEquipe;
  // o filtro dos afastados (6.70): tira só quem está afastado em todos os dias do mês mostrado; o grupo que fica sem ninguém some, e a contagem da faixa acompanha
  const esconderAfastados = busca.esconderAfastados === true;
  const semOsAfastados = esconderAfastados && grade
    ? grupos
        .map((g) => ({ ...g, linhas: g.linhas.filter((l) => !afastadoNoMesTodo(l.afastamentos, grade.dias.map((x) => x.data))) }))
        .filter((g) => g.linhas.length > 0)
    : grupos;
  // as equipes recolhidas valem enquanto a pessoa está na tela (inclusive ao trocar de mês); com busca, tudo o que achou aparece aberto
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());
  const alternarRecolhida = (chave: string) =>
    setRecolhidas((antes) => {
      const novo = new Set(antes);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  const escolhida = busca.militar && busca.dia ? { militarId: busca.militar, dia: busca.dia } : null;
  // a tela cheia (6.70): a casca tira o menu e o cabeçalho; aqui saem o título e os filtros e fica a barra fina
  const cheia = busca.cheia === true;
  const alternarCheia = () => void navigate({ search: (s) => ({ ...s, cheia: cheia ? undefined : true }) });
  const painelAberto = escolhida !== null;
  // Esc recolhe a tela cheia; com o painel do dia aberto (ou uma janela por cima) o Esc é dele
  useEffect(() => {
    if (!cheia) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || painelAberto || document.querySelector('[role="dialog"]')) return;
      void navigate({ search: (s) => ({ ...s, cheia: undefined }) });
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [cheia, painelAberto, navigate]);
  /** Liga ou desliga uma equipe; sem nenhuma ligada, ou com todas, a seleção some ("Todas"). */
  function alternar(chave: string | undefined) {
    if (!grade) return;
    const ligadas = new Set(equipes);
    if (chave !== undefined) (ligadas.has(chave) ? ligadas.delete(chave) : ligadas.add(chave));
    const nova = chave === undefined ? [] : grade.grupos.filter((g) => ligadas.has(g.chave)).map((g) => g.chave);
    void navigate({ search: (s) => ({ ...s, equipes: nova.length === 0 || nova.length === grade.grupos.length ? undefined : nova }) });
  }
  function buscar(valor: string) {
    setTexto(valor);
    void navigate({ search: (s) => ({ ...s, busca: valor.trim() ? valor : undefined }), replace: true });
  }
  // ao escolher uma célula, a grade rola só o necessário para ela continuar à vista ao lado do painel
  const militarEscolhido = escolhida?.militarId;
  const diaEscolhido = escolhida?.dia;
  const gradeCarregada = !!grade;
  useEffect(() => {
    if (!militarEscolhido || !diaEscolhido || !gradeCarregada) return;
    const celula = document.querySelector<HTMLElement>(`tr[data-militar="${militarEscolhido}"] [data-data="${diaEscolhido}"]`);
    // no celular o painel é uma folha que cobre quase dois terços da tela (6.70): a tabela sobe para o alto da tela e a linha escolhida rola para logo abaixo do cabeçalho dos dias
    const caixa = celula?.closest<HTMLElement>('[data-rolagem]');
    const linha = celula?.closest('tr');
    if (celular && caixa && linha) {
      document.querySelector<HTMLElement>('[data-grade]')?.scrollIntoView?.({ block: 'start' });
      const cabecalho = caixa.querySelector('thead')?.getBoundingClientRect().height ?? 0;
      caixa.scrollTo?.({ top: caixa.scrollTop + linha.getBoundingClientRect().top - caixa.getBoundingClientRect().top - cabecalho });
    }
    celula?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [militarEscolhido, diaEscolhido, gradeCarregada, celular]);

  return (
    <Moldura
      titulo="Grade geral"
      tituloOculto={cheia}
      acaoPrincipal={!cheia && grade ? <Button type="button" variant="secundario" onClick={alternarCheia}><Maximize2 aria-hidden />Expandir grade</Button> : undefined}
    >
      {cheia && (
        <section aria-label="Barra da tela cheia" className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center overflow-hidden rounded-controle border border-encaixe bg-superficie">
            <Button type="button" variant="discreto" size="icon" className="rounded-none" aria-label="Mês anterior" onClick={() => void navigate({ search: (s) => ({ ...s, mes: somarMeses(mes, -1), militar: undefined, dia: undefined }) })}>
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-24 px-2 text-center font-cond text-nome font-semibold">{mesCurto(mes)}</span>
            <Button type="button" variant="discreto" size="icon" className="rounded-none" aria-label="Próximo mês" onClick={() => void navigate({ search: (s) => ({ ...s, mes: somarMeses(mes, 1), militar: undefined, dia: undefined }) })}>
              <ChevronRight aria-hidden />
            </Button>
          </span>
          <span className="min-w-0 flex-1 truncate text-apoio font-medium text-apagado">
            {grade && equipes.length ? grade.grupos.filter((g) => equipes.includes(g.chave)).map(nomeDoGrupo).join(', ') : 'Todas as equipes'}
            {procura ? `, "${texto.trim()}"` : ''}
          </span>
          <Button type="button" variant="secundario" className="shrink-0" onClick={alternarCheia}><Minimize2 aria-hidden />Recolher grade</Button>
        </section>
      )}
      {!cheia && <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="gg-mes">Mês</Label>
          <CampoDeMes id="gg-mes" valor={mes} aoMudar={(m) => void navigate({ search: (s) => ({ ...s, mes: m, militar: undefined, dia: undefined }) })} />
        </div>
        {grade && (
          <div className="grid gap-1.5">
            <Label htmlFor="gg-busca">Buscar militar</Label>
            <Input id="gg-busca" type="search" value={texto} onChange={(e) => buscar(e.target.value)} placeholder="Nome ou matrícula" className="w-56" />
          </div>
        )}
        {grade && grade.grupos.length > 1 && <FiltroDeEquipes grupos={grade.grupos} ligadas={equipes} aoAlternar={alternar} />}
        {grade && grade.grupos.some((g) => g.linhas.some((l) => l.afastamentos.length > 0)) && (
          <label className="flex h-(--altura-controle) cursor-pointer items-center gap-2 text-corpo">
            <Checkbox checked={esconderAfastados} onChange={(e) => void navigate({ search: (s) => ({ ...s, esconderAfastados: e.target.checked ? true : undefined }) })} />
            Esconder quem está afastado o mês todo
          </label>
        )}
      </div>}

      {comum && <p className="text-apagado">A grade geral é dos auxiliares administrativos e gestores.</p>}
      {!comum && dados.isPending && <Espera />}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {grade && grade.grupos.length === 0 && <p className="text-apagado">Ninguém para mostrar neste mês.</p>}
      {grade && grade.grupos.length > 0 && grupos.length === 0 && <p className="text-apagado">Ninguém com esse nome nas equipes escolhidas.</p>}
      {grade && grupos.length > 0 && semOsAfastados.length === 0 && <p className="text-apagado">Ninguém para mostrar: todos estão afastados o mês todo.</p>}
      {grade && semOsAfastados.length > 0 && (
        <div className={cn('grid items-start gap-4', escolhida && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
          {/* no celular o painel do dia cobre a tela: a grade atrás fica inerte (nem o leitor de tela nem o teclado chegam nela) */}
          <div data-grade inert={celular && !!escolhida} className="min-w-0 overflow-hidden rounded-xl border border-linha bg-superficie">
            {/* a legenda fica numa linha acima da tabela, onde se olha (6.70) */}
            <LegendaDaGrade grupos={semOsAfastados} />
            <TabelaDaGrade
              grade={grade}
              grupos={semOsAfastados}
              maximos={maximosDaGrade(grade.grupos)}
              escolhida={escolhida}
              aoEscolher={(militar, dia) => void navigate({ search: (s) => ({ ...s, militar, dia }) })}
              aoAbrirFicha={eu.soConsulta ? undefined : (militar) => void navigate({ search: (s) => ({ ...s, ficha: militar }) })}
              recolhidas={procura ? new Set() : recolhidas}
              aoAlternar={alternarRecolhida}
              cheia={cheia}
            />
          </div>
          {escolhida && (
            <PainelDoDia
              key={`${escolhida.militarId}|${escolhida.dia}`}
              unidadeId={eu.unidade.id}
              militarId={escolhida.militarId}
              data={escolhida.dia}
              aoFechar={() => {
                void navigate({ search: (s) => ({ ...s, militar: undefined, dia: undefined }) });
                // o foco volta à célula que abriu o painel
                setTimeout(() => document.querySelector<HTMLElement>(`tr[data-militar="${escolhida.militarId}"] [data-data="${escolhida.dia}"]`)?.focus(), 0);
              }}
            />
          )}
        </div>
      )}
      {busca.ficha && !eu.soConsulta && <FichaNaGrade militarId={busca.ficha} eu={eu} aoFechar={() => void navigate({ search: (s) => ({ ...s, ficha: undefined }) })} />}
    </Moldura>
  );
}

/**
 * O grupo de filtro das equipes (6.46; Manual, "Grupo de filtro"): o rótulo em cima e os segmentos numa caixa só. Mais de um pode ficar marcado; o
 * marcado tem fundo `tinta`, texto branco e um visto antes do nome, e não muda de largura (o lugar do visto é guardado, e no não marcado o mesmo espaço vale dos dois lados, para o nome
 * ficar no centro). "Todas" é o primeiro segmento, marcado quando nenhum outro está. Abaixo de 768 px (o corte do resto do site), três por linha, com 44 px, e a última linha estica até o fim.
 */
function FiltroDeEquipes({ grupos, ligadas, aoAlternar }: { grupos: GrupoDaGrade[]; ligadas: string[]; aoAlternar: (chave: string | undefined) => void }) {
  // com sete ou mais equipes (6.70; prepara as equipes do cadastro, 6.64) os botões não cabem lado a lado: um botão "Equipes" abre a lista de marcação
  if (grupos.length > 6) return <ListaDeEquipes grupos={grupos} ligadas={ligadas} aoAlternar={aoAlternar} />;
  const segmentos: { chave: string | undefined; nome: string }[] = [{ chave: undefined, nome: 'Todas' }, ...grupos.map((g) => ({ chave: g.chave, nome: nomeDoGrupo(g) }))];
  // no celular (três por linha, numa grade de seis colunas): o que sobra na última linha estica até o fim
  const sobra = segmentos.length % 3;
  const estica = (i: number) => (sobra === 1 && i === segmentos.length - 1 ? 'max-md:col-span-6' : sobra === 2 && i >= segmentos.length - 2 ? 'max-md:col-span-3' : '');
  return (
    <div className="grid gap-1.5 max-md:w-full">
      <span id="gg-equipe" className="text-corpo font-medium">Equipe</span>
      <div role="group" aria-labelledby="gg-equipe" className="grid grid-cols-6 gap-px overflow-hidden rounded-controle border border-encaixe bg-linha md:flex">
        {segmentos.map((s, i) => {
          const ligado = s.chave === undefined ? ligadas.length === 0 : ligadas.includes(s.chave);
          return (
            <button
              key={s.chave ?? 'todas'}
              type="button"
              aria-pressed={ligado}
              onClick={() => aoAlternar(s.chave)}
              className={cn(
                'col-span-2 inline-flex h-11 items-center justify-center gap-1.5 bg-superficie px-3 font-cond text-corpo font-semibold whitespace-nowrap uppercase transition-colors hover:bg-passa focus-visible:-outline-offset-2 aria-pressed:bg-tinta aria-pressed:text-white aria-pressed:focus-visible:outline-white md:h-(--altura-controle)',
                estica(i),
              )}
            >
              <Check aria-hidden className={cn('size-3.5 shrink-0', !ligado && 'invisible')} strokeWidth={2.5} />
              {s.nome}
              {/* no segmento não marcado o espaço do visto vale dos dois lados: o nome fica no centro */}
              {!ligado && <span aria-hidden data-espaco-do-visto className="size-3.5 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A lista de marcação das equipes (sete ou mais): o botão "Equipes" diz quantas valem; "Todas" fica marcada quando nenhuma está. */
function ListaDeEquipes({ grupos, ligadas, aoAlternar }: { grupos: GrupoDaGrade[]; ligadas: string[]; aoAlternar: (chave: string | undefined) => void }) {
  const itens: { chave: string | undefined; nome: string }[] = [{ chave: undefined, nome: 'Todas' }, ...grupos.map((g) => ({ chave: g.chave, nome: nomeDoGrupo(g) }))];
  return (
    <div className="grid gap-1.5 max-md:w-full">
      <span className="text-corpo font-medium">Equipe</span>
      <Popover.Root>
        <Popover.Trigger className="inline-flex h-11 items-center justify-between gap-2 rounded-controle border border-encaixe bg-superficie px-3 font-cond text-corpo font-semibold hover:bg-passa md:h-(--altura-controle)">
          Equipes
          {ligadas.length > 0 && <span className="rounded-full bg-tinta px-1.5 text-apoio text-white">{ligadas.length}</span>}
          <ChevronDown aria-hidden className="size-4 text-apagado" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={4} collisionPadding={16} className="z-50 max-h-72 w-64 overflow-auto rounded-lg border border-linha bg-superficie p-2 shadow-lg">
            <div role="group" aria-label="Equipes" className="grid gap-0.5">
              {itens.map((i) => {
                const marcada = i.chave === undefined ? ligadas.length === 0 : ligadas.includes(i.chave);
                return (
                  <label key={i.chave ?? 'todas'} className="flex cursor-pointer items-center gap-2 rounded-controle px-2 py-2 text-corpo hover:bg-passa">
                    <Checkbox checked={marcada} onChange={() => aoAlternar(i.chave)} aria-label={i.nome} />
                    {i.nome}
                  </label>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
