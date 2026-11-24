import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { ehMilitarComum } from '@/api/eu';
import { consultaGrade } from '@/api/grade';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { LegendaDaGrade } from '@/componentes/grade/LegendaDaGrade';
import { PainelDoDia } from '@/componentes/grade/PainelDoDia';
import { TabelaDaGrade, maximosDaGrade } from '@/componentes/grade/TabelaDaGrade';
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
        {grade && grade.grupos.length > 1 && (
          <div role="group" aria-label="Equipes" className="flex flex-wrap items-center gap-1.5">
            {[{ chave: undefined, nome: 'Todas' }, ...grade.grupos].map((g) => {
              const ligado = g.chave === undefined ? equipes.length === 0 : equipes.includes(g.chave);
              return (
                <button
                  key={g.chave ?? 'todas'}
                  type="button"
                  aria-pressed={ligado}
                  onClick={() => alternar(g.chave)}
                  className={cn('h-9 rounded-md border px-3 text-sm', ligado ? 'border-tinta bg-tinta text-white' : 'border-linha bg-superficie hover:bg-accent')}
                >
                  {g.nome}
                </button>
              );
            })}
          </div>
        )}
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
    </Moldura>
  );
}
