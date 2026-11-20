import { textoFaixa, type FaltaNoEfetivo, type GuarnicaoNoEfetivo } from 'contratos';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';
import { LinhaDoTempoDaGuarnicao, type AcoesDaLinha } from './LinhaDoTempoDaGuarnicao';
import type { Janela } from './ReguaDoEfetivo';

const fraseDaFalta = (f: FaltaNoEfetivo) => `${f.faltam === 1 ? 'Falta 1' : `Faltam ${f.faltam}`} ${f.funcao} ${textoFaixa(f.inicio, f.fim)}`;

/**
 * Uma guarnição do dia. O número só existe na meta (a ordem de ativação), e o estado nunca muda a posição: não ativada continua onde está.
 * As funções aparecem ao longo do dia, com as vagas na própria linha; as faltas também vêm escritas, embaixo.
 */
/** Os controles da meta no card da meta: mudam a meta deste dia (Subir e Descer só quando há para onde ir). */
export type ControlesDaMeta = { aoSubir?: () => void; aoDescer?: () => void; aoDesativar: () => void; salvando: boolean };

export function CardDoEfetivo({ g, janela, acoes, meta }: { g: GuarnicaoNoEfetivo; janela: Janela | null; acoes?: AcoesDaLinha; meta?: ControlesDaMeta }) {
  const nome = g.ordem === null ? g.nome : `${g.ordem}º ${g.nome}`;
  return (
    <section aria-label={nome} className="grid content-start gap-2 rounded-lg border border-linha bg-superficie p-3">
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-cond text-lg leading-tight font-semibold">{nome}</h2>
        {g.viatura && <span className="text-sm text-apagado">{g.viatura}</span>}
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', g.ativada ? 'bg-black/[0.06] text-tinta' : 'bg-pendencia-fundo text-pendencia')}>
          {g.ativada ? 'ativada' : 'não ativada'}
        </span>
        {meta && (
          <span className="ml-auto flex flex-wrap gap-1">
            {meta.aoSubir && (
              <Button type="button" variant="ghost" size="sm" aria-label={`Subir ${g.nome}`} disabled={meta.salvando} onClick={meta.aoSubir}>
                <ArrowUp aria-hidden />
              </Button>
            )}
            {meta.aoDescer && (
              <Button type="button" variant="ghost" size="sm" aria-label={`Descer ${g.nome}`} disabled={meta.salvando} onClick={meta.aoDescer}>
                <ArrowDown aria-hidden />
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" disabled={meta.salvando} onClick={meta.aoDesativar}>Desativar guarnição</Button>
          </span>
        )}
      </header>
      {g.horarios.length === 0 && <p className="text-sm text-apagado">Sem horário vinculado neste dia</p>}
      {janela && <LinhaDoTempoDaGuarnicao g={g} janela={janela} acoes={acoes} />}
      {g.faltas.map((f) => (
        <p key={`${f.funcao}|${f.inicio}|${f.fim}`} className="flex flex-wrap items-center gap-x-3 text-sm font-medium text-pendencia">
          <span>{fraseDaFalta(f)}</span>
        </p>
      ))}
    </section>
  );
}
