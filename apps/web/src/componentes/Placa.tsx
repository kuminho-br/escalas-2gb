import { CircleAlert, Ellipsis } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/componentes/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Uma ação do menu da placa. "Remover do turno" é o texto de quem está em "Sem guarnição". */
export type AcaoDaPlaca = { rotulo: 'Trocar militar' | 'Remover da vaga' | 'Remover do turno'; aoEscolher: () => void };

export type PropsDaPlaca = {
  patente: string;
  nome: string;
  matricula?: string;
  /** O serviço de quem ocupa o lugar: a faixa de 5 px na cor do cadastro e, quando a origem não é o Pronto, o nome à direita. */
  servico?: { nome: string; cor: string };
  /** "Chefe ABT": ocupa o lugar do nome do serviço ("acumula com Chefe ABT"). */
  acumulaCom?: string;
  estado?: 'normal' | 'escolhida' | 'choque';
  /** A frase do choque, embaixo da placa (só com `estado="choque"`). */
  choque?: string;
  acoes?: AcaoDaPlaca[];
  /** O nome do botão das ações; sem ele, "Ações de {nome}". */
  rotuloDasAcoes?: string;
  /** Com isto a placa inteira é um botão (o trecho da linha do tempo): não tem o menu das ações. */
  aoClicar?: () => void;
  rotuloAcessivel?: string;
  /** A dica (o title): sem ela, patente, nome, matrícula e serviço. A linha do tempo põe o horário do trecho. */
  dica?: string;
  /** O nome do serviço só aparece quando a própria placa é larga (14 rem): na linha do tempo, o trecho estreito não perde o nome do militar para ele. */
  servicoSoSeAmplo?: boolean;
  /** Algo à direita do nome (o horário do trecho). */
  extra?: ReactNode;
  /** Na frente da matrícula (a barra da cota de saldo do Adm, 6.38). */
  antesDaMatricula?: ReactNode;
  /** Ao lado do nome do serviço, na ponta direita (o "2/6" da cota de saldo, 6.38). */
  depoisDoServico?: ReactNode;
  role?: string;
  className?: string;
  style?: CSSProperties;
};

/** O serviço Pronto é o de todo dia: a placa só nomeia o serviço quando a origem é outra. */
export const ehServicoPronto = (nome: string) => nome.trim().toLowerCase() === 'pronto';

/**
 * A placa do sistema de estilo: um militar num lugar. Altura de controle, borda de 1 px `linha`, raio de controle, sombra apoiada e a faixa do serviço de 5 px à esquerda.
 * Patente em 13 px, nome em 17 px estreita pela linha de base; quem corta, com reticências, é o nome. Os três pontos das ações ficam sempre à mostra.
 */
export function Placa({ patente, nome, matricula, servico, acumulaCom, estado = 'normal', choque, acoes, rotuloDasAcoes, aoClicar, rotuloAcessivel, dica: dicaDeFora, servicoSoSeAmplo, extra, antesDaMatricula, depoisDoServico, role, className, style }: PropsDaPlaca) {
  const idDoChoque = useId();
  const dica = dicaDeFora ?? [`${patente} ${nome}`, matricula, servico?.nome].filter(Boolean).join(', ');
  const aoLado = acumulaCom ? `acumula com ${acumulaCom}` : servico && !ehServicoPronto(servico.nome) ? servico.nome : null;
  const com = estado === 'choque' && choque;
  const classe = cn(
    servicoSoSeAmplo && '@container',
    'relative flex h-(--altura-controle) min-w-0 items-center gap-1.5 overflow-hidden rounded-controle border bg-superficie pr-1 pl-[15px] text-left shadow-apoiada',
    estado === 'normal' && 'border-linha hover:border-encaixe hover:bg-passa has-[[data-state=open]]:border-tinta has-[[data-state=open]]:ring-1 has-[[data-state=open]]:ring-tinta',
    estado === 'escolhida' && 'border-tinta ring-1 ring-tinta',
    estado === 'choque' && 'border-alerta ring-1 ring-alerta',
    className,
  );
  const corpo = (
    <>
      <i aria-hidden data-faixa-servico className="absolute inset-y-0 left-0 w-[5px] bg-linha" style={servico ? { backgroundColor: servico.cor } : undefined} />
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-apoio font-medium text-apagado">{patente}</span>
        <span className="min-w-0 truncate font-cond text-nome font-semibold tracking-[0.01em]">{nome}</span>
      </span>
      {antesDaMatricula}
      {matricula && <span className="shrink-0 text-apoio text-apagado">{matricula}</span>}
      {extra}
      {aoLado && <span className={cn('ml-auto shrink-0 pl-1 text-apoio text-apagado', servicoSoSeAmplo && 'hidden @min-[14rem]:inline')}>{aoLado}{depoisDoServico && <span className="ml-1.5">{depoisDoServico}</span>}</span>}
    </>
  );
  const placa = aoClicar ? (
    <button type="button" data-placa title={dica} aria-label={rotuloAcessivel} onClick={aoClicar} className={cn(classe, 'w-full focus-visible:z-10')} style={style}>
      {corpo}
    </button>
  ) : (
    <div data-placa role={role} title={dica} aria-label={rotuloAcessivel} aria-describedby={com ? idDoChoque : undefined} className={classe} style={style}>
      {corpo}
      {acoes && acoes.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={rotuloDasAcoes ?? `Ações de ${nome}`}
              className={cn('ml-auto grid size-7 shrink-0 place-items-center rounded-controle text-apagado hover:text-tinta focus-visible:text-tinta data-[state=open]:text-tinta', aoLado && 'ml-0')}
            >
              <Ellipsis aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {acoes.map((a) => (
              <DropdownMenuItem key={a.rotulo} onSelect={a.aoEscolher}>
                {a.rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
  if (!com) return placa;
  return (
    <div className="grid gap-1">
      {placa}
      <p id={idDoChoque} className="flex items-start gap-1.5 text-apoio font-medium text-alerta">
        <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
        {choque}
      </p>
    </div>
  );
}
