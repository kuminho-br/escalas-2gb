/** O bloco como aparece na grade: a cor do serviço com a letra dentro. */
export function Bloco({ cor, letra }: { cor: string; letra: string }) {
  return (
    <span aria-hidden className="inline-grid size-6 shrink-0 place-items-center rounded font-cond text-xs font-semibold text-white" style={{ backgroundColor: cor }}>
      {letra}
    </span>
  );
}
