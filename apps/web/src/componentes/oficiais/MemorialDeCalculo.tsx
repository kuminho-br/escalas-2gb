import { mesPorExtenso, type ContaDasCotas, type MemorialDaEscala, type RegistroDoMemorial, type ServicoDoMemorial } from 'contratos';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { mensagemDe } from '@/api/cliente';
import { consultaMemorialDosOficiais } from '@/api/oficiais';
import { Button } from '@/componentes/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table';
import { formatarDevido } from '@/lib/numeros-do-saldo';

interface Props {
  unidadeId: string;
  mes: string;
  escalaId?: string;
}

const dm = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** A conta em frases curtas, como as cotas foram distribuídas: turnos, JES, rodada, quem participa, a sobra e quem ficou com ela. */
export function frasesDaConta(c: ContaDasCotas): string[] {
  const frases = [
    `O mês tem ${c.turnos} turnos.`,
    c.jes > 0 ? `Menos ${c.jes} de JES, lançados à mão.` : 'Nenhum turno de JES foi lançado.',
    `Sobram ${c.rodada} turnos para a rodada de Saldo.`,
    `Participam ${c.participantes.length} oficiais.`,
  ];
  if (c.sobraram > 0) {
    const quem = c.participantes.filter((p) => p.sobra).map((p) => p.nomeGuerra).join(', ');
    frases.push(`Depois do arredondamento sobraram ${c.sobraram}, entregues aos mais modernos da ordem: ${quem}.`);
  }
  return frases;
}

function Conta({ conta }: { conta: ContaDasCotas }) {
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1 text-[15px] leading-[22px]">
        {frasesDaConta(conta).map((f) => <li key={f}>{f}</li>)}
      </ul>
      <Table>
        <caption className="sr-only">Quanto deu para cada oficial</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Oficial</TableHead>
            <TableHead>Dias no mês</TableHead>
            <TableHead>Devido</TableHead>
            <TableHead>Cota</TableHead>
            <TableHead>Sobra</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conta.participantes.map((p) => (
            <TableRow key={p.militarId}>
              <TableCell>
                <span className="text-[13px] text-apagado">{p.patente}</span> <b className="font-cond font-semibold">{p.nomeGuerra}</b>
              </TableCell>
              <TableCell>
                {p.diasNoMes}
                {p.afastamentos.map((a) => (
                  <span key={a.inicio} className="block text-[13px] leading-[18px] text-pendencia">{`${a.tipo}, ${dm(a.inicio)} a ${dm(a.fim)}`}</span>
                ))}
              </TableCell>
              <TableCell className="tabular-nums">{formatarDevido(p.devido)}</TableCell>
              <TableCell className="tabular-nums">{p.cota}</TableCell>
              <TableCell>{p.sobra ? '+1' : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Servicos({ servicos }: { servicos: ServicoDoMemorial[] }) {
  const linhas = new Map<string, { patente: string; nome: string; jes: number; saldo: number; cobriu: number }>();
  for (const s of servicos) {
    const l = linhas.get(s.nomeGuerra) ?? { patente: s.patente, nome: s.nomeGuerra, jes: 0, saldo: 0, cobriu: 0 };
    if (s.servico === 'jes') l.jes += 1;
    else l.saldo += 1;
    if (s.cobriu) l.cobriu += 1;
    linhas.set(s.nomeGuerra, l);
  }
  if (linhas.size === 0) return <p className="text-apagado">Nenhum serviço lançado neste mês.</p>;
  return (
    <Table>
      <caption className="sr-only">Os serviços do mês, por oficial</caption>
      <TableHeader>
        <TableRow>
          <TableHead>Oficial</TableHead>
          <TableHead>JES</TableHead>
          <TableHead>Saldo</TableHead>
          <TableHead>Coberturas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...linhas.values()].map((l) => (
          <TableRow key={l.nome}>
            <TableCell><span className="text-[13px] text-apagado">{l.patente}</span> <b className="font-cond font-semibold">{l.nome}</b></TableCell>
            <TableCell className="tabular-nums">{l.jes}</TableCell>
            <TableCell className="tabular-nums">{l.saldo}</TableCell>
            <TableCell className="tabular-nums">{l.cobriu}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Registro({ r }: { r: RegistroDoMemorial }) {
  return (
    <li className="grid gap-0.5">
      <p className="text-[15px] font-medium">{r.motivo}</p>
      <p className="text-[13px] leading-[18px] text-apagado">
        {dataHora(r.criadoEm)}
        {r.por ? ` · ${r.por.patente} ${r.por.nomeGuerra}` : ''}
      </p>
    </li>
  );
}

/**
 * A aba "Memorial de cálculo": a conta atual das cotas, a tabela de cada oficial, os serviços do mês e o histórico de cada recálculo (o último aberto e os
 * outros recolhidos). "Imprimir" sai só o memorial. Um mês gravado antes do memorial mostra a conta atual e a frase de que o histórico começa agora.
 */
export function MemorialDeCalculo({ unidadeId, mes, escalaId }: Props) {
  const q = useQuery(consultaMemorialDosOficiais(unidadeId, mes, escalaId));
  if (q.isPending) return <p className="text-apagado">Carregando…</p>;
  if (q.error) return <p role="alert" className="text-alerta">{mensagemDe(q.error)}</p>;
  const m: MemorialDaEscala | undefined = q.data;
  if (!m || !m.contaAtual) return <p className="text-apagado">Ainda não há cotas para este mês: abra o mês para o memorial começar.</p>;
  const [ultimo, ...anteriores] = m.registros;
  return (
    <section aria-label="Memorial de cálculo" className="memorial-impressao grid gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-cond text-[20px] leading-[26px] font-semibold">Memorial de cálculo de {mesPorExtenso(mes)}</h2>
        <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
          <Printer aria-hidden /> Imprimir
        </Button>
      </header>

      <div className="grid gap-2">
        <h3 className="text-[17px] leading-6 font-semibold">Como as cotas foram distribuídas</h3>
        {!ultimo && <p className="text-[15px] text-apagado">Cálculo refeito agora: o histórico começa nesta versão.</p>}
        <Conta conta={m.contaAtual} />
      </div>

      <div className="grid gap-2">
        <h3 className="text-[17px] leading-6 font-semibold">Quem tirou cada serviço</h3>
        <Servicos servicos={m.servicos} />
      </div>

      <div className="grid gap-2">
        <h3 className="text-[17px] leading-6 font-semibold">Histórico dos recálculos</h3>
        {ultimo ? (
          <>
            <ul className="grid gap-2">
              <Registro r={ultimo} />
            </ul>
            {anteriores.length > 0 && (
              <details className="rounded-md border border-linha p-3">
                <summary className="cursor-pointer text-[15px] font-medium">Ver os {anteriores.length} recálculos anteriores</summary>
                <ul className="mt-2 grid gap-2">
                  {anteriores.map((r) => <Registro key={r.criadoEm + r.motivo} r={r} />)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="text-[15px] text-apagado">Nenhum recálculo gravado ainda.</p>
        )}
      </div>
    </section>
  );
}
