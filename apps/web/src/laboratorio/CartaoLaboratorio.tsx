import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { EscolherPerfil } from './EscolherPerfil';

/** O cartão do Laboratório na tela inicial (6.59): para todo militar com conta. Abre a escolha do perfil de teste. */
export function CartaoLaboratorio({ className }: { className: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={`${className} text-left [&>svg]:text-laboratorio`}>
        <FlaskConical aria-hidden className="row-span-2 size-[22px] justify-self-center" />
        <b className="font-cond text-nome leading-5 font-semibold">Laboratório</b>
        <small className="text-apoio leading-[18px] text-apagado md:truncate">Experimente as ferramentas novas com dados de teste.</small>
      </button>
      <EscolherPerfil aberto={aberto} aoFechar={() => setAberto(false)} />
    </>
  );
}
