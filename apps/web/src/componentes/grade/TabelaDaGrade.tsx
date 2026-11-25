import { mesPorExtenso, type GradeDoMes, type GrupoDaGrade, type LinhaDaGrade } from 'contratos';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useEffect, useRef } from 'react';
import { hoje } from '@/lib/meses';
import { NOME_JORNADA } from '@/lib/militares';
import { cn } from '@/lib/utils';
import { CotaDeSaldo } from '@/componentes/CotaDeSaldo';
import { BarraComparativa } from './BarraComparativa';
import { CelulaDaGrade } from './CelulaDaGrade';

const SIGLA_DO_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NOME_DO_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Os maiores números das colunas, em toda a grade (a barra de cada militar compara com eles, mesmo com o filtro de equipes ligado). */
export function maximosDaGrade(grupos: GrupoDaGrade[]): { pjes: number; diarias: number } {
  const linhas = grupos.flatMap((g) => g.linhas);
  return { pjes: Math.max(0, ...linhas.map((l) => l.pjes)), diarias: Math.max(0, ...linhas.map((l) => l.diarias)) };
}

/** A linha clara à direita de cada dia, e uma mais forte à esquerda da segunda-feira (separa as semanas; no lugar da clara do domingo). */
function bordasDoDia(grade: GradeDoMes, i: number): string[] {
  const segunda = grade.dias[i]!.diaDaSemana === 1;
  const vesperaDeSegunda = grade.dias[i + 1]?.diaDaSemana === 1;
  return [segunda ? 'border-l border-l-[#C9CED6]' : '', vesperaDeSegunda ? '' : 'border-r border-r-[#EEF0F3]'];
}

// A fronteira da rolagem (6.46; Manual, "Tabela com rolagem"): entre o que fica preso e o que rola, uma linha de 2 px no token `encaixe`, contínua.
// Na Grade: à direita da coluna do militar, embaixo do cabeçalho (na largura toda) e, quando PJES e Diárias ficam presas (1440 px ou mais), à esquerda de PJES.
// As linhas de dentro (entre dias, entre militares, a de segunda-feira) continuam mais fracas que ela.
const FRONTEIRA_DO_MILITAR = 'border-r-2 border-r-encaixe';
const FRONTEIRA_DO_CABECALHO = 'border-b-2 border-b-encaixe';
/** O fundo da faixa de cada equipe. */
const FUNDO_DA_FAIXA = 'bg-[#F1F3F6]';

/** O nome da equipe como a Grade o mostra: o grupo do expediente (chave `adm`) se escreve "ADM" (6.46). */
export const nomeDoGrupo = (g: Pick<GrupoDaGrade, 'chave' | 'nome'>) => (g.chave === 'adm' ? NOME_JORNADA.adm : g.nome);

/** PJES e Diárias: larguras fixas de verdade (w, min-w e max-w iguais; só w seria um mínimo) para as duas se empilharem presas à direita (right-16 = 4rem). */
const COLUNAS_FINAIS = [
  { nome: 'PJES', largura: 'w-16 min-w-16 max-w-16', direita: 'min-[1440px]:right-16', separador: 'min-[1440px]:border-l-2 min-[1440px]:border-l-encaixe' },
  { nome: 'Diárias', largura: 'w-16 min-w-16 max-w-16', direita: 'min-[1440px]:right-0', separador: '' },
] as const;
const CELULA_FINAL = 'border-b border-b-[#EEF0F3] bg-superficie px-2 py-1 group-hover:bg-[#F7F7F8] min-[1440px]:sticky min-[1440px]:z-10';

/** O fundo leve da marca (linha e coluna da célula escolhida) nas partes presas, que são opacas: o mesmo tom vinho, já misturado com o branco. */
const FUNDO_DA_MARCA_NO_CABECALHO = 'bg-[#F7EFEF]';

/**
 * A grade: uma linha por militar (o nome fica fixo à esquerda), uma coluna por dia, e no fim PJES e Diárias. `grupos` são os
 * que aparecem (o filtro de equipes já aplicado); `maximos` vêm da grade inteira.
 */
export function TabelaDaGrade({ grade, grupos, maximos, escolhida, aoEscolher, recolhidas, aoAlternar }: {
  grade: GradeDoMes;
  grupos: GrupoDaGrade[];
  maximos: { pjes: number; diarias: number };
  escolhida: { militarId: string; dia: string } | null;
  aoEscolher: (militarId: string, dia: string) => void;
  /** As chaves das equipes recolhidas (só a faixa aparece) e o clique no nome da equipe. */
  recolhidas: Set<string>;
  aoAlternar: (chave: string) => void;
}) {
  // o dia de hoje, só no mês corrente; ao abrir, a tabela rola até ele uma vez (trocar o filtro ou atualizar os dados não rola de novo)
  const diaDeHoje = hoje();
  const temHoje = grade.dias.some((d) => d.data === diaDeHoje);
  const colunaDeHoje = useRef<HTMLTableCellElement>(null);
  const jaRolou = useRef(false);
  useEffect(() => {
    if (jaRolou.current || !temHoje || !colunaDeHoje.current) return;
    jaRolou.current = true;
    colunaDeHoje.current.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [temHoje]);
  return (
    // a tabela rola nas duas direções dentro da própria caixa: assim o cabeçalho dos dias e a coluna "Militar" grudam nela (com
    // `overflow-x-auto` e a página rolando na vertical, o cabeçalho não tinha onde grudar). Vale também no celular. O `scroll-p*` deixa folga
    // para as partes presas (cabeçalho, coluna Militar e, a partir de 1440px, as duas colunas finais): a célula que rola à vista não para debaixo delas.
    <div data-rolagem="grade" className="max-h-[calc(100dvh-13rem)] scroll-pt-16 scroll-pl-52 overflow-auto min-[1440px]:scroll-pr-32">
      <table aria-label={`Grade geral de ${mesPorExtenso(grade.mes)}`} className="w-full border-separate border-spacing-0 font-cond">
        <thead>
          <tr>
            <th scope="col" className={cn('sticky top-0 left-0 z-30 min-w-[13rem] bg-superficie py-2 pr-3 pl-4 text-left text-sm font-medium text-apagado', FRONTEIRA_DO_MILITAR, FRONTEIRA_DO_CABECALHO)}>Militar</th>
            {grade.dias.map((d, i) => {
              const n = Number(d.data.slice(8));
              const fds = d.diaDaSemana === 0 || d.diaDaSemana === 6;
              const vinho = fds || Boolean(d.feriado);
              return (
                <th
                  key={d.data}
                  ref={d.data === diaDeHoje ? colunaDeHoje : undefined}
                  aria-current={d.data === diaDeHoje ? 'date' : undefined}
                  scope="col"
                  aria-label={`Dia ${n}, ${NOME_DO_DIA[d.diaDaSemana]}${d.feriado ? `, feriado: ${d.feriado}` : ''}`}
                  data-feriado={d.feriado ? '' : undefined}
                  data-fim-de-semana={fds ? '' : undefined}
                  data-coluna={d.data}
                  data-coluna-marcada={escolhida?.dia === d.data ? '' : undefined}
                  title={d.feriado ?? undefined}
                  className={cn('sticky top-0 z-20 min-w-12 bg-superficie px-px pt-2 pb-1.5 text-center text-[13px] font-medium text-apagado', FRONTEIRA_DO_CABECALHO, escolhida?.dia === d.data && FUNDO_DA_MARCA_NO_CABECALHO, ...bordasDoDia(grade, i))}
                >
                  <span aria-hidden className={cn('block text-base font-semibold', vinho ? 'text-vinho' : 'text-tinta')}>{n}</span>
                  <span aria-hidden className={cn(vinho && 'text-vinho')}>{SIGLA_DO_DIA[d.diaDaSemana]}</span>
                  {d.feriado && <span aria-hidden data-ponto-feriado className="mx-auto mt-0.5 block size-1 rounded-full bg-vinho" />}
                </th>
              );
            })}
            {/* a partir de 1440px as duas colunas finais ficam presas à direita, empilhadas: Diárias e PJES (4rem cada) */}
            {COLUNAS_FINAIS.map((c) => (
              <th key={c.nome} scope="col" className={cn('sticky top-0 z-20 bg-superficie px-2 pt-2 pb-1.5 text-center text-sm font-medium text-apagado min-[1440px]:z-30', FRONTEIRA_DO_CABECALHO, c.largura, c.direita, c.separador)}>{c.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.chave}>
              <tr data-grupo={g.chave}>
                {/* é uma célula comum, e não um cabeçalho de linha: o nome da equipe não é o nome de um militar. A faixa tem as mesmas colunas presas das linhas (a do militar e, a partir de 1440 px, PJES e Diárias): assim as fronteiras da rolagem a atravessam, contínuas */}
                <td className={cn('sticky left-0 z-10 min-w-[13rem] py-1.5 pr-3 pl-4 text-left', FUNDO_DA_FAIXA, FRONTEIRA_DO_MILITAR)}>
                  <span data-nome-do-grupo className="flex items-center gap-2 whitespace-nowrap">
                    <span aria-hidden className="h-4 w-[3px] rounded-full bg-vinho" />
                    <button type="button" aria-expanded={!recolhidas.has(g.chave)} aria-label={`${recolhidas.has(g.chave) ? 'Mostrar' : 'Recolher'} ${nomeDoGrupo(g)}`} onClick={() => aoAlternar(g.chave)} className="inline-flex items-center gap-1 rounded text-left hover:underline focus-visible:outline-2">
                      {recolhidas.has(g.chave) ? <ChevronRight className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                      <strong className="text-[15px] font-bold text-tinta">{nomeDoGrupo(g)}</strong>
                    </button>
                    <span className="text-sm font-normal text-apagado">{g.linhas.length === 1 ? '1 militar' : `${g.linhas.length} militares`}</span>
                  </span>
                </td>
                <td colSpan={grade.dias.length} className={FUNDO_DA_FAIXA} />
                <td className={cn('min-[1440px]:sticky min-[1440px]:z-10', FUNDO_DA_FAIXA, COLUNAS_FINAIS[0].direita, COLUNAS_FINAIS[0].separador)} />
                <td className={cn('min-[1440px]:sticky min-[1440px]:z-10', FUNDO_DA_FAIXA, COLUNAS_FINAIS[1].direita)} />
              </tr>
              {(recolhidas.has(g.chave) ? [] : g.linhas).map((l) => {
                const linhaMarcada = escolhida?.militarId === l.militarId;
                return (
                <tr key={l.militarId} data-militar={l.militarId} data-linha-marcada={linhaMarcada ? '' : undefined} className={cn('group', linhaMarcada ? 'bg-vinho/[0.06]' : 'hover:bg-black/[0.03]')}>
                  <th scope="row" className={cn('sticky left-0 z-10 min-w-[13rem] border-b border-b-[#EEF0F3] py-1 pr-3 pl-4 text-left font-normal', FRONTEIRA_DO_MILITAR, linhaMarcada ? FUNDO_DA_MARCA_NO_CABECALHO : 'bg-superficie group-hover:bg-[#F7F7F8]')}>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className="text-sm text-apagado">{l.posto}</span>
                      <strong className="text-[15px] leading-tight font-semibold">{l.nomeGuerra}</strong>
                    </span>
                    {/* a matrícula à esquerda e a barra da cota de saldo encostada à direita, a 12 px da fronteira; sem barra (o Pronto), a matrícula fica no mesmo lugar */}
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="text-xs text-apagado">{l.matricula}</span>
                      {l.saldos && <CotaDeSaldo feitos={l.saldos.feitos} total={l.saldos.total} />}
                    </span>
                  </th>
                  {grade.dias.map((d, i) => {
                    const fds = d.diaDaSemana === 0 || d.diaDaSemana === 6;
                    const colunaMarcada = escolhida?.dia === d.data;
                    return (
                      <td
                        key={d.data}
                        data-fim-de-semana={fds ? '' : undefined}
                        data-coluna={d.data}
                        data-coluna-marcada={colunaMarcada ? '' : undefined}
                        className={cn('border-b border-b-[#EEF0F3] px-px py-1', colunaMarcada && 'bg-vinho/[0.06]', ...bordasDoDia(grade, i))}
                      >
                        <CelulaDaGrade
                          linha={l}
                          dia={Number(d.data.slice(8))}
                          data={d.data}
                          blocos={l.dias[d.data] ?? []}
                          choque={l.choques.includes(d.data)}
                          escolhida={escolhida?.militarId === l.militarId && escolhida.dia === d.data}
                          aoEscolher={() => aoEscolher(l.militarId, d.data)}
                        />
                      </td>
                    );
                  })}
                  <td className={cn(CELULA_FINAL, COLUNAS_FINAIS[0].largura, COLUNAS_FINAIS[0].direita, COLUNAS_FINAIS[0].separador)}><BarraComparativa valor={l.pjes} maximo={maximos.pjes} /></td>
                  <td className={cn(CELULA_FINAL, COLUNAS_FINAIS[1].largura, COLUNAS_FINAIS[1].direita)}><BarraComparativa valor={l.diarias} maximo={maximos.diarias} /></td>
                </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
