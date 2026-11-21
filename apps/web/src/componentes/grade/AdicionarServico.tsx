import { textoFaixa, type OpcaoDeServico } from 'contratos';
import { useState } from 'react';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';

/** Um turno de uma escala: as vagas em que o militar pode entrar nele, na ordem em que a API as manda ("Sem guarnição" por último). */
type Turno = { chave: string; faixa: string; vagas: OpcaoDeServico[] };
type GrupoDaEscala = { escalaId: string; escala: string; turnos: Turno[] };

/** Agrupa as opções por escala e, dentro dela, por turno (a faixa de horário). */
function agrupar(opcoes: OpcaoDeServico[]): GrupoDaEscala[] {
  const grupos: GrupoDaEscala[] = [];
  for (const o of opcoes) {
    let grupo = grupos.find((g) => g.escalaId === o.escalaId);
    if (!grupo) grupos.push((grupo = { escalaId: o.escalaId, escala: o.escala, turnos: [] }));
    const chave = `${o.escalaId}|${o.inicio}|${o.fim}`;
    let turno = grupo.turnos.find((t) => t.chave === chave);
    if (!turno) grupo.turnos.push((turno = { chave, faixa: textoFaixa(o.inicio, o.fim), vagas: [] }));
    turno.vagas.push(o);
  }
  // "Sem guarnição" fica por último em cada turno (a ordem do resto é a da API)
  for (const g of grupos) for (const t of g.turnos) t.vagas.sort((a, b) => Number(a.guarnicaoId === null) - Number(b.guarnicaoId === null));
  return grupos;
}

const quantosTurnos = (opcoes: OpcaoDeServico[]) => new Set(opcoes.map((o) => `${o.escalaId}|${o.inicio}|${o.fim}`)).size;

/** O texto da vaga na lista: "Guarnição · Função" quando o turno tem mais de uma guarnição, só a função quando tem uma só. */
function textoDaVaga(o: OpcaoDeServico, maisDeUmaGuarnicao: boolean): string {
  if (!o.guarnicaoId) return 'Sem guarnição';
  return maisDeUmaGuarnicao ? `${o.guarnicao} · ${o.funcao}` : (o.funcao ?? o.guarnicao ?? '');
}

/**
 * Um turno: a vaga numa lista, o serviço (quando a vaga aceita mais de um) e o botão "Escalar". A primeira vaga e o primeiro serviço vêm
 * marcados; ao trocar a vaga, o serviço volta ao primeiro da vaga nova. A etiqueta "não marcou" segue o serviço marcado.
 */
function LinhaDoTurno({ turno, salvando, aoEscolher }: { turno: Turno; salvando: boolean; aoEscolher: (o: OpcaoDeServico, turnoId: string) => void }) {
  const [vaga, setVaga] = useState(0);
  const [turnoEscolhido, setTurnoEscolhido] = useState<string | null>(null);
  const opcao = turno.vagas[vaga] ?? turno.vagas[0]!;
  const turnoId = opcao.servicos.some((s) => s.turnoId === turnoEscolhido) ? turnoEscolhido! : opcao.servicos[0]!.turnoId;
  const servico = opcao.servicos.find((s) => s.turnoId === turnoId) ?? opcao.servicos[0]!;
  const maisDeUmaGuarnicao = new Set(turno.vagas.flatMap((v) => (v.guarnicaoId ? [v.guarnicaoId] : []))).size > 1;
  return (
    <li aria-label={turno.faixa} className="grid gap-1.5">
      {/* o painel é estreito (380px): em cima a faixa, o serviço e o botão; a vaga, que tem o texto mais longo, ocupa a linha de baixo inteira */}
      <div className="flex items-center gap-2">
        <span className="font-cond text-sm font-semibold">{turno.faixa}</span>
        {opcao.servicos.length > 1 && (
          <Selecao aria-label={`Serviço de ${turno.faixa}`} value={turnoId} onChange={(e) => setTurnoEscolhido(e.target.value)} className="w-28 shrink-0">
            {opcao.servicos.map((s) => <option key={s.turnoId} value={s.turnoId}>{s.nome}</option>)}
          </Selecao>
        )}
        {servico.semVoluntariado && <span className="text-xs text-pendencia">não marcou</span>}
        <Button type="button" size="sm" className="ml-auto" aria-label={`Escalar às ${turno.faixa}`} disabled={salvando} onClick={() => aoEscolher(opcao, turnoId)}>Escalar</Button>
      </div>
      <Selecao
        aria-label={`Vaga de ${turno.faixa}`}
        value={String(vaga)}
        onChange={(e) => {
          setVaga(Number(e.target.value));
          setTurnoEscolhido(null);
        }}
        className="w-full"
      >
        {turno.vagas.map((v, i) => <option key={`${v.guarnicaoId ?? ''}|${v.funcaoId ?? ''}`} value={i}>{textoDaVaga(v, maisDeUmaGuarnicao)}</option>)}
      </Selecao>
    </li>
  );
}

function Grupos({ opcoes, salvando, aoEscolher }: { opcoes: OpcaoDeServico[]; salvando: boolean; aoEscolher: (o: OpcaoDeServico, turnoId: string) => void }) {
  return (
    <div className="grid gap-3">
      {agrupar(opcoes).map((g) => (
        <section key={g.escalaId} className="grid gap-1.5">
          <h3 className="font-cond text-sm font-semibold text-apagado">{g.escala}</h3>
          <ul className="grid gap-2">
            {g.turnos.map((t) => <LinhaDoTurno key={t.chave} turno={t} salvando={salvando} aoEscolher={aoEscolher} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * "Adicionar serviço neste dia": só onde o militar pode entrar, em duas abas, Ordinário (os serviços fixos) e Operações (o resto), cada uma
 * com o número de turnos que têm opção. Dentro da aba, um grupo por escala e uma linha por turno; quem só não marcou o horário no
 * voluntariado aparece com a etiqueta "não marcou" e pode ser escalado mesmo assim. A aba que abre é a primeira que tiver opções.
 */
export function AdicionarServico({ opcoes, salvando, aoEscolher }: { opcoes: OpcaoDeServico[]; salvando: boolean; aoEscolher: (o: OpcaoDeServico, turnoId: string) => void }) {
  const [escolhida, setEscolhida] = useState<'ordinario' | 'operacoes'>('ordinario');
  if (!opcoes.length) return <p className="text-sm text-apagado">Nenhum serviço disponível para ele neste dia.</p>;
  const ordinario = opcoes.filter((o) => o.ordinario);
  const operacoes = opcoes.filter((o) => !o.ordinario);
  // a aba aberta que fica sem opções (as opções são buscadas de novo depois de uma recusa) passa para a outra, que tem
  const aba = escolhida === 'ordinario' ? (ordinario.length ? 'ordinario' : 'operacoes') : operacoes.length ? 'operacoes' : 'ordinario';
  return (
    <Tabs value={aba} onValueChange={(v) => setEscolhida(v === 'operacoes' ? 'operacoes' : 'ordinario')}>
      {/* as abas dividem a largura do painel; cada aba abre o seu painel, separado e com borda */}
      <TabsList className="w-full">
        <TabsTrigger value="ordinario" className="flex-1" disabled={!ordinario.length}>Ordinário ({quantosTurnos(ordinario)})</TabsTrigger>
        <TabsTrigger value="operacoes" className="flex-1" disabled={!operacoes.length}>Operações ({quantosTurnos(operacoes)})</TabsTrigger>
      </TabsList>
      <TabsContent value="ordinario" className="rounded-lg border border-linha p-2.5"><Grupos opcoes={ordinario} salvando={salvando} aoEscolher={aoEscolher} /></TabsContent>
      <TabsContent value="operacoes" className="rounded-lg border border-linha p-2.5"><Grupos opcoes={operacoes} salvando={salvando} aoEscolher={aoEscolher} /></TabsContent>
    </Tabs>
  );
}
