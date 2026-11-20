import { mesPorExtenso, type GradeDoMes, type GrupoDaGrade, type LinhaDaGrade } from 'contratos';
import { Fragment } from 'react';
import { textoDuracao } from '@/lib/turnos';
import { cn } from '@/lib/utils';
import { BarraComparativa } from './BarraComparativa';
import { CelulaDaGrade } from './CelulaDaGrade';

const INICIAL_DO_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOME_DO_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Os maiores números das colunas, em toda a grade (a barra de cada militar compara com eles, mesmo com o filtro de equipes ligado). */
export function maximosDaGrade(grupos: GrupoDaGrade[]): { pjes: number; diarias: number } {
  const linhas = grupos.flatMap((g) => g.linhas);
  return { pjes: Math.max(0, ...linhas.map((l) => l.pjes)), diarias: Math.max(0, ...linhas.map((l) => l.diarias)) };
}

const horas = (l: LinhaDaGrade) => (l.horasTiradas === 0 && l.horasPedidas === 0 ? '–' : `${textoDuracao(l.horasTiradas)} de ${textoDuracao(l.horasPedidas)}`);

/**
 * A grade: uma linha por militar (o nome fica fixo à esquerda), uma coluna por dia, e no fim PJES, Diárias e Voluntariado. `grupos` são os
 * que aparecem (o filtro de equipes já aplicado); `maximos` vêm da grade inteira.
 */
export function TabelaDaGrade({ grade, grupos, maximos, escolhida, aoEscolher }: {
  grade: GradeDoMes;
  grupos: GrupoDaGrade[];
  maximos: { pjes: number; diarias: number };
  escolhida: { militarId: string; dia: string } | null;
  aoEscolher: (militarId: string, dia: string) => void;
}) {
  const colunas = grade.dias.length + 4;
  return (
    <div className="overflow-x-auto">
      <table aria-label={`Grade geral de ${mesPorExtenso(grade.mes)}`} className="w-full border-separate border-spacing-0 font-cond">
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 left-0 z-30 min-w-40 border-b border-linha bg-superficie py-2 pl-4 text-left text-sm font-medium text-apagado">Militar</th>
            {grade.dias.map((d) => {
              const n = Number(d.data.slice(8));
              const fds = d.diaDaSemana === 0 || d.diaDaSemana === 6;
              return (
                <th
                  key={d.data}
                  scope="col"
                  aria-label={`Dia ${n}, ${NOME_DO_DIA[d.diaDaSemana]}${d.feriado ? `, feriado: ${d.feriado}` : ''}`}
                  data-feriado={d.feriado ? '' : undefined}
                  data-fim-de-semana={fds ? '' : undefined}
                  title={d.feriado ?? undefined}
                  className={cn('sticky top-0 z-20 min-w-6 border-b border-linha px-px pt-2 pb-1.5 text-center text-[13px] font-medium text-apagado', fds ? 'bg-[#F6F7F9]' : 'bg-superficie')}
                >
                  <span aria-hidden className={cn('block text-base font-semibold', d.feriado ? 'text-alerta' : 'text-tinta')}>{n}</span>
                  <span aria-hidden>{INICIAL_DO_DIA[d.diaDaSemana]}</span>
                </th>
              );
            })}
            {['PJES', 'Diárias', 'Voluntariado'].map((t) => (
              <th key={t} scope="col" className="sticky top-0 z-20 border-b border-linha bg-superficie px-2 pt-2 pb-1.5 text-center text-sm font-medium text-apagado">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <Fragment key={g.chave}>
              <tr data-grupo={g.chave}>
                <th colSpan={colunas} scope="colgroup" className="sticky left-0 bg-[#F1F3F6] px-4 py-1.5 text-left text-[13px] font-semibold text-apagado">{g.nome}</th>
              </tr>
              {g.linhas.map((l) => (
                <tr key={l.militarId} data-militar={l.militarId}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-[#EEF0F3] bg-superficie py-1 pl-4 text-left font-normal">
                    <strong className="block text-[15px] leading-tight font-semibold">{l.nomeGuerra}</strong>
                    <span className="text-xs text-apagado">{l.posto}</span>
                  </th>
                  {grade.dias.map((d) => {
                    const fds = d.diaDaSemana === 0 || d.diaDaSemana === 6;
                    return (
                      <td key={d.data} data-fim-de-semana={fds ? '' : undefined} className={cn('border-b border-[#EEF0F3] px-px py-1', fds && 'bg-[#F6F7F9]')}>
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
                  <td className="min-w-14 border-b border-[#EEF0F3] px-2 py-1"><BarraComparativa valor={l.pjes} maximo={maximos.pjes} /></td>
                  <td className="min-w-14 border-b border-[#EEF0F3] px-2 py-1"><BarraComparativa valor={l.diarias} maximo={maximos.diarias} /></td>
                  <td className="border-b border-[#EEF0F3] px-3 py-1 text-right text-sm font-semibold whitespace-nowrap">{horas(l)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
