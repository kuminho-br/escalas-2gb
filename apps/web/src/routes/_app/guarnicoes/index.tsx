import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/guarnicoes/')({
  component: () => (
    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-linha bg-superficie/60 p-8 text-center text-apagado">
      Escolha uma guarnição na lista para ver a composição.
    </div>
  ),
});
