import type { Faixa } from 'dominio';
import { Clock, Plus, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { horaDe, validarHorario } from '@/lib/voluntariado';
import { cn } from '@/lib/utils';

type Linha = { inicio: string; fim: string; tocadoInicio: boolean; tocadoFim: boolean };
const vazia = (l: Linha) => l.inicio === '' && l.fim === '';
const deFaixa = (f: Faixa): Linha => ({ inicio: horaDe(f.inicio), fim: horaDe(f.fim), tocadoInicio: true, tocadoFim: true });

/** O que a linha tem de errado: o texto por campo, e se a linha tem erro de qualquer forma (mesmo o que ainda não vale mostrar: a pessoa está digitando). */
function conferir(l: Linha) {
  if (vazia(l)) return { erroInicio: null, erroFim: null, faixa: null, erra: false };
  const v = validarHorario(l.inicio, l.fim);
  // o erro só aparece quando o campo foi deixado ou já tem o tamanho de uma hora; enquanto digita, não pisca
  const mostrar = (texto: string, tocado: boolean) => tocado || texto.length >= 5;
  return {
    erroInicio: v.erroInicio && mostrar(l.inicio, l.tocadoInicio) ? v.erroInicio : null,
    erroFim: v.erroFim && mostrar(l.fim, l.tocadoFim) ? v.erroFim : null,
    faixa: v.faixa,
    erra: v.faixa === null,
  };
}

/**
 * O botão "Outro horário" de um dia e o painel dele (7.2): horários fora dos blocos, "das HH:MM às HH:MM", um ou mais. `faixas` são as do dia que não são feitas de blocos
 * inteiros; cada mudança certa vai ao calendário na hora (`aoMudar`), e o calendário não deixa salvar enquanto houver horário com erro. Só para ver (`soLeitura`): o painel
 * mostra os horários e não muda nada.
 */
export function OutroHorario({ dia, faixas, aoMudar, soLeitura = false, celular = false }: { dia: number; faixas: Faixa[]; aoMudar: (faixas: Faixa[], comErro: boolean) => void; soLeitura?: boolean; celular?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const id = useId();
  const comErro = linhas.some((l) => conferir(l).erra);
  const abrirOuFechar = (v: boolean) => {
    // ao abrir, o painel mostra o que o dia tem; um rascunho com erro fica como a pessoa deixou
    if (v && !comErro) setLinhas(faixas.map(deFaixa));
    setAberto(v);
  };
  const mudar = (novas: Linha[]) => {
    setLinhas(novas);
    aoMudar(novas.flatMap((l) => conferir(l).faixa ?? []), novas.some((l) => conferir(l).erra));
  };
  const editar = (i: number, campo: 'inicio' | 'fim', texto: string) => mudar(linhas.map((l, k) => (k === i ? { ...l, [campo]: texto } : l)));
  const deixar = (i: number, campo: 'inicio' | 'fim') => setLinhas((ls) => ls.map((l, k) => (k === i ? { ...l, [campo === 'inicio' ? 'tocadoInicio' : 'tocadoFim']: true } : l)));
  if (soLeitura && faixas.length === 0) return null;
  return (
    <Popover.Root open={aberto} onOpenChange={abrirOuFechar}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Outro horário do dia ${dia}`}
          title="Outro horário"
          className={cn(
            'grid shrink-0 place-items-center justify-self-end rounded-controle text-apagado hover:bg-accent hover:text-tinta',
            celular ? 'size-11' : 'size-7',
            (faixas.length > 0 || comErro) && 'text-tinta',
            comErro && 'ring-2 ring-alerta',
          )}
        >
          <Clock aria-hidden className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={16} aria-label={`Horários extras do dia ${dia}`} className="z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-lg border border-linha bg-superficie p-3 shadow-lg">
          <p className="font-cond text-base font-semibold">{`Outro horário, dia ${dia}`}</p>
          {linhas.length === 0 && <p className="text-sm text-apagado">{soLeitura ? 'Nenhum horário fora dos blocos.' : 'Nenhum horário fora dos blocos. Adicione um para marcar, por exemplo, das 09:30 às 11:00.'}</p>}
          <ul className="grid gap-2">
            {linhas.map((l, i) => {
              const c = conferir(l);
              const idErro = `${id}-erro-${i}`;
              return (
                <li key={i} className="grid gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-apagado">das</span>
                    <input
                      aria-label={`Início do horário ${i + 1}`}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="08:00"
                      value={l.inicio}
                      readOnly={soLeitura}
                      aria-invalid={c.erroInicio ? true : undefined}
                      aria-describedby={c.erroInicio ? idErro : undefined}
                      onChange={(e) => editar(i, 'inicio', e.target.value)}
                      onBlur={() => deixar(i, 'inicio')}
                      className={cn('h-(--altura-controle) w-20 rounded-controle border border-encaixe bg-superficie px-2 text-center text-corpo', c.erroInicio && 'border-alerta')}
                    />
                    <span className="text-sm text-apagado">às</span>
                    <input
                      aria-label={`Fim do horário ${i + 1}`}
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="12:00"
                      value={l.fim}
                      readOnly={soLeitura}
                      aria-invalid={c.erroFim ? true : undefined}
                      aria-describedby={c.erroFim ? idErro : undefined}
                      onChange={(e) => editar(i, 'fim', e.target.value)}
                      onBlur={() => deixar(i, 'fim')}
                      className={cn('h-(--altura-controle) w-20 rounded-controle border border-encaixe bg-superficie px-2 text-center text-corpo', c.erroFim && 'border-alerta')}
                    />
                    {!soLeitura && (
                      <button type="button" aria-label={`Tirar o horário ${i + 1}`} onClick={() => mudar(linhas.filter((_, k) => k !== i))} className="grid size-9 shrink-0 place-items-center rounded-controle text-apagado hover:bg-accent hover:text-tinta">
                        <X aria-hidden className="size-4" />
                      </button>
                    )}
                  </div>
                  {(c.erroInicio ?? c.erroFim) && <p id={idErro} role="alert" className="text-sm text-alerta">{c.erroInicio ?? c.erroFim}</p>}
                </li>
              );
            })}
          </ul>
          {!soLeitura && (
            <Button type="button" size="sm" variant="secundario" className="justify-self-start" onClick={() => setLinhas([...linhas, { inicio: '', fim: '', tocadoInicio: false, tocadoFim: false }])}>
              <Plus aria-hidden className="size-4" />
              Adicionar horário
            </Button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
