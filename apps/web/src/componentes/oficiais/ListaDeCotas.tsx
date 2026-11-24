import { mesPorExtenso, type EscalaDosOficiais } from 'contratos';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { formatarSaldo } from '@/lib/numeros-do-saldo';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/componentes/ui/checkbox';

type Oficial = EscalaDosOficiais['oficiais'][number];

interface Props {
  escala: EscalaDosOficiais;
  /** Grava a ordem à mão (os ids de quem não tem antiguidade, na ordem nova); sem ela, os botões não aparecem. */
  aoOrdenar?: (militarIds: string[]) => void;
  /** Grava quem participa da rodada (a lista inteira dos marcados); sem ela, a marca fica só para leitura. */
  aoMarcar?: (militarIds: string[]) => void;
  desabilitado?: boolean;
  /** O oficial escolhido para os próximos cliques no calendário; sem `aoEscolher`, a linha não é um botão. */
  escolhido?: string | null;
  aoEscolher?: (militarId: string) => void;
}

/**
 * A lista de cotas do mês, uma linha por oficial: a marca de quem participa da rodada, a ordem, o oficial, o saldo até o mês anterior, os dias presentes, a cota e
 * quanto já escolheu (com uma barra fina), mais os afastamentos. Com a escala aberta, aparecem todos os elegíveis; fechada, só quem participa.
 */
export function ListaDeCotas({ escala: e, aoOrdenar, aoMarcar, desabilitado, escolhido, aoEscolher }: Props) {
  const comCota = e.etapa !== 'nao-aberto';
  const aberta = e.etapa === 'nao-aberto' || e.etapa === 'escolhas';
  const oficiais = aberta ? e.oficiais : e.oficiais.filter((o) => o.participa);
  const marcados = e.oficiais.filter((o) => o.participa).map((o) => o.militarId);
  // desmarcar quem já tem turnos escolhidos deixa esses turnos sem ninguém: o sistema pergunta antes (decisão de 23/11); sem turnos escolhidos, desmarca direto
  const [tirando, setTirando] = useState<Oficial | null>(null);
  // "Como as cotas foram calculadas": a conta do mês em frases curtas, recolhida
  const [verConta, setVerConta] = useState(false);
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
  const comSobra = e.oficiais.filter((o) => o.sobra);
  const sobras = comSobra.length;
  // a conta do mês, em frases curtas: turnos do mês, menos os de JES, os que sobram para a rodada, quem participa, a divisão, as sobras e os afastamentos
  const turnosDoMes = e.turnos.length;
  const turnosDeJes = e.oficiais.reduce((n, o) => n + o.jes, 0);
  const diasDoMes = new Set(e.turnos.map((t) => t.dia)).size;
  const conta: string[] = [
    `O mês tem ${turnosDoMes} turnos (${diasDoMes} dias, ${e.turnosDoServico.length} por dia).`,
    turnosDeJes > 0 ? `Menos ${turnosDeJes} de JES, lançados à mão.` : 'Nenhum turno de JES foi lançado.',
    `Sobram ${total} turnos para a rodada de Saldo.`,
    `Participam ${e.oficiais.filter((o) => o.cota !== null).length} oficiais.`,
    `A divisão, pela presença de cada um, dá ${total - sobras} turnos inteiros e uma parte quebrada.`,
    ...(sobras > 0 ? [`Depois do arredondamento sobraram ${sobras}, entregues aos ${sobras} mais modernos: ${comSobra.map((o) => o.nomeGuerra).join(', ')}.`] : []),
    ...e.oficiais.flatMap((o) => { const f = frasesDaCotaMenor(o); return f ? [`${o.nomeGuerra}: ${f.replace('cota menor: ', 'cota menor, ')}.`] : []; }),
    'O saldo aparece na lista, mas ainda não entra na conta.',
  ];
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
    const numero = 'font-cond text-nome leading-6 font-semibold tabular-nums';
    const comVermelhos = comCota && e.diasVermelhos.length > 0;
    const rotulo = 'text-apoio leading-[18px] text-apagado';
    return (
      <li key={o.militarId} className={cn('grid gap-1.5 rounded-xl border p-2.5', daVez ? 'border-vinho bg-vinho/10' : 'border-linha bg-superficie', !o.participa && 'text-apagado', o.militarId === escolhido && 'ring-2 ring-tinta')}>
        <div className="flex items-start gap-3">
          <Checkbox
            aria-label={`${o.posto} ${o.nomeGuerra} participa da rodada`}
            checked={o.participa}
            disabled={!aoMarcar || !aberta || desabilitado}
            onChange={(ev) => pedirMarca(o, ev.target.checked)}
            className="mt-0.5"
          />
          <span className="w-6 shrink-0 text-center font-cond text-nome leading-6 font-semibold tabular-nums text-apagado" title="Ordem de escolha">{o.participa ? o.ordem : '—'}</span>
          <button
            type="button"
            data-escolher-oficial
            aria-pressed={o.militarId === escolhido}
            aria-label={`${o.posto} ${o.nomeGuerra}${daVez ? ', a vez' : ''}`}
            disabled={!aoEscolher || !o.participa}
            onClick={() => aoEscolher?.(o.militarId)}
            className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta disabled:cursor-default"
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="shrink-0 text-apoio leading-[18px] font-medium text-apagado">{o.posto}</span>
              <b className={cn('font-cond text-nome leading-6 font-semibold', o.participa && 'text-tinta')}>{o.nomeGuerra}</b>
              {daVez && <span className="rounded-md bg-vinho px-2 text-apoio font-medium text-white">a vez</span>}
            </span>
            <span className="block text-apoio leading-[18px] text-apagado">
              {o.quadro} · {o.lotacao}
              {o.semAntiguidade && ' · ordenado à mão'}
              {o.jes > 0 && ` · ${o.jes} JES`}
            </span>
          </button>
          {(sobe || desce) && (
            <span className="flex shrink-0 gap-1">
              {sobe && (
                <Button type="button" variant="secundario" size="sm" disabled={desabilitado} aria-label={`Subir ${o.nomeGuerra}`} onClick={() => mover(i, -1)}>
                  <ArrowUp aria-hidden /> Subir
                </Button>
              )}
              {desce && (
                <Button type="button" variant="secundario" size="sm" disabled={desabilitado} aria-label={`Descer ${o.nomeGuerra}`} onClick={() => mover(i, 1)}>
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
          </div>
          {comCota && (
            <div>
              <dt className={rotulo}>Escolhidos</dt>
              <dd className={numero}>{o.escolhidos} de {o.cota}</dd>
              {o.cota !== null && o.escolhidos > o.cota && <dd className="text-apoio leading-[18px] font-medium text-pendencia">{o.escolhidos - o.cota} a mais</dd>}
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
          <p title="O saldo do mês como está agora; o acumulado só muda ao encerrar o mês" className={cn(rotulo, 'font-medium', o.saldoPrevisto < 0 && 'text-pendencia')}>
            {`Saldo ${formatarSaldo(o.saldoAnterior)} → ${formatarSaldo(o.saldoPrevisto)} no mês`}
          </p>
        )}
        {comCota && o.cota !== null && (
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-linha">
            <div data-barra className={cn('h-full rounded-full', o.escolhidos > o.cota ? 'bg-pendencia' : 'bg-tinta')} style={{ width: `${feito}%` }} />
          </div>
        )}
        {o.afastamentos.map((a) => (
          <p key={a.inicio} className="text-apoio leading-[18px] text-pendencia">{a.tipo}, {a.inicio.slice(8)}/{a.inicio.slice(5, 7)} a {a.fim.slice(8)}/{a.fim.slice(5, 7)}</p>
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
            <Button type="button" variant="secundario" onClick={() => setTirando(null)}>Cancelar</Button>
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
      {comCota && (
        <div className="grid gap-2">
          <Button type="button" variant="discreto" size="sm" className="justify-self-start" aria-expanded={verConta} aria-controls="como-as-cotas" onClick={() => setVerConta((v) => !v)}>
            Como as cotas foram calculadas
            <ChevronDown aria-hidden className={cn('transition-transform motion-reduce:transition-none', verConta && 'rotate-180')} />
          </Button>
          {verConta && (
            <ul id="como-as-cotas" aria-label="Como as cotas foram calculadas" className="grid gap-1 rounded-md border border-linha bg-passa p-3 text-corpo leading-[22px]">
              {conta.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
