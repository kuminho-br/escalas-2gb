import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-controle border border-encaixe bg-superficie px-3 py-2 text-corpo transition-colors placeholder:text-apagado hover:border-tinta disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2 aria-invalid:border-alerta",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
