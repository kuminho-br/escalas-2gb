import type { GuarnicaoNoEfetivo } from 'contratos';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CartaoDaGuarnicao } from '@/componentes/CartaoDaGuarnicao';
import { Button } from '@/componentes/ui/button';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { LinhaDoTempoDaGuarnicao, type AcoesDaLinha } from './LinhaDoTempoDaGuarnicao';
import type { Janela } from '@/lib/efetivo';

/**
 * Uma guarnição do dia. O número só existe na meta (a ordem de ativação), e o estado nunca muda a posição: não ativada continua onde está.
 * As funções aparecem ao longo do dia, com as vagas na própria linha (a frase "Falta…" não vem mais escrita: a vaga vazia já diz).
 */
/** Os controles da meta no card da meta: mudam a meta deste dia ("Mover antes" e "Mover depois" só quando há para onde ir). */
export type ControlesDaMeta = { aoMoverAntes?: () => void; aoMoverDepois?: () => void; aoDesativar: () => void; salvando: boolean };

export function CardDoEfetivo({ g, janela, acoes, meta }: { g: GuarnicaoNoEfetivo; janela: Janela | null; acoes?: AcoesDaLinha; meta?: ControlesDaMeta }) {
  const nome = g.ordem === null ? g.nome : `${g.ordem}º ${g.nome}`;
  return (
    <CartaoDaGuarnicao
      nome={nome}
      viatura={g.viatura}
      rotulo={nome}
      nivel={2}
      naCabeca={
        <>
          <Etiqueta tipo={g.ativada ? 'neutra' : 'falta'}>{g.ativada ? 'ativada' : 'não ativada'}</Etiqueta>
          {meta && (
            <span className="ml-auto flex flex-wrap gap-1">
              {meta.aoMoverAntes && (
                <Button type="button" variant="discreto" size="sm" aria-label={`Mover ${g.nome} para antes`} title="Mover antes" disabled={meta.salvando} onClick={meta.aoMoverAntes}>
                  <ArrowLeft aria-hidden />
                </Button>
              )}
              {meta.aoMoverDepois && (
                <Button type="button" variant="discreto" size="sm" aria-label={`Mover ${g.nome} para depois`} title="Mover depois" disabled={meta.salvando} onClick={meta.aoMoverDepois}>
                  <ArrowRight aria-hidden />
                </Button>
              )}
              <Button type="button" variant="discreto" size="sm" disabled={meta.salvando} onClick={meta.aoDesativar}>Desativar guarnição</Button>
            </span>
          )}
        </>
      }
    >
      {g.horarios.length === 0 && <p className="text-corpo text-apagado">Sem horário vinculado neste dia</p>}
      {janela && <LinhaDoTempoDaGuarnicao g={g} janela={janela} acoes={acoes} />}
    </CartaoDaGuarnicao>
  );
}
