import { cn } from '@/lib/utils';

/**
 * A vaga que espera um militar (opção A do mockup docs/telas/vaga-vazia): fundo branco e contorno tracejado, igual na Escala do mês e no
 * Efetivo por dia. A cor de um serviço fica só para quem já está escalado; a vaga nunca usa a cor de serviço nenhuma.
 * A obrigatória (falta para a guarnição sair) leva também a barra vinho (<BarraDaVaga />); a extra tem o contorno mais claro.
 * O raio, o tamanho, a posição (`relative` ou `absolute`, de que a barra depende) e o `z-index` do foco são de quem usa: se estivessem aqui, o tailwind-merge trocaria os do chamador pelos daqui. Ao passar o mouse o contorno fica contínuo e escuro; com o teclado vale o anel escuro de foco do site.
 */
export const classeDaVaga = (obrigatoria: boolean) =>
  cn(
    'border-[1.5px] border-dashed bg-superficie',
    obrigatoria ? 'border-encaixe text-tinta' : 'border-encaixe-claro text-apagado',
    'hover:border-solid hover:border-apagado hover:bg-passa hover:text-tinta',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta',
  );

/** A barra vinho à esquerda da vaga obrigatória. Só decora: quem lê a tela ouve a obrigatória pelo `data-obrigatoria` e pelo nome da vaga. */
export function BarraDaVaga() {
  return <span aria-hidden data-barra className="absolute inset-y-0 left-0 w-[3px] rounded-l-sm bg-vinho" />;
}
