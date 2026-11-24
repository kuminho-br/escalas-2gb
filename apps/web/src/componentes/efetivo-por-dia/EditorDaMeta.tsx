import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';

export type ModeloDaMeta = { id: string; nome: string; ativa: boolean };

/**
 * Os modelos de guarnição que se podem pôr na meta: os ativos da seção e, se já estão na meta, os que foram desativados depois
 * (para poderem sair dela).
 */
export function useModelosDaMeta(unidadeId: string, mes: string, atuais: { guarnicaoId: string; nome: string }[]) {
  const modelos = useQuery(consultaGuarnicoes(unidadeId, mes));
  const jaNaMeta = new Set(atuais.map((g) => g.guarnicaoId));
  const opcoes: ModeloDaMeta[] = [
    ...(modelos.data ?? []).filter((m) => m.ativa || jaNaMeta.has(m.id)).map((m) => ({ id: m.id, nome: m.nome, ativa: m.ativa })),
    ...atuais.filter((g) => !modelos.data?.some((m) => m.id === g.guarnicaoId)).map((g) => ({ id: g.guarnicaoId, nome: g.nome, ativa: true })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { modelos, opcoes };
}

/**
 * Marcar os modelos que entram na meta e pôr na ordem de ativação (Subir e Descer). A ordem marcada é a ordem da lista: o que se
 * marca vai para o fim.
 */
export function EditorDaMeta({ opcoes, escolhidos, aoMudar, semNenhum }: { opcoes: ModeloDaMeta[]; escolhidos: string[]; aoMudar: (ids: string[]) => void; semNenhum: string }) {
  const nomeDe = (id: string) => opcoes.find((o) => o.id === id)?.nome ?? '';
  const alternar = (id: string) => aoMudar(escolhidos.includes(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id]);
  const mover = (i: number, passo: -1 | 1) => {
    const novo = [...escolhidos];
    [novo[i], novo[i + passo]] = [novo[i + passo]!, novo[i]!];
    aoMudar(novo);
  };
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        {opcoes.length === 0 && <p className="text-sm text-apagado">Nenhum modelo de guarnição ativo. Cadastre na aba "Modelos de guarnição".</p>}
        {opcoes.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={escolhidos.includes(o.id)} onChange={() => alternar(o.id)} />
            <span>{o.nome}</span>
            {!o.ativa && <span className="text-xs text-apagado">desativado</span>}
          </label>
        ))}
      </div>
      {escolhidos.length > 0 ? (
        <ol aria-label="Ordem de ativação" className="grid gap-1 rounded-lg border border-linha p-2">
          {escolhidos.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-6 text-center font-cond text-lg font-semibold">{i + 1}º</span>
              <span className="flex-1">{nomeDe(id)}</span>
              <Button type="button" variant="secundario" size="sm" aria-label={`Subir ${nomeDe(id)}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUp aria-hidden /> Subir
              </Button>
              <Button type="button" variant="secundario" size="sm" aria-label={`Descer ${nomeDe(id)}`} disabled={i === escolhidos.length - 1} onClick={() => mover(i, 1)}>
                <ArrowDown aria-hidden /> Descer
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-apagado">{semNenhum}</p>
      )}
    </div>
  );
}
