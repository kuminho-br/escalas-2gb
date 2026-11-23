import { mesPorExtenso, type EscalaDosOficiais } from 'contratos';
import { AlertTriangle, Check, ChevronRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';
import { cn } from '@/lib/utils';

export type Confirmacao = 'fechar' | 'encerrar' | 'encerrar-antes' | 'calcular-fechada' | null;

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

const PASSOS = [
  { nome: 'Participantes e cotas', frase: 'Marque quem participa e calcule as cotas' },
  { nome: 'Escolhas', frase: 'Os oficiais escolhem os turnos na ordem' },
  { nome: 'Escala fechada', frase: 'Trocar é cobrir: fica o registro de quem saiu' },
  { nome: 'Mês encerrado', frase: 'O saldo entra no acumulado' },
] as const;

interface PropsDasEtapas {
  etapa: EscalaDosOficiais['etapa'];
  ocupado: boolean;
  /** sem o serviço escolhido não há o que calcular */
  podeCalcular: boolean;
  aoCalcular: () => void;
  aoFechar: () => void;
  aoEncerrar: () => void;
}

/**
 * As etapas do mês como uma linha de processo: quatro passos com um círculo (feito: visto; atual: preenchido com o número; por vir: contorno), o nome e uma
 * frase do que acontece nele. A ação que leva ao próximo passo fica sobre a seta que sai dele; a seta se preenche (220 ms) quando o passo é vencido.
 */
export function EtapasDoMes({ etapa, ocupado, podeCalcular, aoCalcular, aoFechar, aoEncerrar }: PropsDasEtapas) {
  const atual = etapa === 'encerrada' ? 3 : etapa === 'fechada' ? 2 : etapa === 'escolhas' ? 1 : 0;
  // a ação de cada seta: "Calcular cotas" também recalcula; "Encerrar o mês" também vale direto das escolhas (o sistema avisa para fechar antes)
  const acao = (i: number) => {
    if (i === 0 && etapa !== 'encerrada') return { rotulo: 'Calcular cotas', principal: atual === 0, desligado: ocupado || !podeCalcular, aoClicar: aoCalcular };
    if (i === 1 && etapa === 'escolhas') return { rotulo: 'Fechar a escala', principal: true, desligado: ocupado, aoClicar: aoFechar };
    if (i === 2 && (etapa === 'escolhas' || etapa === 'fechada')) return { rotulo: 'Encerrar o mês', principal: etapa === 'fechada', desligado: ocupado, aoClicar: aoEncerrar };
    return null;
  };
  return (
    <ol className="flex flex-col gap-3 xl:flex-row xl:gap-0" aria-label="Etapas do mês">
      {PASSOS.map((p, i) => {
        const feito = i < atual;
        const eAtual = i === atual;
        const a = i < PASSOS.length - 1 ? acao(i) : null;
        return (
          <li key={p.nome} aria-current={eAtual ? 'step' : undefined} className={cn('flex flex-col xl:flex-row xl:items-start', i < PASSOS.length - 1 ? 'xl:flex-1' : '')}>
            <div className="flex shrink-0 gap-3 xl:w-44 xl:flex-col xl:gap-1.5">
              <span
                aria-hidden
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border text-[13px] leading-none font-semibold',
                  eAtual ? 'border-tinta bg-tinta text-white' : feito ? 'border-tinta text-tinta' : 'border-encaixe text-apagado',
                )}
              >
                {feito ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <div className="grid gap-0.5">
                <h3 className={cn('text-[15px] leading-[22px]', eAtual ? 'font-semibold text-tinta' : 'text-apagado')}>
                  {p.nome}
                  {feito && <span className="sr-only">{" feito"}</span>}
                </h3>
                <p className="text-[13px] leading-[18px] text-apagado">{p.frase}</p>
              </div>
            </div>
            {i < PASSOS.length - 1 && (
              // no computador, a seta é uma linha entre os passos, com a ação por cima; no celular, os passos ficam em coluna e a seta desce pela esquerda, com a ação ao lado
              <div className="relative flex min-h-6 items-center max-xl:ml-3 max-xl:min-h-10 max-xl:border-l-2 max-xl:border-linha max-xl:pl-6 xl:flex-1 xl:justify-center">
                <span aria-hidden className={cn('absolute top-3 right-0 left-0 h-0.5 bg-linha max-xl:hidden')} />
                <span
                  aria-hidden
                  data-seta-feita={feito ? '' : undefined}
                  className="absolute top-3 left-0 h-0.5 bg-tinta transition-[width] duration-[220ms] motion-reduce:transition-none max-xl:hidden"
                  style={{ width: feito ? '100%' : '0%' }}
                />
                <ChevronRight aria-hidden className={cn('absolute top-[5px] right-0 size-3.5 max-xl:hidden', feito ? 'text-tinta' : 'text-encaixe')} />
                {a && (
                  <Button type="button" size="sm" variant={a.principal ? 'default' : 'outline'} disabled={a.desligado} onClick={a.aoClicar} className="relative z-10 xl:-mt-1 xl:self-start">
                    {a.rotulo}
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
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
            <Button type="button" size="sm" variant="outline" onClick={aoDesistir}>Voltar</Button>
          </div>
        </Caixa>
      )}
      {confirmacao === 'encerrar-antes' && (
        <Caixa rotulo="Aviso">
          <p>Feche a escala antes de encerrar o mês: o saldo é calculado com a escala fechada.</p>
          <div><Button type="button" size="sm" variant="outline" onClick={aoDesistir}>Entendi</Button></div>
        </Caixa>
      )}
      {confirmacao === 'encerrar' && (
        <Caixa rotulo="Confirmação">
          <p>
            <b>Encerrar {mesPorExtenso(e.mes)}?</b> O saldo do mês é calculado com a escala como está e somado ao acumulado. Depois disso, só um ajuste no painel de saldo muda os números.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={aoEncerrar}>Encerrar o mês</Button>
            <Button type="button" size="sm" variant="outline" onClick={aoDesistir}>Voltar</Button>
          </div>
        </Caixa>
      )}
      {confirmacao === 'calcular-fechada' && (
        <Caixa rotulo="Aviso">
          <p>Com a escala fechada, a cota não muda mais. Se alguém sair agora, troque o nome no turno: vira cobertura.</p>
          <div><Button type="button" size="sm" variant="outline" onClick={aoDesistir}>Entendi</Button></div>
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
