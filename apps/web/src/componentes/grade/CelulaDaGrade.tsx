import type { BlocoDaGrade, LinhaDaGrade } from 'contratos';
import { corDoTexto } from '@/lib/cores';
import { cn } from '@/lib/utils';

const COR_DO_EXPEDIENTE = '#8A94A1';

/** O nome acessível da célula: "SD BM ALFA, dia 12: Pronto A, JES A, choque". */
export function nomeDaCelula(l: Pick<LinhaDaGrade, 'posto' | 'nomeGuerra'>, dia: number, blocos: BlocoDaGrade[], choque: boolean): string {
  const o = blocos.length ? blocos.map((b) => (b.expediente ? 'expediente' : `${b.servico?.nome} ${b.letra}`)).join(', ') : 'sem serviço';
  return `${l.posto} ${l.nomeGuerra}, dia ${dia}: ${o}${choque ? ', choque' : ''}`;
}

/**
 * Um dia de um militar: um quadrado por serviço, na cor do serviço, com a letra do turno, em ordem de início. O expediente do Adm é um
 * quadrado cinza sem letra. O choque é um contorno vermelho. A célula é um botão: clicar abre o painel do dia daquele militar.
 */
export function CelulaDaGrade({ linha, dia, data, blocos, choque, escolhida, aoEscolher }: {
  linha: LinhaDaGrade;
  dia: number;
  /** 'aaaa-mm-dd': para devolver o foco a esta célula quando o painel do dia fechar */
  data: string;
  blocos: BlocoDaGrade[];
  choque: boolean;
  escolhida: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={nomeDaCelula(linha, dia, blocos, choque)}
      data-data={data}
      data-choque={choque ? '' : undefined}
      data-escolhida={escolhida ? '' : undefined}
      onClick={aoEscolher}
      className={cn(
        'flex h-7 w-full min-w-12 items-center justify-evenly rounded px-px outline-none focus-visible:ring-2 focus-visible:ring-tinta',
        choque && 'bg-alerta/10 ring-2 ring-alerta ring-inset',
        escolhida && !choque && 'bg-vinho/15 ring-2 ring-vinho ring-inset',
        !blocos.length && !choque && !escolhida && 'hover:bg-black/[0.06]',
      )}
    >
      {blocos.map((b, i) => {
        const cor = b.expediente ? COR_DO_EXPEDIENTE : (b.servico?.cor ?? COR_DO_EXPEDIENTE);
        return (
          <span
            key={`${b.alocacaoId ?? 'expediente'}|${i}`}
            aria-hidden
            className="grid h-[18px] w-5 shrink-0 place-items-center rounded-[3px] font-cond text-[11px] leading-none font-bold"
            style={{ backgroundColor: cor, color: corDoTexto(cor) }}
          >
            {b.letra}
          </span>
        );
      })}
    </button>
  );
}
