import { createFileRoute } from '@tanstack/react-router';
import { Moldura } from '@/componentes/Moldura';

export const Route = createFileRoute('/_app/peculio_/aniversarios')({
  component: Aniversarios,
});

function Aniversarios() {
  return <Moldura titulo="Aniversários">{null}</Moldura>;
}
