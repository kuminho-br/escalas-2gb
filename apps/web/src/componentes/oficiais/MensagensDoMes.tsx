import { mesPorExtenso, type EscalaDosOficiais } from 'contratos';
import { AlertTriangle, Check, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';

export type Confirmacao = 'fechar' | 'encerrar' | null;

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function Caixa({ tom = 'info', children, rotulo }: { tom?: 'info' | 'aviso' | 'ok'; children: ReactNode; rotulo?: string }) {
  const Icone = tom === 'aviso' ? AlertTriangle : tom === 'ok' ? Check : Info;
  return (
    <div
      role={rotulo ? 'region' : undefined}
      aria-label={rotulo}
      className={`flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${tom === 'aviso' ? 'border-pendencia/40 bg-pendencia-fundo text-pendencia' : 'border-linha bg-superficie'}`}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

interface Props {
  escala: EscalaDosOficiais;
  confirmacao: Confirmacao;
  ocupado: boolean;
  aoFechar: () => void;
  aoEncerrar: () => void;
  aoDesistir: () => void;
}

/** As mensagens fixas da etapa, as confirmações e os avisos de afastado. */
export function MensagensDoMes({ escala: e, confirmacao, ocupado, aoFechar, aoEncerrar, aoDesistir }: Props) {
  const semNome = e.turnos.filter((t) => t.militarId === null).length;
  return (
    <div className="grid gap-2" aria-live="polite">
      {confirmacao === 'fechar' && (
        <Caixa rotulo="Confirmação">
          <p>
            <b>Ainda há {semNome} turnos sem nome.</b> Você pode fechar mesmo assim e completar depois; a partir daqui, trocar um nome vira cobertura e fica no registro.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={aoFechar}>Fechar a escala</Button>
            <Button type="button" size="sm" variant="secundario" onClick={aoDesistir}>Voltar</Button>
          </div>
        </Caixa>
      )}
      {confirmacao === 'encerrar' && (
        <Caixa rotulo="Confirmação">
          <p>
            <b>Encerrar {mesPorExtenso(e.mes)}?</b> O saldo do mês é calculado com a escala como está e somado ao acumulado. Depois disso, só um ajuste no painel de saldo muda os números.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={aoEncerrar}>Encerrar o mês</Button>
            <Button type="button" size="sm" variant="secundario" onClick={aoDesistir}>Voltar</Button>
          </div>
        </Caixa>
      )}
      {e.etapa === 'fechada' && e.fechadaEm && (
        <Caixa>
          <p>Escala fechada em {dataBr(e.fechadaEm)}. Clique num turno para trocar o nome: quem cobre ganha o turno, e quem saiu não fica devendo.</p>
        </Caixa>
      )}
      {e.etapa === 'encerrada' && e.encerradaEm && (
        <Caixa tom="ok">
          <p>Mês encerrado em {dataBr(e.encerradaEm)}. O saldo de {mesPorExtenso(e.mes)} já está no painel. Correções agora só por ajuste do gestor.</p>
        </Caixa>
      )}
      {e.avisos.map((a) => (
        <Caixa key={`${a.dia}|${a.turnoId}`} tom="aviso">
          <p>{a.texto}</p>
        </Caixa>
      ))}
    </div>
  );
}
