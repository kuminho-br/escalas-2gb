import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// os seis tamanhos de letra, os dois raios e as duas sombras do sistema de estilo (estilo.css) são de tamanho e forma, e não de cor: sem isto o `tailwind-merge`
// tomaria `text-apoio` por uma cor e deixaria só a última classe `text-*`
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["apoio", "corpo", "nome", "bloco", "titulo", "abertura"] }],
      rounded: [{ rounded: ["controle", "superficie"] }],
      shadow: [{ shadow: ["apoiada", "por-cima"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
