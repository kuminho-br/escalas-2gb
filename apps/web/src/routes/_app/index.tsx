import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({
  component: GradeGeral,
});

function GradeGeral() {
  return (
    <section>
      <h1 className="font-cond text-[28px] leading-tight font-semibold">Grade geral</h1>
      <div className="mt-6 grid min-h-64 place-items-center rounded-xl border border-dashed border-linha bg-superficie/60 px-6 py-12 text-center">
        <p className="max-w-[46ch] text-apagado">A grade aparece aqui quando houver uma escala cadastrada.</p>
      </div>
    </section>
  );
}
