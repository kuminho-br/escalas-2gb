import { useQueryClient } from '@tanstack/react-query';
import type { OficialNoSaldo } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { lancarAjuste } from '@/api/oficiais';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Textarea } from '@/componentes/ui/textarea';
import { formatarSaldo } from '@/lib/numeros-do-saldo';

const MSG_VALOR = 'Informe um valor diferente de zero, de até 100.';
const MSG_MOTIVO = 'Diga o motivo do ajuste.';

/** O registro de um oficial: os lançamentos e as coberturas, do mais novo para o mais velho, e o ajuste manual do gestor. */
export function RegistroDoOficial({ unidadeId, escalaId, oficial: o }: { unidadeId: string; escalaId?: string; oficial: OficialNoSaldo }) {
  const queryClient = useQueryClient();
  const { salvando, travar } = useTrava();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState<{ valor?: string; motivo?: string; geral?: string }>({});
  const entrada = o.registro.find((r) => r.tipo === 'entrada');
  const fechar = () => {
    setAberto(false);
    setValor('');
    setMotivo('');
    setErros({});
  };
  const lancar = travar(async () => {
    const n = Number(valor.trim().replace(',', '.'));
    const e: typeof erros = {};
    if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 100 || valor.trim() === '') e.valor = MSG_VALOR;
    if (motivo.trim() === '') e.motivo = MSG_MOTIVO;
    setErros(e);
    if (e.valor || e.motivo) return;
    try {
      await lancarAjuste(queryClient, unidadeId, o.militarId, n, motivo.trim(), escalaId);
      fechar();
    } catch (x) {
      setErros({ geral: mensagemDe(x) });
    }
  });
  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    void lancar();
  };
  return (
    <section aria-label="Registro" className="grid content-start gap-3 rounded-lg border border-linha bg-superficie p-3">
      <header>
        <h2 className="font-cond text-lg font-semibold">{`Registro: ${o.posto} ${o.nomeGuerra} ${o.matricula}`}</h2>
      </header>
      {entrada && <p className="text-sm">Começou com <b>{formatarSaldo(entrada.valor ?? 0)}</b>, a média dos saldos dos colegas.</p>}
      <ul className="grid gap-1.5 text-sm">
        {[...o.registro].reverse().map((r, i) => (
          <li key={`${r.tipo}|${r.data}|${i}`} className="flex items-baseline justify-between gap-3 border-t border-linha pt-1.5 first:border-0 first:pt-0">
            <span>{r.texto}</span>
            {r.valor !== null && r.tipo !== 'saiu' && <b className="tabular-nums">{formatarSaldo(r.valor)}</b>}
          </li>
        ))}
      </ul>
      <p className="text-sm">Saldo agora: <b>{formatarSaldo(o.saldo)}</b></p>
      {!aberto ? (
        <div>
          <Button type="button" variant="secundario" size="sm" onClick={() => setAberto(true)}>Ajuste manual</Button>
        </div>
      ) : (
        <form onSubmit={enviar} className="grid gap-2 rounded-md border border-linha p-2.5" noValidate>
          <div className="grid gap-1">
            <Label htmlFor="ajuste-valor">Valor do ajuste</Label>
            <Input id="ajuste-valor" inputMode="decimal" value={valor} onChange={(ev) => setValor(ev.target.value)} aria-invalid={!!erros.valor} className="w-36" placeholder="ex.: 0,5 ou -1" />
            {erros.valor && <p className="text-xs text-alerta">{erros.valor}</p>}
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ajuste-motivo">Motivo (obrigatório)</Label>
            <Textarea id="ajuste-motivo" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} maxLength={200} aria-invalid={!!erros.motivo} rows={2} />
            {erros.motivo && <p className="text-xs text-alerta">{erros.motivo}</p>}
          </div>
          {erros.geral && <p role="alert" className="text-sm text-alerta">{erros.geral}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={salvando}>Lançar ajuste</Button>
            <Button type="button" size="sm" variant="secundario" onClick={fechar}>Cancelar</Button>
          </div>
        </form>
      )}
    </section>
  );
}
