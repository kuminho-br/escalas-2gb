import { useQuery } from '@tanstack/react-query';
import type { UnidadeDaConsulta } from 'contratos';
import { X } from 'lucide-react';
import { useMemo } from 'react';
import { consultaFuncoesDoMilitar, consultaPostos, consultaQuadros, consultaSituacoesDoMilitar } from '@/api/militares';
import { Button } from '@/componentes/ui/button';
import { montarArvore, todosOsNos } from '@/lib/arvore-de-unidades';
import type { Criterios } from './EstadoDaPesquisa';
import { EXTRAS_VAZIOS, type Extras } from './FiltrosDaPesquisa';

/** Um critério em uso: `texto` e, em negrito, `destaque` (o valor). `chave` diz qual critério o x tira. */
export type Etiqueta = { chave: string; texto: string; destaque: string };

const SIM_NAO = { sim: 'Sim', nao: 'Não' } as const;
const JORNADA = { pronto: 'Pronto', adm: 'ADM' } as const;

/** A unidade pelo menor caminho que a identifica ("1ª SB" se é única; "2º GB / 1ª SB" quando a sigla se repete), como a placa da lotação. */
function rotulosDasUnidades(unidades: UnidadeDaConsulta[]): Map<string, string> {
  const nos = todosOsNos(montarArvore(unidades, unidades));
  const sufixo = (caminho: string[], n: number) => caminho.slice(-n).join(' / ');
  return new Map(
    nos.map((no) => {
      for (let n = 1; n <= no.caminho.length; n++) {
        if (nos.filter((o) => sufixo(o.caminho, n) === sufixo(no.caminho, n)).length === 1) return [no.id, sufixo(no.caminho, n)] as const;
      }
      return [no.id, no.caminho.join(' / ')] as const;
    }),
  );
}

/**
 * As etiquetas dos critérios que valem na busca: uma por critério (6.63). O padrão de onde procurar não conta; o nome completo ligado, ou a matrícula ou o nome de guerra
 * desligados, contam. Cada marca da árvore, o arquivo e cada filtro de "Outros filtros" são uma etiqueta; a CNH, uma só com as categorias.
 */
export function useEtiquetasDosCriterios(c: Criterios, unidades: UnidadeDaConsulta[]): Etiqueta[] {
  const { extras } = c;
  const postos = useQuery({ ...consultaPostos, enabled: Boolean(extras.postoGradId) });
  const quadros = useQuery({ ...consultaQuadros, enabled: Boolean(extras.quadroId) });
  const situacoes = useQuery({ ...consultaSituacoesDoMilitar, enabled: Boolean(extras.situacaoId) });
  const funcoes = useQuery({ ...consultaFuncoesDoMilitar, enabled: Boolean(extras.funcaoId) });
  const rotulos = useMemo(() => rotulosDasUnidades(unidades), [unidades]);
  const lista: Etiqueta[] = [];
  if (c.procurarEm.nomeCompleto) lista.push({ chave: 'procurar:completo', texto: 'Procura também no ', destaque: 'nome completo' });
  if (!c.procurarEm.matricula) lista.push({ chave: 'procurar:matricula', texto: 'Sem procurar na ', destaque: 'matrícula' });
  if (!c.procurarEm.nomeDeGuerra) lista.push({ chave: 'procurar:guerra', texto: 'Sem procurar no ', destaque: 'nome de guerra' });
  for (const m of c.marcas) lista.push({ chave: `marca:${m.id}`, texto: 'Lotação: ', destaque: `${rotulos.get(m.id) ?? unidades.find((u) => u.id === m.id)?.sigla ?? '?'}${m.comAsDeBaixo ? ' e as de baixo' : ''}` });
  if (c.matriculas.length > 0) lista.push({ chave: 'arquivo', texto: 'Arquivo: ', destaque: c.matriculas.length === 1 ? '1 matrícula' : `${c.matriculas.length} matrículas` });
  const nome = <T extends { id: string }>(lista: T[] | undefined, id: string, de: (x: T) => string) => { const x = lista?.find((i) => i.id === id); return x ? de(x) : '…'; };
  if (extras.postoGradId) lista.push({ chave: 'extra:postoGradId', texto: 'Posto ou graduação: ', destaque: nome(postos.data, extras.postoGradId, (p) => p.sigla) });
  if (extras.quadroId) lista.push({ chave: 'extra:quadroId', texto: 'Quadro: ', destaque: nome(quadros.data, extras.quadroId, (q) => q.sigla) });
  if (extras.jornada) lista.push({ chave: 'extra:jornada', texto: 'Jornada: ', destaque: JORNADA[extras.jornada] });
  if (extras.equipe.trim()) lista.push({ chave: 'extra:equipe', texto: 'Equipe: ', destaque: extras.equipe.trim().toUpperCase() });
  if (extras.situacaoId) lista.push({ chave: 'extra:situacaoId', texto: 'Situação do militar: ', destaque: nome(situacoes.data, extras.situacaoId, (s) => s.nome) });
  if (extras.funcaoId) lista.push({ chave: 'extra:funcaoId', texto: 'Função: ', destaque: nome(funcoes.data, extras.funcaoId, (f) => f.nome) });
  if (extras.voluntarioJes) lista.push({ chave: 'extra:voluntarioJes', texto: 'Voluntário JES: ', destaque: SIM_NAO[extras.voluntarioJes] });
  if (extras.motorista) lista.push({ chave: 'extra:motorista', texto: 'No quadro de motoristas: ', destaque: SIM_NAO[extras.motorista] });
  if (extras.cnh.length > 0) lista.push({ chave: 'extra:cnh', texto: 'CNH: ', destaque: extras.cnh.join(', ') });
  if (extras.afastadoHoje) lista.push({ chave: 'extra:afastadoHoje', texto: 'Afastado hoje: ', destaque: SIM_NAO[extras.afastadoHoje] });
  if (extras.cadastroIncompleto) lista.push({ chave: 'extra:cadastroIncompleto', texto: 'Cadastro incompleto: ', destaque: SIM_NAO[extras.cadastroIncompleto] });
  return lista;
}

/** Os critérios sem o que a etiqueta de `chave` representa (o x da etiqueta). */
export function semOCriterio(c: Criterios, chave: string): Criterios {
  if (chave === 'procurar:completo') return { ...c, procurarEm: { ...c.procurarEm, nomeCompleto: false } };
  if (chave === 'procurar:matricula') return { ...c, procurarEm: { ...c.procurarEm, matricula: true } };
  if (chave === 'procurar:guerra') return { ...c, procurarEm: { ...c.procurarEm, nomeDeGuerra: true } };
  if (chave.startsWith('marca:')) return { ...c, marcas: c.marcas.filter((m) => `marca:${m.id}` !== chave) };
  if (chave === 'arquivo') return { ...c, matriculas: [] };
  if (chave.startsWith('extra:')) {
    const campo = chave.slice(6) as keyof Extras;
    return { ...c, extras: { ...c.extras, [campo]: EXTRAS_VAZIOS[campo] } };
  }
  return c;
}

/**
 * "Em uso:", uma etiqueta por critério, cada uma com o seu x (tira o critério e busca de novo), e "Limpar critérios" com dois ou mais. Sem critério em uso, não aparece.
 */
export function EtiquetasDosCriterios({ etiquetas, aoTirar, aoLimpar }: { etiquetas: Etiqueta[]; aoTirar: (chave: string) => void; aoLimpar: () => void }) {
  if (etiquetas.length === 0) return null;
  return (
    <div role="group" aria-label="Critérios em uso" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-apoio text-apagado">Em uso:</span>
      {etiquetas.map((e) => (
        <span key={e.chave} className="inline-flex h-7 items-center gap-0.5 rounded-full border border-linha bg-superficie pr-0.5 pl-2.5 text-apoio font-medium">
          <span>
            {e.texto}
            <b className="font-semibold">{e.destaque}</b>
          </span>
          <button type="button" aria-label={`Tirar o critério: ${e.texto}${e.destaque}`} onClick={() => aoTirar(e.chave)} className="grid size-6 place-items-center rounded-full text-apagado hover:bg-passa hover:text-tinta">
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {etiquetas.length > 1 && <Button type="button" variant="discreto" size="sm" onClick={aoLimpar}>Limpar critérios</Button>}
    </div>
  );
}
