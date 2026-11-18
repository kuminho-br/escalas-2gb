import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, type Escala, type LetraTurno, type VinculosDaEscala } from 'contratos';
import { useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { atualizarEscalas, salvarVinculos } from '@/api/escalas';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { LinhaDoTempo } from '@/componentes/LinhaDoTempo';
import { Secao } from '@/componentes/militares/Secao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';

const TODOS = '*';
type Marca = LetraTurno | typeof TODOS;

/** Guarnições por turno, com versões por vigência (como as versões da guarnição). */
export function Matriz({ escala, unidadeId }: { escala: Escala; unidadeId: string }) {
  const mes = mesAtual();
  const vigente = escala.vinculos.find((v) => v.vigencia <= mes) ?? escala.vinculos.at(-1);
  const [escolhida, setEscolhida] = useState(vigente?.vigencia);
  const versao = escala.vinculos.find((v) => v.vigencia === escolhida) ?? vigente;
  return (
    <Secao titulo="Guarnições por turno">
      {escala.vinculos.length > 1 && <LinhaDoTempo vigencias={escala.vinculos.map((v) => v.vigencia)} escolhida={versao?.vigencia} aoEscolher={setEscolhida} />}
      <Editor key={versao?.vigencia ?? 'nova'} escala={escala} unidadeId={unidadeId} versao={versao} />
    </Secao>
  );
}

function Editor({ escala, unidadeId, versao }: { escala: Escala; unidadeId: string; versao: Escala['vinculos'][number] | undefined }) {
  const queryClient = useQueryClient();
  const mes = mesAtual();
  const guarnicoes = useQuery(consultaGuarnicoes(unidadeId, versao?.vigencia ?? mes));
  const itens = versao?.itens ?? [];
  const [marcas, setMarcas] = useState<Map<string, Set<Marca>>>(() => {
    const m = new Map<string, Set<Marca>>();
    for (const i of itens) m.set(i.guarnicaoId, (m.get(i.guarnicaoId) ?? new Set()).add(i.turnoLetra ?? TODOS));
    return m;
  });
  // sugere o mês corrente, ou o começo da versão quando ela só vale no futuro
  const [desde, setDesde] = useState(versao && versao.vigencia > mes ? versao.vigencia : mes);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  // linhas: as guarnições ativas no mês, em ordem de ativação, mais as já vinculadas
  const lista = guarnicoes.data ?? [];
  const desativada = new Set([...lista.filter((g) => !g.ativa).map((g) => g.id), ...itens.filter((i) => !i.ativaNoMes).map((i) => i.guarnicaoId)]);
  const linhas = [
    ...lista.filter((g) => g.ativa || itens.some((i) => i.guarnicaoId === g.id)).map((g) => ({ id: g.id, nome: g.nome })),
    ...itens.filter((i) => !lista.some((g) => g.id === i.guarnicaoId)).map((i) => ({ id: i.guarnicaoId, nome: i.guarnicao })),
  ].filter((l, i, todas) => todas.findIndex((x) => x.id === l.id) === i);

  const orfaos = [...new Set(itens.map((i) => i.turnoLetra).filter((l): l is LetraTurno => l !== null && !escala.letras.includes(l)))];

  function alternar(guarnicaoId: string, marca: Marca, ligar: boolean) {
    const m = new Map(marcas);
    let s = new Set(m.get(guarnicaoId) ?? []);
    if (ligar) {
      // "Todos os turnos" exclui as letras na mesma linha, e vice-versa
      s = marca === TODOS ? new Set([TODOS]) : new Set([...s].filter((x) => x !== TODOS)).add(marca);
    } else s.delete(marca);
    m.set(guarnicaoId, s);
    setMarcas(m);
  }

  async function salvar() {
    setAviso(null);
    const enviar = linhas.flatMap((l): VinculosDaEscala['itens'] => {
      const s = marcas.get(l.id) ?? new Set<Marca>();
      if (s.has(TODOS)) return [{ guarnicaoId: l.id, turnoLetra: null }];
      return escala.letras.filter((x) => s.has(x)).map((x) => ({ guarnicaoId: l.id, turnoLetra: x }));
    });
    try {
      await salvarVinculos(escala.id, desde, { itens: enviar });
      atualizarEscalas(queryClient);
      setAviso({ erro: false, texto: `Salvo a partir de ${mesPorExtenso(desde)}.` });
    } catch (err) {
      const primeiro = err instanceof ErroApi && err.campos ? Object.values(err.campos)[0] : undefined;
      setAviso({ erro: true, texto: primeiro ? `${mensagemDe(err)} ${primeiro}` : mensagemDe(err) });
    }
  }

  return (
    <div className="grid gap-4">
      {orfaos.map((l) => (
        <p key={l} role="status" className="rounded-md border border-alerta/40 bg-alerta/5 px-3 py-2 text-sm">
          Turno {l} não existe mais nos serviços desta escala: {itens.filter((i) => i.turnoLetra === l).map((i) => i.guarnicao).join(', ')}. Salve a matriz para tirá-los.
        </p>
      ))}
      {escala.letras.length === 0 && <p className="text-sm text-apagado">Reúna os serviços primeiro: as colunas são os turnos deles.</p>}
      {guarnicoes.isPending && <p className="text-apagado">Carregando…</p>}
      {guarnicoes.error && <p role="alert" className="text-alerta">{mensagemDe(guarnicoes.error)}</p>}
      {guarnicoes.data && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-linha text-left text-xs text-apagado">
                <th className="py-2 pr-4 font-normal">Guarnição</th>
                {escala.letras.map((l) => <th key={l} className="px-3 py-2 text-center font-normal">{l}</th>)}
                <th className="px-3 py-2 text-center font-normal">Todos os turnos</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((g) => {
                const s = marcas.get(g.id) ?? new Set<Marca>();
                return (
                  <tr key={g.id} className="border-b border-linha/60">
                    <td className="py-1.5 pr-4">
                      <span className="font-medium">{g.nome}</span>
                      {desativada.has(g.id) && <span className="ml-2 rounded border border-linha px-1.5 text-xs">desativada</span>}
                    </td>
                    {escala.letras.map((l) => (
                      <td key={l} className="px-3 py-1.5 text-center">
                        <input type="checkbox" aria-label={`${g.nome} no turno ${l}`} checked={s.has(l)} onChange={(ev) => alternar(g.id, l, ev.target.checked)} className="size-4 accent-vinho" />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" aria-label={`${g.nome} em todos os turnos`} checked={s.has(TODOS)} onChange={(ev) => alternar(g.id, TODOS, ev.target.checked)} className="size-4 accent-vinho" />
                    </td>
                  </tr>
                );
              })}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={escala.letras.length + 2} className="py-3 text-apagado">Nenhuma guarnição ativa. Cadastre na tela de Guarnições.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid gap-3 border-t border-linha pt-3 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="em-desde">Vale a partir de</Label>
          <Input id="em-desde" type="month" value={desde} min={mes} onChange={(ev) => setDesde(ev.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!desde} onClick={() => void salvar()}>
            Salvar a partir de {desde ? mesPorExtenso(desde) : '…'}
          </Button>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
        </div>
      </div>
    </div>
  );
}
