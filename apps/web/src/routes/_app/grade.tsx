import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { GrupoDaGrade } from 'contratos';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { ehMilitarComum } from '@/api/eu';
import { consultaGrade } from '@/api/grade';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { LegendaDaGrade } from '@/componentes/grade/LegendaDaGrade';
import { FichaNaGrade } from '@/componentes/grade/FichaNaGrade';
import { PainelDoDia } from '@/componentes/grade/PainelDoDia';
import { TabelaDaGrade, maximosDaGrade, nomeDoGrupo } from '@/componentes/grade/TabelaDaGrade';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { buscaDaGrade } from '@/lib/busca-da-grade';
import { useEhCelular } from '@/lib/useEhCelular';
import { mesAtual } from '@/lib/meses';
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
  // as equipes recolhidas valem enquanto a pessoa está na tela (inclusive ao trocar de mês); com busca, tudo o que achou aparece aberto
  const [recolhidas, setRecolhidas] = useState<Set<string>>(() => new Set());
  const alternarRecolhida = (chave: string) =>
    setRecolhidas((antes) => {
      const novo = new Set(antes);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  const escolhida = busca.militar && busca.dia ? { militarId: busca.militar, dia: busca.dia } : null;
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
    document.querySelector<HTMLElement>(`tr[data-militar="${militarEscolhido}"] [data-data="${diaEscolhido}"]`)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [militarEscolhido, diaEscolhido, gradeCarregada]);

  return (
    <Moldura titulo="Grade geral">
      <div className="flex flex-wrap items-end gap-3">
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
      </div>

      {comum && <p className="text-apagado">A grade geral é dos auxiliares administrativos e gestores.</p>}
      {!comum && dados.isPending && <Espera />}
      {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
      {grade && grade.grupos.length === 0 && <p className="text-apagado">Ninguém para mostrar neste mês.</p>}
      {grade && grade.grupos.length > 0 && grupos.length === 0 && <p className="text-apagado">Ninguém com esse nome nas equipes escolhidas.</p>}
      {grade && grupos.length > 0 && (
        <div className={cn('grid items-start gap-4', escolhida && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
          {/* no celular o painel do dia cobre a tela: a grade atrás fica inerte (nem o leitor de tela nem o teclado chegam nela) */}
          <div data-grade inert={celular && !!escolhida} className="min-w-0 overflow-hidden rounded-xl border border-linha bg-superficie">
            <TabelaDaGrade
              grade={grade}
              grupos={grupos}
              maximos={maximosDaGrade(grade.grupos)}
              escolhida={escolhida}
              aoEscolher={(militar, dia) => void navigate({ search: (s) => ({ ...s, militar, dia }) })}
              aoAbrirFicha={eu.soConsulta ? undefined : (militar) => void navigate({ search: (s) => ({ ...s, ficha: militar }) })}
              recolhidas={procura ? new Set() : recolhidas}
              aoAlternar={alternarRecolhida}
            />
            <LegendaDaGrade grupos={grupos} />
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
