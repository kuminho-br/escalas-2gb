import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * O contorno do lugar que espera um militar, no sistema de estilo. Obrigatório (a guarnição não sai sem ele): fundo de pendência, borda tracejada de 1,5 px
 * `pendencia` e texto `pendencia`, peso 500. Opcional: sem fundo, borda tracejada de 1 px `encaixe` e texto `apagado`. Com o mouse o tracejado vira linha cheia;
 * no opcional, o fundo passa a `superficie` e o texto e a borda a `tinta`. A cor de um serviço fica só para quem já está escalado: a vaga nunca a usa.
 * O raio, o tamanho e a posição são de quem usa (a linha do tempo põe o encaixe num trecho do dia).
 */
export const classeDoEncaixe = (obrigatorio: boolean) =>
  cn(
    'border-dashed hover:border-solid',
    obrigatorio ? 'border-[1.5px] border-pendencia bg-pendencia-fundo font-medium text-pendencia' : 'border border-encaixe font-normal text-apagado hover:border-tinta hover:bg-superficie hover:text-tinta',
  );

const BASE = 'relative flex h-(--altura-controle) w-full min-w-0 items-center gap-2 rounded-controle px-3 text-left text-corpo';

/**
 * O encaixe de um lugar na guarnição. Com `aoEscolher` é um botão ("Escolher militar", ou "Vaga opcional"); sem ele (unidade só de consulta) é só um aviso: "Vaga livre" (a obrigatória) ou "Vaga opcional".
 * `rotuloAcessivel` é o nome do botão ("Escolher militar para Chefe de ABT").
 */
export function Encaixe({ obrigatorio, aoEscolher, rotuloAcessivel, className }: { obrigatorio: boolean; aoEscolher?: () => void; rotuloAcessivel?: string; className?: string }) {
  if (!aoEscolher) {
    return (
      <div data-encaixe data-obrigatoria={obrigatorio ? '' : undefined} className={cn(BASE, obrigatorio ? classeDoEncaixe(true) : classeDoEncaixe(false), 'hover:border-dashed', className)}>
        {obrigatorio ? 'Vaga livre' : 'Vaga opcional'}
      </div>
    );
  }
  return (
    <button type="button" data-encaixe data-obrigatoria={obrigatorio ? '' : undefined} aria-label={rotuloAcessivel} onClick={aoEscolher} className={cn(BASE, classeDoEncaixe(obrigatorio), 'focus-visible:z-10', className)}>
      <Plus aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      {obrigatorio ? 'Escolher militar' : 'Vaga opcional'}
    </button>
  );
}
