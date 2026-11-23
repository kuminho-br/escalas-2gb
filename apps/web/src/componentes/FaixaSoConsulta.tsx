import { useRouteContext } from '@tanstack/react-router';

/** A faixa das telas de escala numa unidade só de consulta (entrega 6.12): a pessoa vê a escala e não altera nada nela. Mesmo desenho dos avisos âmbar do sistema. */
export function FaixaSoConsulta({ unidade }: { unidade: string }) {
  return (
    <p role="status" data-faixa-so-consulta className="mb-4 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">
      {`Só consulta: você não altera nada em ${unidade}.`}
    </p>
  );
}

/**
 * A unidade das telas é só de consulta? As telas e os componentes de escala leem isto num lugar só, em vez de cada botão conferir o nível de acesso: com
 * `true`, nenhum botão ou campo de alterar aparece. A API recusa qualquer gravação de qualquer jeito.
 */
export function useSoConsulta(): boolean {
  return useRouteContext({ from: '/_app', select: (c) => c.eu.soConsulta });
}
