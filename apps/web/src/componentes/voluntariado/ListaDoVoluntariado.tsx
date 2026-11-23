import { Link } from '@tanstack/react-router';
import type { MilitarDoVoluntariado } from 'contratos';
import { Input } from '@/componentes/ui/input';
import { cn } from '@/lib/utils';

function Grupo({ titulo, militares, abertoId, mes, soLeitura }: { titulo: string; militares: MilitarDoVoluntariado[]; abertoId: string | undefined; mes: string; soLeitura: boolean }) {
  return (
    <section aria-label={titulo} className="grid gap-1.5">
      <h2 className="text-xs font-medium text-apagado">{titulo}</h2>
      {militares.length === 0 ? (
        <p className="text-sm text-apagado">Ninguém por aqui.</p>
      ) : (
        <ul className="grid gap-1">
          {militares.map((m) => (
            <li key={m.militarId}>
              <Link
                to="/voluntariado"
                search={{ mes, militar: m.militarId }}
                aria-current={m.militarId === abertoId ? 'true' : undefined}
                className={cn('flex items-baseline gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent', m.militarId === abertoId ? 'border-vinho bg-vinho/5' : 'border-linha')}
              >
                <span className="text-xs text-apagado">{m.posto}</span>
                <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
                <span className="ml-auto text-xs text-apagado">
                  {m.militarId === abertoId && !soLeitura ? 'lançando' : m.lancado ? `${m.dias} ${m.dias === 1 ? 'dia' : 'dias'}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A lista à esquerda: a busca e os militares em "Já lançados" e "Faltam lançar". */
export function ListaDoVoluntariado({ militares, abertoId, mes, busca, aoBuscar, soLeitura = false }: { militares: MilitarDoVoluntariado[]; abertoId: string | undefined; mes: string; busca: string; aoBuscar: (t: string) => void; /** unidade só de consulta: o militar aberto não está "lançando" */ soLeitura?: boolean }) {
  const texto = busca.trim().toLowerCase();
  const visiveis = militares.filter((m) => !texto || m.nomeGuerra.toLowerCase().includes(texto) || m.matricula.includes(texto));
  return (
    <div className="grid content-start gap-3">
      <Input aria-label="Buscar por nome ou matrícula" placeholder="Nome ou matrícula" value={busca} onChange={(e) => aoBuscar(e.target.value)} />
      <Grupo titulo="Já lançados" militares={visiveis.filter((m) => m.lancado)} abertoId={abertoId} mes={mes} soLeitura={soLeitura} />
      <Grupo titulo="Faltam lançar" militares={visiveis.filter((m) => !m.lancado)} abertoId={abertoId} mes={mes} soLeitura={soLeitura} />
    </div>
  );
}
