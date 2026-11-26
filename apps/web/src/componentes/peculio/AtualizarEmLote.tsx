import { useQuery } from '@tanstack/react-query';
import { COMPORTAMENTOS, type LoteDeMilitares, type PreviaDoLote, type ResultadoDoLote } from 'contratos';
import { useRef, useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { aplicarLote, previaDoLote } from '@/api/lote';
import { consultaFuncoesDoMilitar, consultaQuadros, consultaSituacoesDoMilitar, consultaUnidadesDeLotacao } from '@/api/militares';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { hoje } from '@/lib/meses';
import { useSelecao } from './Selecao';

type Campo = 'unidade' | 'equipe' | 'jornada' | 'quadro' | 'situacao' | 'voluntarioJes' | 'funcao' | 'abono' | 'comportamento';
/** Os campos do rastreio (valem a partir de um dia, pela regra de "Alterar situação") e os simples do Pecúlio (a regra do PATCH da ficha). */
const DO_RASTREIO: Campo[] = ['unidade', 'equipe', 'jornada', 'quadro', 'situacao'];
const ROTULOS: Record<Campo, string> = { unidade: 'Lotação', equipe: 'Equipe', jornada: 'Jornada', quadro: 'Quadro', situacao: 'Situação', voluntarioJes: 'Voluntário JES', funcao: 'Função', abono: 'Abono de permanência', comportamento: 'Comportamento' };
const ORDEM: Campo[] = ['unidade', 'equipe', 'jornada', 'quadro', 'situacao', 'voluntarioJes', 'funcao', 'abono', 'comportamento'];
const SEM = 'nenhum';

type Valores = { unidadeId: string; equipe: string; semEquipe: boolean; jornada: string; quadro: string; situacaoId: string; voluntarioJes: 'sim' | 'nao'; funcao: string; abono: 'sim' | 'nao'; comportamento: string };
const VALORES_INICIAIS: Valores = { unidadeId: '', equipe: '', semEquipe: false, jornada: '', quadro: '', situacaoId: '', voluntarioJes: 'sim', funcao: '', abono: 'sim', comportamento: '' };

const militares = (n: number) => (n === 1 ? '1 militar' : `${n} militares`);

/** O valor de cada campo marcado está preenchido? (o lote não sai com campo marcado e sem valor) */
function valoresCompletos(marcados: Set<Campo>, v: Valores, desde: string): boolean {
  const faltaDesde = [...marcados].some((c) => DO_RASTREIO.includes(c)) && !/^\d{4}-\d{2}-\d{2}$/.test(desde);
  if (faltaDesde) return false;
  return [...marcados].every((c) => {
    switch (c) {
      case 'unidade': return v.unidadeId !== '';
      case 'equipe': return v.semEquipe || v.equipe.trim() !== '';
      case 'jornada': return v.jornada !== '';
      case 'quadro': return v.quadro !== '';
      case 'situacao': return v.situacaoId !== '';
      case 'funcao': return v.funcao !== '';
      case 'comportamento': return v.comportamento !== '';
      default: return true;
    }
  });
}

/** O corpo do lote: os ids da seleção, o dia (quando há campo do rastreio) e só os campos marcados. */
function corpoDoLote(ids: string[], marcados: Set<Campo>, v: Valores, desde: string): LoteDeMilitares {
  const campos: LoteDeMilitares['campos'] = {};
  if (marcados.has('unidade')) campos.unidadeId = v.unidadeId;
  if (marcados.has('equipe')) campos.equipe = v.semEquipe ? null : v.equipe.trim();
  if (marcados.has('jornada')) campos.jornada = v.jornada as 'pronto' | 'adm';
  if (marcados.has('quadro')) campos.quadroId = v.quadro === SEM ? null : v.quadro;
  if (marcados.has('situacao')) campos.situacaoId = v.situacaoId;
  if (marcados.has('voluntarioJes')) campos.voluntarioJes = v.voluntarioJes === 'sim';
  if (marcados.has('funcao')) campos.funcaoMilitarId = v.funcao === SEM ? null : v.funcao;
  if (marcados.has('abono')) campos.abonoPermanencia = v.abono === 'sim';
  if (marcados.has('comportamento')) campos.comportamento = v.comportamento as NonNullable<LoteDeMilitares['campos']['comportamento']>;
  const comRastreio = [...marcados].some((c) => DO_RASTREIO.includes(c));
  return { militarIds: ids, ...(comRastreio ? { desde } : {}), campos };
}

type Passo = 'campos' | 'valores' | 'previa' | 'resultado';

/**
 * "Atualizar em lote" (6.52): um painel de quatro passos sobre a seleção da pesquisa. Campos (o que muda), Valores (um por campo), Prévia (quem muda, quem fica de fora e por quê) e
 * Resultado. A prévia é obrigatória; "Aplicar" grava tudo ou nada, e a lista que mudou desde a prévia volta ao passo da prévia com o aviso. Não há "Desfazer".
 * `aoFechar(true)` diz que algo foi aplicado: a seleção continua com os mesmos militares (lidos de novo) e a busca recarrega.
 */
export function AtualizarEmLote({ aoFechar }: { aoFechar: (aplicou: boolean) => void }) {
  const { selecionados } = useSelecao();
  const ids = selecionados.map((s) => s.id);
  const [passo, setPasso] = useState<Passo>('campos');
  const [marcados, setMarcados] = useState<Set<Campo>>(new Set());
  const [valores, setValores] = useState<Valores>(VALORES_INICIAIS);
  const [desde, setDesde] = useState(hoje());
  const [previa, setPrevia] = useState<PreviaDoLote | null>(null);
  const [resultado, setResultado] = useState<ResultadoDoLote | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // o clique duplo não manda dois pedidos: o estado só muda no próximo desenho, a trava vale já
  const trava = useRef(false);
  const unidades = useQuery(consultaUnidadesDeLotacao);
  const quadros = useQuery(consultaQuadros);
  const situacoes = useQuery(consultaSituacoesDoMilitar);
  const funcoes = useQuery(consultaFuncoesDoMilitar);
  const mudar = (parte: Partial<Valores>) => setValores((v) => ({ ...v, ...parte }));
  const alternar = (c: Campo) => setMarcados((a) => { const n = new Set(a); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const comRastreio = [...marcados].some((c) => DO_RASTREIO.includes(c));

  const guardar = async (fazer: () => Promise<void>) => {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try {
      await fazer();
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  };
  const verPrevia = (aviso: string | null = null) =>
    guardar(async () => {
      setErro(aviso);
      try {
        setPrevia(await previaDoLote(corpoDoLote(ids, marcados, valores, desde)));
        setPasso('previa');
      } catch (e) {
        setErro(mensagemDe(e));
      }
    });
  const aplicar = () =>
    guardar(async () => {
      if (!previa) return;
      setErro(null);
      try {
        setResultado(await aplicarLote({ ...corpoDoLote(ids, marcados, valores, desde), assinatura: previa.assinatura }));
        setPasso('resultado');
      } catch (e) {
        if (e instanceof ErroApi && e.status === 409) {
          // a lista mudou desde a prévia: volta à prévia (refeita) com o aviso, e nada foi gravado
          setErro(e.message);
          try {
            setPrevia(await previaDoLote(corpoDoLote(ids, marcados, valores, desde)));
          } catch (e2) {
            setErro(mensagemDe(e2));
          }
          return;
        }
        setErro(mensagemDe(e));
      }
    });

  const nMudam = previa?.mudam.length ?? 0;
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !ocupado) aoFechar(resultado !== null); }}>
      <DialogContent showCloseButton={passo !== 'resultado'} className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Atualizar em lote</DialogTitle>
          <DialogDescription>
            {passo === 'campos' && `${militares(ids.length)} selecionados. Marque o que muda.`}
            {passo === 'valores' && 'Escolha o valor de cada campo marcado.'}
            {passo === 'previa' && 'Confira quem muda antes de aplicar. Não há como desfazer o lote.'}
            {passo === 'resultado' && 'Pronto.'}
          </DialogDescription>
        </DialogHeader>

        {passo === 'campos' && (
          <>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Campos que mudam</legend>
              {ORDEM.map((c) => (
                <label key={c} className="flex items-center gap-2 text-corpo">
                  <Checkbox checked={marcados.has(c)} onChange={() => alternar(c)} />
                  {ROTULOS[c]}
                </label>
              ))}
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="secundario" onClick={() => aoFechar(false)}>Cancelar</Button>
              <Button type="button" disabled={marcados.size === 0} onClick={() => setPasso('valores')}>Continuar</Button>
            </DialogFooter>
          </>
        )}

        {passo === 'valores' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {marcados.has('unidade') && (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="lote-unidade">Lotação</Label>
                  <EscolherUnidade id="lote-unidade" rotulo="Lotação" unidades={unidades.data ?? []} valor={valores.unidadeId} aoEscolher={(id) => mudar({ unidadeId: id })} />
                  <p className="text-apoio text-apagado">Quem muda de unidade chega sem equipe, a não ser que você marque a equipe também.</p>
                </div>
              )}
              {marcados.has('equipe') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-equipe">Equipe</Label>
                  <Input id="lote-equipe" value={valores.equipe} disabled={valores.semEquipe} onChange={(e) => mudar({ equipe: e.target.value })} placeholder="Ex.: Alfa" maxLength={40} autoComplete="off" className="bg-superficie" />
                  <label className="flex items-center gap-2 text-corpo">
                    <Checkbox checked={valores.semEquipe} onChange={(e) => mudar({ semEquipe: e.target.checked })} />
                    Sem equipe
                  </label>
                  <p className="text-apoio text-apagado">Vale pelo nome, na unidade de cada militar.</p>
                </div>
              )}
              {marcados.has('jornada') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-jornada">Jornada</Label>
                  <Selecao id="lote-jornada" value={valores.jornada} onChange={(e) => mudar({ jornada: e.target.value })}>
                    <option value="">Escolha</option>
                    <option value="pronto">Pronto</option>
                    <option value="adm">ADM</option>
                  </Selecao>
                </div>
              )}
              {marcados.has('quadro') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-quadro">Quadro</Label>
                  <Selecao id="lote-quadro" value={valores.quadro} onChange={(e) => mudar({ quadro: e.target.value })}>
                    <option value="">Escolha</option>
                    <option value={SEM}>Sem quadro</option>
                    {(quadros.data ?? []).map((q) => <option key={q.id} value={q.id}>{q.sigla}</option>)}
                  </Selecao>
                </div>
              )}
              {marcados.has('situacao') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-situacao">Situação</Label>
                  <Selecao id="lote-situacao" value={valores.situacaoId} onChange={(e) => mudar({ situacaoId: e.target.value })}>
                    <option value="">Escolha</option>
                    {(situacoes.data ?? []).filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </Selecao>
                </div>
              )}
              {marcados.has('voluntarioJes') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-jes">Voluntário JES</Label>
                  <Selecao id="lote-jes" value={valores.voluntarioJes} onChange={(e) => mudar({ voluntarioJes: e.target.value as 'sim' | 'nao' })}>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </Selecao>
                </div>
              )}
              {marcados.has('funcao') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-funcao">Função</Label>
                  <Selecao id="lote-funcao" value={valores.funcao} onChange={(e) => mudar({ funcao: e.target.value })}>
                    <option value="">Escolha</option>
                    <option value={SEM}>Sem função</option>
                    {(funcoes.data ?? []).filter((f) => f.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </Selecao>
                </div>
              )}
              {marcados.has('abono') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-abono">Abono de permanência</Label>
                  <Selecao id="lote-abono" value={valores.abono} onChange={(e) => mudar({ abono: e.target.value as 'sim' | 'nao' })}>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </Selecao>
                </div>
              )}
              {marcados.has('comportamento') && (
                <div className="grid gap-1.5">
                  <Label htmlFor="lote-comportamento">Comportamento</Label>
                  <Selecao id="lote-comportamento" value={valores.comportamento} onChange={(e) => mudar({ comportamento: e.target.value })}>
                    <option value="">Escolha</option>
                    {COMPORTAMENTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Selecao>
                </div>
              )}
              {comRastreio && (
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="lote-desde">A partir de</Label>
                  <Input id="lote-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-48 bg-superficie" />
                  <p className="text-apoio text-apagado">Vale para a lotação, a equipe, a jornada, o quadro e a situação.</p>
                </div>
              )}
            </div>
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
            <DialogFooter>
              <Button type="button" variant="secundario" onClick={() => { setErro(null); setPasso('campos'); }}>Voltar</Button>
              <Button type="button" disabled={ocupado || !valoresCompletos(marcados, valores, desde)} onClick={() => void verPrevia()}>Ver a prévia</Button>
            </DialogFooter>
          </>
        )}

        {passo === 'previa' && previa && (
          <>
            {erro && <p role="alert" className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{erro}</p>}
            <div className="grid gap-1">
              <p className="font-cond text-lg font-semibold">{nMudam === 0 ? 'Nenhum militar vai mudar.' : nMudam === 1 ? '1 militar vai mudar' : `${nMudam} militares vão mudar`}</p>
              {previa.chegamSemEquipe > 0 && <p className="text-corpo text-apagado">{previa.chegamSemEquipe === 1 ? '1 chega sem equipe' : `${previa.chegamSemEquipe} chegam sem equipe`}</p>}
            </div>
            {nMudam > 0 && (
              <ul aria-label="Vão mudar" className="max-h-56 divide-y divide-linha overflow-auto rounded-md border border-linha">
                {previa.mudam.map((m) => (
                  <li key={m.id} className="grid gap-0.5 px-3 py-2">
                    <span><span className="font-cond text-apoio text-apagado">{m.posto}</span> <span className="font-cond font-semibold">{m.nomeGuerra}</span></span>
                    <span className="text-apoio text-apagado">{`${m.de} → ${m.para}`}</span>
                  </li>
                ))}
              </ul>
            )}
            <ForamDeFora lista={previa.ficamDeFora} />
            <DialogFooter>
              <Button type="button" variant="secundario" disabled={ocupado} onClick={() => { setErro(null); setPasso('valores'); }}>Voltar</Button>
              {nMudam > 0 && (
                <Button type="button" disabled={ocupado} onClick={() => void aplicar()}>{ocupado ? 'Aplicando…' : `Aplicar a ${militares(nMudam)}`}</Button>
              )}
            </DialogFooter>
          </>
        )}

        {passo === 'resultado' && resultado && (
          <>
            <p className="font-cond text-lg font-semibold">{resultado.mudaram === 1 ? '1 militar alterado' : `${resultado.mudaram} militares alterados`}</p>
            <ForamDeFora lista={resultado.ficaramDeFora} />
            <DialogFooter>
              <Button type="button" onClick={() => aoFechar(true)}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Quem ficou de fora e o motivo de cada um. */
function ForamDeFora({ lista }: { lista: PreviaDoLote['ficamDeFora'] }) {
  if (lista.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className="text-corpo font-medium">{lista.length === 1 ? '1 fica de fora' : `${lista.length} ficam de fora`}</p>
      <ul aria-label="Ficam de fora" className="max-h-44 divide-y divide-linha overflow-auto rounded-md border border-linha">
        {lista.map((m) => (
          <li key={m.id} className="grid gap-0.5 px-3 py-2">
            <span><span className="font-cond text-apoio text-apagado">{m.posto}</span> <span className="font-cond font-semibold">{m.nomeGuerra}</span></span>
            <span className="text-apoio text-apagado">{m.motivo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
