import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// O botão do sistema de estilo (6.20): altura de controle (36 px; 44 px no toque e no celular), raio de controle, 15 px peso 500. Principal (vinho) é um por tela;
// secundário tem contorno; discreto não tem caixa; perigoso tem o contorno de alerta e só vira cheio dentro da confirmação de apagar. Apagado é cinza sem borda.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-controle text-corpo font-medium whitespace-nowrap transition-colors disabled:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        principal: "bg-vinho text-white hover:bg-vinho-escuro disabled:bg-linha disabled:text-apagado",
        secundario:
          "border border-encaixe bg-superficie text-tinta hover:border-tinta hover:bg-passa disabled:border-transparent disabled:bg-linha disabled:text-apagado",
        discreto: "text-tinta hover:bg-tinta/8 disabled:opacity-50",
        perigoso: "border border-alerta bg-superficie text-alerta hover:bg-alerta-fundo disabled:border-transparent disabled:bg-linha disabled:text-apagado",
        "perigoso-cheio": "bg-alerta text-white hover:bg-alerta/90 disabled:bg-linha disabled:text-apagado",
        link: "text-tinta underline underline-offset-4 hover:no-underline disabled:opacity-50",
      },
      size: {
        default: "h-(--altura-controle) px-3.5 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-apoio has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-(--altura-controle)",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "principal",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "principal",
  size = "default",
  asChild = false,
  ocupado,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** O verbo da ação em andamento ("Salvando…"): o botão fica apagado, com o ícone girando e o verbo no lugar do texto. */
    ocupado?: string
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...(ocupado ? { "aria-busy": true, disabled: true } : {})}
      {...props}
    >
      {ocupado && !asChild ? (
        <>
          <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
          {ocupado}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
