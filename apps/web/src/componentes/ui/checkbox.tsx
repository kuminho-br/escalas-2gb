import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A caixa de marcar do sistema de estilo: 20 px, borda de 1 px `encaixe`; marcada, fica cheia de `tinta` com o visto branco (`--marca-de-visto`, em `estilo.css`).
 * É um `<input type="checkbox">` de verdade: o teclado, o rótulo e o leitor de tela são os do navegador.
 */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "size-5 shrink-0 appearance-none rounded-sm border border-encaixe bg-superficie bg-center bg-no-repeat transition-colors hover:border-tinta checked:border-tinta checked:bg-tinta checked:bg-(image:--marca-de-visto) disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-alerta",
        className
      )}
      {...props}
    />
  )
}

export { Checkbox }
