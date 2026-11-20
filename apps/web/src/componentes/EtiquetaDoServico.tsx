import { corDoTexto } from '@/lib/cores';
import { cn } from '@/lib/utils';

/**
 * O nome do serviço num retângulo de cantos bem arredondados, na cor que o usuário cadastrou para ele (como as etiquetas "PJES" e "SALDO").
 * `cheia`: fundo na cor do serviço e letra de melhor contraste; `contorno`: borda e letra de melhor contraste sobre a cor, fundo
 * transparente (para usar sobre uma barra que já tem a cor do serviço).
 */
export function EtiquetaDoServico({ nome, cor, variante = 'cheia', className }: { nome: string; cor: string; variante?: 'cheia' | 'contorno'; className?: string }) {
  const texto = corDoTexto(cor);
  return (
    <span
      data-etiqueta-servico
      data-variante={variante}
      className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11px] leading-tight font-semibold whitespace-nowrap', className)}
      style={variante === 'cheia' ? { backgroundColor: cor, color: texto, borderColor: cor } : { backgroundColor: 'transparent', color: texto, borderColor: texto }}
    >
      {nome}
    </span>
  );
}
