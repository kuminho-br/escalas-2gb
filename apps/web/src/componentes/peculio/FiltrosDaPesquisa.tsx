import type { FiltrosDaBusca } from 'contratos';
import { useQuery } from '@tanstack/react-query';
import { consultaFuncoesDoMilitar, consultaPostos, consultaQuadros, consultaSituacoesDoMilitar } from '@/api/militares';
import { Selecao } from '@/componentes/Selecao';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

/** Os filtros de "Mais filtros" (6.51), como a tela os guarda; `''` é "indiferente". */
export type Extras = {
  postoGradId: string;
  quadroId: string;
  jornada: '' | 'pronto' | 'adm';
  equipe: string;
  situacaoId: string;
  funcaoId: string;
  voluntarioJes: '' | 'sim' | 'nao';
  motorista: '' | 'sim' | 'nao';
  afastadoHoje: '' | 'sim' | 'nao';
  cadastroIncompleto: '' | 'sim' | 'nao';
  cnh: string[];
};
export const EXTRAS_VAZIOS: Extras = { postoGradId: '', quadroId: '', jornada: '', equipe: '', situacaoId: '', funcaoId: '', voluntarioJes: '', motorista: '', afastadoHoje: '', cadastroIncompleto: '', cnh: [] };

/** Quantos filtros de "Mais filtros" a pessoa preencheu (o número vai no botão). */
export function contarExtras(e: Extras): number {
  return [e.postoGradId, e.quadroId, e.jornada, e.equipe.trim(), e.situacaoId, e.funcaoId, e.voluntarioJes, e.motorista, e.afastadoHoje, e.cadastroIncompleto].filter(Boolean).length + (e.cnh.length > 0 ? 1 : 0);
}

const simNao = (v: '' | 'sim' | 'nao') => (v === '' ? undefined : v === 'sim');

/** Os filtros preenchidos, no formato da busca (o que ficou indiferente nem vai). */
export function extrasParaFiltros(e: Extras): Partial<FiltrosDaBusca> {
  const f: Partial<FiltrosDaBusca> = {};
  if (e.postoGradId) f.postoGradIds = [e.postoGradId];
  if (e.quadroId) f.quadroIds = [e.quadroId];
  if (e.jornada) f.jornada = e.jornada;
  if (e.equipe.trim()) f.equipe = e.equipe.trim();
  if (e.situacaoId) f.situacaoIds = [e.situacaoId];
  if (e.funcaoId) f.funcaoIds = [e.funcaoId];
  for (const k of ['voluntarioJes', 'motorista', 'afastadoHoje', 'cadastroIncompleto'] as const) {
    const v = simNao(e[k]);
    if (v !== undefined) f[k] = v;
  }
  if (e.cnh.length > 0) f.cnh = e.cnh as FiltrosDaBusca['cnh'];
  return f;
}

function SimNao({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: '' | 'sim' | 'nao'; aoMudar: (v: '' | 'sim' | 'nao') => void }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Selecao id={id} value={valor} onChange={(e) => aoMudar(e.target.value as '' | 'sim' | 'nao')}>
        <option value="">Tanto faz</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </Selecao>
    </div>
  );
}

/** O painel "Mais filtros": só para quem tem nível de acesso. Os catálogos vêm da API e cada filtro escolhe um item (ou "Tanto faz"). */
export function FiltrosDaPesquisa({ valor, aoMudar }: { valor: Extras; aoMudar: (e: Extras) => void }) {
  const postos = useQuery(consultaPostos);
  const quadros = useQuery(consultaQuadros);
  const situacoes = useQuery(consultaSituacoesDoMilitar);
  const funcoes = useQuery(consultaFuncoesDoMilitar);
  const mudar = (parte: Partial<Extras>) => aoMudar({ ...valor, ...parte });
  return (
    <div className="grid gap-3 rounded-xl border border-linha bg-superficie p-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="grid gap-1.5">
        <Label htmlFor="f-posto">Posto ou graduação</Label>
        <Selecao id="f-posto" value={valor.postoGradId} onChange={(e) => mudar({ postoGradId: e.target.value })}>
          <option value="">Todos</option>
          {(postos.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
        </Selecao>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-quadro">Quadro</Label>
        <Selecao id="f-quadro" value={valor.quadroId} onChange={(e) => mudar({ quadroId: e.target.value })}>
          <option value="">Todos</option>
          {(quadros.data ?? []).map((q) => <option key={q.id} value={q.id}>{q.sigla}</option>)}
        </Selecao>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-jornada">Jornada</Label>
        <Selecao id="f-jornada" value={valor.jornada} onChange={(e) => mudar({ jornada: e.target.value as Extras['jornada'] })}>
          <option value="">Todas</option>
          <option value="pronto">Pronto</option>
          <option value="adm">ADM</option>
        </Selecao>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-equipe">Equipe</Label>
        <Input id="f-equipe" value={valor.equipe} onChange={(e) => mudar({ equipe: e.target.value })} placeholder="Ex.: Alfa" maxLength={40} autoComplete="off" className="bg-superficie" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-situacao">Situação do militar</Label>
        <Selecao id="f-situacao" value={valor.situacaoId} onChange={(e) => mudar({ situacaoId: e.target.value })}>
          <option value="">Todas</option>
          {(situacoes.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </Selecao>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-funcao">Função</Label>
        <Selecao id="f-funcao" value={valor.funcaoId} onChange={(e) => mudar({ funcaoId: e.target.value })}>
          <option value="">Todas</option>
          {(funcoes.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </Selecao>
      </div>
      <SimNao id="f-jes" rotulo="Voluntário JES" valor={valor.voluntarioJes} aoMudar={(v) => mudar({ voluntarioJes: v })} />
      <SimNao id="f-motorista" rotulo="No quadro de motoristas" valor={valor.motorista} aoMudar={(v) => mudar({ motorista: v })} />
      <fieldset className="grid gap-1.5">
        <legend className="text-corpo font-medium">Categoria de CNH</legend>
        <div className="flex flex-wrap gap-3 pt-1">
          {['A', 'B', 'C', 'D', 'E'].map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-corpo">
              <Checkbox aria-label={`CNH ${c}`} checked={valor.cnh.includes(c)} onChange={(e) => mudar({ cnh: e.target.checked ? [...valor.cnh, c].sort() : valor.cnh.filter((x) => x !== c) })} />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <SimNao id="f-afastado" rotulo="Afastado hoje" valor={valor.afastadoHoje} aoMudar={(v) => mudar({ afastadoHoje: v })} />
      <SimNao id="f-incompleto" rotulo="Cadastro incompleto" valor={valor.cadastroIncompleto} aoMudar={(v) => mudar({ cadastroIncompleto: v })} />
    </div>
  );
}
