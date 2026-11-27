import type { BlocoDaGrade, LinhaDaGrade } from 'contratos';
import { type AfastamentoDoDia, dicaDoAfastamento } from '@/lib/afastamento-na-grade';
import { estiloDaCor } from '@/lib/cores';
import { cn } from '@/lib/utils';

const COR_DO_EXPEDIENTE = '#8A94A1';

/** O nome acessível da célula: "SD ALFA, dia 12: Pronto A, JES A, choque, afastado: Férias". */
export function nomeDaCelula(l: Pick<LinhaDaGrade, 'posto' | 'nomeGuerra'>, dia: number, blocos: BlocoDaGrade[], choque: boolean, afastado?: string | null): string {
  const o = blocos.length ? blocos.map((b) => (b.expediente ? 'expediente' : `${b.servico?.nome} ${b.letra}`)).join(', ') : 'sem serviço';
  return `${l.posto} ${l.nomeGuerra}, dia ${dia}: ${o}${choque ? ', choque' : ''}${afastado ? `, afastado: ${afastado}` : ''}`;
}

/**
 * Um dia de um militar: um quadrado por serviço, na cor do serviço, com a letra do turno, em ordem de início. O expediente do Adm é um
 * quadrado cinza sem letra. O choque é um contorno vermelho. O afastado (6.70) é um tracejado âmbar no meio da célula, por trás dos quadrados, com o tipo escrito no primeiro dia do
 * período e, na dica, o período inteiro. A célula é um botão: clicar abre o painel do dia daquele militar.
 */
export function CelulaDaGrade({ linha, dia, data, blocos, choque, escolhida, aoEscolher, afastado }: {
  linha: LinhaDaGrade;
  dia: number;
  /** 'aaaa-mm-dd': para devolver o foco a esta célula quando o painel do dia fechar */
  data: string;
  blocos: BlocoDaGrade[];
  choque: boolean;
  escolhida: boolean;
  aoEscolher: () => void;
  /** o afastamento que cobre o dia (`afastamentoDoDia`); sem ele, a célula é a de sempre */
  afastado?: AfastamentoDoDia | null;
}) {
  return (
    <button
      type="button"
      aria-label={nomeDaCelula(linha, dia, blocos, choque, afastado?.tipo)}
      title={afastado ? dicaDoAfastamento(afastado) : undefined}
      data-data={data}
      data-choque={choque ? '' : undefined}
      data-escolhida={escolhida ? '' : undefined}
      data-afastado={afastado ? '' : undefined}
      onClick={aoEscolher}
      className={cn(
        'relative flex h-7 w-full min-w-12 items-center justify-evenly rounded px-px outline-none focus-visible:ring-2 focus-visible:ring-tinta',
        // o contorno do choque e o da escolhida ficam por cima do traço do afastado (um pseudo-elemento sobre tudo), então o traço nunca os esconde
        (choque || escolhida) && `after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded after:ring-2 after:ring-inset after:content-['']`,
        choque && 'after:ring-alerta',
        // o choque é o contorno vermelho; a escolhida tem o fundo vinho, também quando há choque (o contorno continua o do choque)
        choque && !escolhida && 'bg-alerta/10',
        escolhida && 'bg-vinho/15',
        escolhida && !choque && 'after:ring-vinho',
        !blocos.length && !choque && !escolhida && 'hover:bg-black/[0.06]',
      )}
    >
      {afastado && <span aria-hidden data-traco-do-afastado data-comeca={afastado.comeca ? '' : undefined} data-termina={afastado.termina ? '' : undefined} className="afastado-traco" />}
      {afastado?.comeca && <span aria-hidden data-rotulo-do-afastado className="pointer-events-none absolute top-1 left-1 z-10 font-cond text-[11px] leading-none font-semibold whitespace-nowrap text-pendencia">{afastado.tipo}</span>}
      {blocos.map((b, i) => {
        const cor = b.expediente ? COR_DO_EXPEDIENTE : (b.servico?.cor ?? COR_DO_EXPEDIENTE);
        return (
          <span
            key={`${b.alocacaoId ?? 'expediente'}|${i}`}
            aria-hidden
            className="relative z-10 grid h-[18px] w-5 shrink-0 place-items-center rounded-[3px] font-cond text-[11px] leading-none font-bold"
            style={estiloDaCor(cor)}
          >
            {b.letra}
          </span>
        );
      })}
    </button>
  );
}
