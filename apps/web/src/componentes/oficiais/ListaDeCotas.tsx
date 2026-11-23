import { mesPorExtenso, type EscalaDosOficiais } from 'contratos';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { formatarSaldo } from '@/lib/numeros-do-saldo';
import { cn } from '@/lib/utils';

type Oficial = EscalaDosOficiais['oficiais'][number];

interface Props {
  escala: EscalaDosOficiais;
  /** Grava a ordem à mão (os ids de quem não tem antiguidade, na ordem nova); sem ela, os botões não aparecem. */
  aoOrdenar?: (militarIds: string[]) => void;
  /** Grava quem participa da rodada (a lista inteira dos marcados); sem ela, a marca fica só para leitura. */
  aoMarcar?: (militarIds: string[]) => void;
  desabilitado?: boolean;
}

/** A vez de escolher: quem é (em 20 px), a posição e quantos turnos ainda faltam para ele. */
export function VezDeEscolher({ escala: e }: { escala: EscalaDosOficiais }) {
  if (e.etapa !== 'escolhas') return null;
  const v = e.oficiais.find((o) => o.militarId === e.vez);
  const faltam = v && v.cota !== null ? Math.max(v.cota - v.escolhidos, 0) : null;
  return (
    <section aria-label="Vez de escolher" className="rounded-xl border border-linha bg-superficie p-4">
      <small className="text-[13px] text-apagado">Vez de escolher</small>
      {v ? (
        <>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-cond text-[20px] leading-[26px] font-semibold">{`${v.posto} ${v.nomeGuerra}`}</span>
            <span className="text-[15px] text-apagado">{`${v.ordem}º na ordem`}</span>
          </p>
          {faltam !== null && <p className="text-[15px]">{faltam === 1 ? 'Falta 1 turno para ele.' : `Faltam ${faltam} turnos para ele.`}</p>}
          <p className="text-[13px] text-apagado">
            Clique num turno livre para lançar a escolha dele. A ordem é uma sugestão: dá para lançar outro oficial.
            {v.afastamentos.length > 0 && ` Os dias de afastamento não são oferecidos.`}
          </p>
        </>
      ) : (
        <>
          <p className="font-cond text-[20px] leading-[26px] font-semibold">Todos escolheram</p>
          <p className="text-[15px] text-apagado">Confira os turnos e feche a escala.</p>
        </>
      )}
    </section>
  );
}

/**
 * A lista de cotas do mês, uma linha por oficial: a marca de quem participa da rodada, a ordem, o oficial, o saldo até o mês anterior, os dias presentes, a cota e
 * quanto já escolheu (com uma barra fina), mais os afastamentos. Com a escala aberta, aparecem todos os elegíveis; fechada, só quem participa.
 */
export function ListaDeCotas({ escala: e, aoOrdenar, aoMarcar, desabilitado }: Props) {
  const comCota = e.etapa !== 'nao-aberto';
  const aberta = e.etapa === 'nao-aberto' || e.etapa === 'escolhas';
  const oficiais = aberta ? e.oficiais : e.oficiais.filter((o) => o.participa);
  const marcados = e.oficiais.filter((o) => o.participa).map((o) => o.militarId);
  // desmarcar quem já tem turnos escolhidos deixa esses turnos sem ninguém: o sistema pergunta antes (decisão de 23/11); sem turnos escolhidos, desmarca direto
  const [tirando, setTirando] = useState<Oficial | null>(null);
  const pedirMarca = (o: Oficial, participa: boolean) => {
    if (!participa && o.escolhidos > 0) setTirando(o);
    else marcar(o, participa);
  };
  // o mais que alguém tem de dias no mês: quem tem menos tem a cota menor, e a linha diz por quê (afastamento, ou só menos dias na unidade)
  const maisDias = comCota ? Math.max(0, ...e.oficiais.filter((o) => o.cota !== null).map((o) => o.dias)) : 0;
  const diasAfastado = (o: Oficial) => {
    const primeiro = `${e.mes}-01`;
    const ultimo = `${e.mes}-${String(new Date(Date.UTC(Number(e.mes.slice(0, 4)), Number(e.mes.slice(5, 7)), 0)).getUTCDate()).padStart(2, '0')}`;
    const dias = new Set<string>();
    for (const a of o.afastamentos) {
      for (let d = new Date(`${a.inicio < primeiro ? primeiro : a.inicio}T00:00:00Z`); d.toISOString().slice(0, 10) <= (a.fim > ultimo ? ultimo : a.fim); d.setUTCDate(d.getUTCDate() + 1)) dias.add(d.toISOString().slice(0, 10));
    }
    return dias.size;
  };
  const frasesDaCotaMenor = (o: Oficial): string | null => {
    if (o.cota === null || o.dias >= maisDias) return null;
    const afastado = diasAfastado(o);
    if (afastado > 0) return `cota menor: afastado ${afastado} ${afastado === 1 ? 'dia' : 'dias'}`;
    const menos = maisDias - o.dias;
    return `cota menor: ${menos} ${menos === 1 ? 'dia' : 'dias'} a menos no mês`;
  };
  const marcar = (o: Oficial, participa: boolean) =>
    aoMarcar?.(participa ? e.oficiais.filter((x) => x.participa || x.militarId === o.militarId).map((x) => x.militarId) : marcados.filter((id) => id !== o.militarId));
  const total = e.lugaresDeSaldo;
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
    const daVez = o.militarId === e.vez && e.etapa === 'escolhas';
    // a barra fina do quanto já foi escolhido da cota (cheia quando passa dela)
    const feito = o.cota ? Math.min(Math.round((o.escolhidos / o.cota) * 100), 100) : 0;
    const numero = 'font-cond text-[17px] leading-6 font-semibold tabular-nums';
    const comVermelhos = comCota && e.diasVermelhos.length > 0;
    const rotulo = 'text-[13px] leading-[18px] text-apagado';
    return (
      <li key={o.militarId} className={cn('grid gap-2 rounded-xl border p-3', daVez ? 'border-vinho bg-pendencia-fundo' : 'border-linha bg-superficie', !o.participa && 'text-apagado')}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            aria-label={`${o.posto} ${o.nomeGuerra} participa da rodada`}
            checked={o.participa}
            disabled={!aoMarcar || !aberta || desabilitado}
            onChange={(ev) => pedirMarca(o, ev.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-vinho"
          />
          <span className="w-6 shrink-0 text-center font-cond text-[17px] leading-6 font-semibold tabular-nums text-apagado" title="Ordem de escolha">{o.participa ? o.ordem : '—'}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="shrink-0 text-[13px] leading-[18px] font-medium text-apagado">{o.posto}</span>
              <b className={cn('font-cond text-[17px] leading-6 font-semibold', o.participa && 'text-tinta')}>{o.nomeGuerra}</b>
              {o.novo && <span className="rounded-md border border-linha px-2 text-[13px] font-medium text-tinta">novo</span>}
            </p>
            <p className="text-[13px] leading-[18px] text-apagado">
              {o.quadro} · {o.lotacao}
              {o.semAntiguidade && ' · ordenado à mão'}
              {o.jes > 0 && ` · ${o.jes} JES`}
            </p>
          </div>
          {(sobe || desce) && (
            <span className="flex shrink-0 gap-1">
              {sobe && (
                <Button type="button" variant="outline" size="sm" disabled={desabilitado} aria-label={`Subir ${o.nomeGuerra}`} onClick={() => mover(i, -1)}>
                  <ArrowUp aria-hidden /> Subir
                </Button>
              )}
              {desce && (
                <Button type="button" variant="outline" size="sm" disabled={desabilitado} aria-label={`Descer ${o.nomeGuerra}`} onClick={() => mover(i, 1)}>
                  <ArrowDown aria-hidden /> Descer
                </Button>
              )}
            </span>
          )}
        </div>
        <dl className={cn('grid gap-x-3 gap-y-1', comCota ? (comVermelhos ? 'grid-cols-4' : 'grid-cols-3') : 'grid-cols-2')}>
          <div title="Saldo acumulado até o mês anterior">
            <dt className={rotulo}>Saldo</dt>
            <dd className={numero}>{formatarSaldo(o.saldoAnterior)}</dd>
          </div>
          <div title={`${o.dias} dias disponíveis no mês`}>
            <dt className={rotulo}>Cota</dt>
            <dd className={numero}>{o.cota ?? '—'}</dd>
            {o.sobra && <dd className={rotulo}>+1 sobra</dd>}
            {frasesDaCotaMenor(o) && <dd className={rotulo}>{frasesDaCotaMenor(o)}</dd>}
          </div>
          {comCota && (
            <div>
              <dt className={rotulo}>Escolhidos</dt>
              <dd className={numero}>{o.escolhidos} de {o.cota}</dd>
              {o.cota !== null && o.escolhidos > o.cota && <dd className="text-[13px] leading-[18px] font-medium text-pendencia">{o.escolhidos - o.cota} a mais</dd>}
            </div>
          )}
          {comVermelhos && (
            <div title="Lugares em dia vermelho que ele tomou no mês">
              <dt className={rotulo}>Vermelhos</dt>
              <dd className={numero}>{o.vermelhos}</dd>
            </div>
          )}
        </dl>
        {comCota && o.cota !== null && (
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-linha">
            <div data-barra className={cn('h-full rounded-full', o.escolhidos > o.cota ? 'bg-pendencia' : 'bg-tinta')} style={{ width: `${feito}%` }} />
          </div>
        )}
        {o.afastamentos.map((a) => (
          <p key={a.inicio} className="text-[13px] leading-[18px] text-pendencia">{a.tipo}, {a.inicio.slice(8)}/{a.inicio.slice(5, 7)} a {a.fim.slice(8)}/{a.fim.slice(5, 7)}</p>
        ))}
      </li>
    );
  };
  return (
    <div className="grid gap-3">
      <ul aria-label={`Cotas de ${mesPorExtenso(e.mes)}`} className="grid gap-2">
        {oficiais.map(linha)}
      </ul>
      <Dialog open={tirando !== null} onOpenChange={(aberto) => !aberto && setTirando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tirando ? `Tirar ${tirando.posto} ${tirando.nomeGuerra} da rodada?` : ''}</DialogTitle>
            <DialogDescription>
              {tirando ? (tirando.escolhidos === 1 ? 'O turno escolhido fica sem ninguém.' : `Os ${tirando.escolhidos} turnos escolhidos ficam sem ninguém.`) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTirando(null)}>Cancelar</Button>
            <Button
              type="button"
              onClick={() => {
                if (tirando) marcar(tirando, false);
                setTirando(null);
              }}
            >
              Tirar da rodada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-[13px] leading-[18px] text-apagado">
        {comCota ? `${total} turnos para a rodada de Saldo no mês.${sobras > 0 ? ` Depois do arredondamento, sobraram ${sobras}, entregues aos ${sobras} mais modernos.` : ''} ` : ''}O saldo aparece na lista, mas ainda não entra na conta.
      </p>
    </div>
  );
}
