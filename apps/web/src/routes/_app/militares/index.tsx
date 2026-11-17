import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/militares/')({
  component: () => (
    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-linha bg-superficie/60 p-8 text-center text-apagado">
      Escolha um militar na lista para ver a ficha.
    </div>
  ),
});
