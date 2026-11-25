import type { EstadoDaEscala } from 'contratos';
import { Etiqueta } from '@/componentes/ui/etiqueta';

const NOMES: Record<EstadoDaEscala, string> = { rascunho: 'Rascunho', previa: 'Prévia', publicada: 'Publicada', retificada: 'Retificada', remessada: 'Remessada' };

/** O estado de uma escala para quem a lê (7.5): "Prévia", "Publicada", "Retificada" ou "Remessada", mais a etiqueta "Escala em retificação" quando é o caso. */
export function EtiquetaDoEstado({ estado, emRetificacao }: { estado: EstadoDaEscala; emRetificacao: boolean }) {
  return (
    <>
      <Etiqueta tipo="neutra">{NOMES[estado]}</Etiqueta>
      {emRetificacao && <Etiqueta tipo="falta">Escala em retificação</Etiqueta>}
    </>
  );
}
