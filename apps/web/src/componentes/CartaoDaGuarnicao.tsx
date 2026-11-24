import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Etiqueta } from '@/componentes/ui/etiqueta';

/** O estado de uma guarnição que não está completa: "Falta 1" e "Faltam 2". */
export const textoDoContador = (faltam: number) => (faltam === 1 ? 'Falta 1' : `Faltam ${faltam}`);

/**
 * O cartão da guarnição do sistema de estilo: só a guarnição tem caixa, e ela junta a equipe que sai na viatura naquele turno. Fundo `superficie`, borda `linha`,
 * raio de superfície, folga de 12 px (14 embaixo); nome em 17 px estreita e viatura em 13 px `apagado`. À direita do nome, "Falta 1" / "Faltam N" numa etiqueta de
 * falta, ou o visto cinza de "Completa" (que o leitor de tela lê). `faltam` ausente = sem estado (a linha do tempo do Efetivo por dia não conta vagas).
 * `frases` é o que falta, por extenso, para o nome acessível e a dica da etiqueta; `rotulo` faz do cartão uma região nomeada.
 */
export function CartaoDaGuarnicao({ nome, viatura, faltam, frases, rotulo, nivel = 4, naCabeca, children }: { nome: string; viatura?: string | null; faltam?: number; frases?: string; rotulo?: string; nivel?: 2 | 4; naCabeca?: ReactNode; children: ReactNode }) {
  const Raiz = rotulo ? 'section' : 'div';
  const Titulo = nivel === 2 ? 'h2' : 'h4';
  return (
    <Raiz data-cartao aria-label={rotulo} className="@container grid content-start gap-2 rounded-superficie border border-linha bg-superficie p-3 pb-3.5">
      <header className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <div className="min-w-0 flex-1">
          <Titulo className="font-cond text-nome leading-tight font-semibold">{nome}</Titulo>
          {viatura && <p className="text-apoio text-apagado">{viatura}</p>}
        </div>
        {faltam !== undefined &&
          (faltam > 0 ? (
            // só o número fica à vista: o que falta, em frases, fica na dica e no nome acessível
            <span role="img" aria-label={frases ?? textoDoContador(faltam)} title={frases ?? textoDoContador(faltam)}>
              <Etiqueta tipo="falta">{textoDoContador(faltam)}</Etiqueta>
            </span>
          ) : (
            <span role="img" aria-label="Completa" title="Completa" className="text-encaixe">
              <Check className="size-4" aria-hidden strokeWidth={1.75} />
            </span>
          ))}
        {naCabeca}
      </header>
      {children}
    </Raiz>
  );
}

/**
 * Uma função dentro do cartão: o rótulo numa coluna de 72 px (nome em 13 px, peso 500; a CNH embaixo, `apagado`) e os lugares em coluna, com 6 px entre eles.
 * Em cartão com menos de 340 px o rótulo vai para cima dos lugares, numa linha.
 */
export function FuncaoDoCartao({ nome, cnh, children }: { nome: string; cnh?: string | null; children: ReactNode }) {
  return (
    <div data-funcao-do-cartao className="grid grid-cols-[4.5rem_1fr] items-start gap-x-2 gap-y-1 @max-[21.25rem]:grid-cols-1">
      <p data-cabecalho-funcao className="min-w-0 break-words">
        <span className="block text-apoio font-medium">{nome}</span>
        {cnh && <span className="block text-apoio text-apagado">CNH {cnh}</span>}
      </p>
      <div data-lugares className="grid gap-1.5">
        {children}
      </div>
    </div>
  );
}
