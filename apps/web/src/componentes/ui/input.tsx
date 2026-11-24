import * as React from "react"
import { cn } from "@/lib/utils"

// O campo do sistema de estilo (6.20): altura de controle, folga de 12 px, borda de 1 px `encaixe` (a de `tinta` com o mouse em cima), raio de controle, 15 px.
// Com erro (`aria-invalid`), a borda passa a 2 px de `alerta`.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-(--altura-controle) w-full min-w-0 rounded-controle border border-encaixe bg-superficie px-3 text-corpo transition-colors selection:bg-tinta selection:text-white file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-apoio file:font-medium file:text-tinta placeholder:text-apagado hover:border-tinta disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-2 aria-invalid:border-alerta",
        className
      )}
      {...props}
    />
  )
}

export { Input }
