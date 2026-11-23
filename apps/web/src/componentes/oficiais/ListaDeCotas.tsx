import { mesPorExtenso, type EscalaDosOficiais } from 'contratos';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { formatarSaldo } from '@/lib/numeros-do-saldo';

type Oficial = EscalaDosOficiais['oficiais'][number];

interface Props {
  escala: EscalaDosOficiais;
  /** Grava a ordem à mão (os ids de quem não tem antiguidade, na ordem nova); sem ela, os botões não aparecem. */
  aoOrdenar?: (militarIds: string[]) => void;
  /** Grava quem participa da rodada (a lista inteira dos marcados); sem ela, a marca fica só para leitura. */
  aoMarcar?: (militarIds: string[]) => void;
  desabilitado?: boolean;
}

/** A vez de escolher: quem é, a posição e quanto já lançou. */
export function VezDeEscolher({ escala: e }: { escala: EscalaDosOficiais }) {
  if (e.etapa !== 'escolhas') return null;
  const v = e.oficiais.find((o) => o.militarId === e.vez);
  return (
    <section aria-label="Vez de escolher" className="rounded-lg border border-linha bg-superficie p-3">
      <small className="text-apagado">Vez de escolher</small>
      {v ? (
        <>
          <p className="font-semibold">{`${v.posto} ${v.nomeGuerra}, ${v.ordem}º na ordem`}</p>
          <p className="text-sm text-apagado">
            Já lançou {v.escolhidos} de {v.cota}. Clique num turno livre para lançar a escolha dele.
            {v.afastamentos.length > 0 && ` Os dias de afastamento não são oferecidos.`}
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">Todos escolheram</p>
          <p className="text-sm text-apagado">Confira os turnos e feche a escala.</p>
        </>
      )}
    </section>
  );
}

/**
 * A lista de cotas do mês: a marca de quem participa da rodada, a ordem, o oficial, o saldo até o mês anterior, os dias presentes, a cota e quanto já
 * escolheu. Com a escala aberta, aparecem todos os elegíveis; fechada, só quem participa.
 */
export function ListaDeCotas({ escala: e, aoOrdenar, aoMarcar, desabilitado }: Props) {
  const comCota = e.etapa !== 'sem-cotas';
  const aberta = e.etapa === 'sem-cotas' || e.etapa === 'escolhas';
  const oficiais = aberta ? e.oficiais : e.oficiais.filter((o) => o.participa);
  const marcados = e.oficiais.filter((o) => o.participa).map((o) => o.militarId);
  const marcar = (o: Oficial, participa: boolean) =>
    aoMarcar?.(participa ? e.oficiais.filter((x) => x.participa || x.militarId === o.militarId).map((x) => x.militarId) : marcados.filter((id) => id !== o.militarId));
  const total = e.turnos.length;
  const sobras = e.oficiais.filter((o) => o.sobra).length;
  const podeOrdenar = !!aoOrdenar && e.etapa !== 'fechada' && e.etapa !== 'encerrada';
  // "Subir" e "Descer" só trocam de lugar quem não tem antiguidade, entre os do mesmo posto
  // a ordem só vale entre quem participa
  const vizinho = (i: number, passo: -1 | 1): number | null => {
    const a = oficiais[i]!;
    const b = oficiais[i + passo];
    return a.participa && a.semAntiguidade && b && b.participa && b.semAntiguidade && b.posto === a.posto ? i + passo : null;
  };
  const mover = (i: number, passo: -1 | 1) => {
    const j = vizinho(i, passo);
    if (j === null || !aoOrdenar) return;
    const lista = oficiais.filter((o) => o.participa);
    [lista[i], lista[j]] = [lista[j]!, lista[i]!];
    aoOrdenar(lista.filter((o) => o.semAntiguidade).map((o) => o.militarId));
  };
  const linha = (o: Oficial, i: number) => {
    const sobe = podeOrdenar && vizinho(i, -1) !== null;
    const desce = podeOrdenar && vizinho(i, 1) !== null;
    return (
      <tr key={o.militarId} className={`border-t border-linha ${o.militarId === e.vez ? 'bg-pendencia-fundo/50' : ''} ${o.participa ? '' : 'text-apagado'}`}>
        <td className="px-2 py-1.5 text-center">
          <input
            type="checkbox"
            aria-label={`${o.posto} ${o.nomeGuerra} participa da rodada`}
            checked={o.participa}
            disabled={!aoMarcar || !aberta || desabilitado}
            onChange={(ev) => marcar(o, ev.target.checked)}
            className="size-4 accent-vinho"
          />
        </td>
        <td className="px-2 py-1.5 text-center text-apagado">{o.participa ? o.ordem : '—'}</td>
        <td className="px-2 py-1.5">
          <b className="whitespace-nowrap">{o.posto} {o.nomeGuerra}</b> <span className="text-xs text-apagado">{o.quadro}</span>
          {o.novo && <span className="ml-1 rounded border border-linha px-1 text-xs text-tinta">novo</span>}
          <small className="block text-apagado">
            {o.lotacao}
            {o.semAntiguidade && ' · ordenado à mão'}
          </small>
          {o.afastamentos.map((a) => (
            <small key={a.inicio} className="block text-pendencia">{a.tipo}, {a.inicio.slice(8)}/{a.inicio.slice(5, 7)} a {a.fim.slice(8)}/{a.fim.slice(5, 7)}</small>
          ))}
          {(sobe || desce) && (
            <span className="mt-0.5 flex gap-1">
              {sobe && (
                <Button type="button" variant="outline" size="xs" disabled={desabilitado} aria-label={`Subir ${o.nomeGuerra}`} onClick={() => mover(i, -1)}>
                  <ArrowUp aria-hidden /> Subir
                </Button>
              )}
              {desce && (
                <Button type="button" variant="outline" size="xs" disabled={desabilitado} aria-label={`Descer ${o.nomeGuerra}`} onClick={() => mover(i, 1)}>
                  <ArrowDown aria-hidden /> Descer
                </Button>
              )}
            </span>
          )}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">{formatarSaldo(o.saldoAnterior)}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">{o.dias}</td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          {o.cota ?? '—'}
          {o.sobra && <em className="block text-xs not-italic text-apagado">+1 sobra</em>}
        </td>
        {comCota && (
          <td className="px-2 py-1.5 tabular-nums">
            {o.escolhidos} de {o.cota}
            {o.cota !== null && o.escolhidos > o.cota && <em className="block text-xs not-italic text-pendencia">{o.escolhidos - o.cota} a mais</em>}
          </td>
        )}
      </tr>
    );
  };
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <table aria-label={`Cotas de ${mesPorExtenso(e.mes)}`} className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-apagado">
              <th scope="col" className="px-2 py-1 text-center font-medium" title="Quem entra nas cotas, na vez de escolher e nos turnos deste mês">Participa</th>
              <th scope="col" className="px-2 py-1 text-center font-medium" title="Ordem de escolha">Ordem</th>
              <th scope="col" className="px-2 py-1 font-medium">Oficial</th>
              <th scope="col" className="px-2 py-1 text-right font-medium" title="Saldo acumulado até o mês anterior">Saldo</th>
              <th scope="col" className="px-2 py-1 text-right font-medium" title="Dias presentes no mês">Dias</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Cota</th>
              {comCota && <th scope="col" className="px-2 py-1 font-medium">Escolhidos</th>}
            </tr>
          </thead>
          <tbody>{oficiais.map(linha)}</tbody>
        </table>
      </div>
      <p className="text-xs text-apagado">
        {comCota ? `${total} turnos no mês.${sobras > 0 ? ` Depois do arredondamento, sobraram ${sobras}, entregues aos ${sobras} mais modernos.` : ''} ` : ''}O saldo aparece na lista, mas ainda não entra na conta.
      </p>
    </div>
  );
}
