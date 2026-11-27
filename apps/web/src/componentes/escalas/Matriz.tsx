import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { mesPorExtenso, textoFaixa, type Escala, type VinculosDaEscala } from 'contratos';
import { useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { atualizarEscalas, salvarVinculos } from '@/api/escalas';
import { consultaGuarnicoes } from '@/api/guarnicoes';
import { AcoesDoBloco, podeDescartar, usePendencia, useTrava } from '@/componentes/AlteracoesPendentes';
import { LinhaDoTempo } from '@/componentes/LinhaDoTempo';
import { Secao } from '@/componentes/militares/Secao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { limites } from '@/lib/guarnicoes';
import { mesAtual } from '@/lib/meses';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Espera } from '@/componentes/resposta/Espera';
import { COLUNA_PRESA_ESQUERDA, useSombraDaRolagem } from '@/lib/tabela-com-rolagem';
import { cn } from '@/lib/utils';

/** Guarnições por faixa de horário, com versões por vigência (como as versões da guarnição). */
export function Matriz({ escala, unidadeId }: { escala: Escala; unidadeId: string }) {
  const mes = mesAtual();
  const vigente = escala.vinculos.find((v) => v.vigencia <= mes) ?? escala.vinculos.at(-1);
  const [escolhida, setEscolhida] = useState(vigente?.vigencia);
  const versao = escala.vinculos.find((v) => v.vigencia === escolhida) ?? vigente;
  return (
    <Secao titulo="Guarnições por turno">
      {escala.vinculos.length > 1 && <LinhaDoTempo vigencias={escala.vinculos.map((v) => v.vigencia)} escolhida={versao?.vigencia} aoEscolher={(v) => { if (podeDescartar('matriz')) setEscolhida(v); }} />}
      <Editor key={versao?.vigencia ?? 'nova'} escala={escala} unidadeId={unidadeId} versao={versao} aoSalvar={setEscolhida} />
    </Secao>
  );
}

const chave = (inicio: string, fim: string) => `${inicio}|${fim}`;

function Editor({ escala, unidadeId, versao, aoSalvar }: { escala: Escala; unidadeId: string; versao: Escala['vinculos'][number] | undefined; aoSalvar: (mes: string) => void }) {
  const queryClient = useQueryClient();
  const mes = mesAtual();
  // sugere o mês corrente, ou o começo da versão quando ela só vale no futuro
  const [desde, setDesde] = useState(versao && versao.vigencia > mes ? versao.vigencia : mes);
  // as linhas (guarnições ativas e a etiqueta "desativada") seguem o mês do "Vale a partir de"
  // mantém as linhas à vista enquanto o mês novo carrega
  const guarnicoes = useQuery({ ...consultaGuarnicoes(unidadeId, /^\d{4}-\d{2}$/.test(desde) ? desde : (versao?.vigencia ?? mes)), placeholderData: keepPreviousData });
  const caixaDaMatriz = useSombraDaRolagem();
  const itens = versao?.itens ?? [];
  // faixas marcadas de cada guarnição (chave "início|fim")
  const [marcas, setMarcas] = useState<Map<string, Set<string>>>(() => {
    const m = new Map<string, Set<string>>();
    for (const i of itens) m.set(i.guarnicaoId, (m.get(i.guarnicaoId) ?? new Set<string>()).add(chave(i.inicio, i.fim)));
    return m;
  });
  // marcações de todas as guarnições, em texto: o que difere do último gravado é alteração pendente (o mês não conta)
  const assinatura = (m: Map<string, Set<string>>) => [...m].flatMap(([g, fs]) => [...fs].map((f) => `${g}|${f}`)).sort().join(',');
  const marcasDe = (v: Escala['vinculos'][number] | undefined) => {
    const m = new Map<string, Set<string>>();
    for (const i of v?.itens ?? []) m.set(i.guarnicaoId, (m.get(i.guarnicaoId) ?? new Set<string>()).add(chave(i.inicio, i.fim)));
    return m;
  };
  const [salvo, setSalvo] = useState(() => assinatura(marcas));
  const sujo = assinatura(marcas) !== salvo;
  usePendencia('matriz', sujo);
  // o servidor trouxe outras marcações para esta versão (ex.: uma importação com a ficha aberta): sem alteração pendente, a matriz recarrega; com alteração, a marcação da pessoa fica
  const doServidor = assinatura(marcasDe(versao));
  const [visto, setVisto] = useState(doServidor);
  if (doServidor !== visto) {
    setVisto(doServidor);
    if (!sujo) {
      setMarcas(marcasDe(versao));
      setSalvo(doServidor);
    }
  }
  // gravar a partir de "desde" muda o que vale se as marcações diferem da versão em vigor nesse mês (ex.: uma versão antiga trazida de volta)
  const mesDeVigor = /^\d{4}-\d{2}$/.test(desde) ? desde : mes;
  const emVigor = escala.vinculos.find((v) => v.vigencia <= mesDeVigor);
  const mudaOQueVale = assinatura(marcasDe(emVigor)) !== assinatura(marcas);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  // linhas: as guarnições ativas no mês, em ordem de ativação, mais as já vinculadas
  const lista = guarnicoes.data ?? [];
  // a lista (consultada pelo mês do "Vale a partir de") diz quem está desativado; só quem não veio nela usa o que o item gravou no mês da versão
  const desativada = new Set([
    ...lista.filter((g) => !g.ativa).map((g) => g.id),
    ...itens.filter((i) => !i.ativaNoMes && !lista.some((g) => g.id === i.guarnicaoId)).map((i) => i.guarnicaoId),
  ]);
  const linhas = [
    ...lista.filter((g) => g.ativa || itens.some((i) => i.guarnicaoId === g.id)).map((g) => ({ id: g.id, nome: g.nome })),
    ...itens.filter((i) => !lista.some((g) => g.id === i.guarnicaoId)).map((i) => ({ id: i.guarnicaoId, nome: i.guarnicao })),
  ].filter((l, i, todas) => todas.findIndex((x) => x.id === l.id) === i);

  // vínculos em faixas que já não existem nos serviços da escala, uma frase por faixa
  const existentes = new Set(escala.faixas.map((f) => chave(f.inicio, f.fim)));
  const orfas = new Map<string, { inicio: string; fim: string; nomes: string[] }>();
  for (const i of itens) {
    if (existentes.has(chave(i.inicio, i.fim))) continue;
    const o = orfas.get(chave(i.inicio, i.fim)) ?? { inicio: i.inicio, fim: i.fim, nomes: [] };
    orfas.set(chave(i.inicio, i.fim), o);
    o.nomes.push(i.guarnicao);
  }

  const minimoDe = (guarnicaoId: string) => lista.find((g) => g.id === guarnicaoId)?.minimo ?? 0;
  const minimoDaFaixa = (c: string) => linhas.reduce((soma, l) => soma + (marcas.get(l.id)?.has(c) ? minimoDe(l.id) : 0), 0);

  function alternar(guarnicaoId: string, c: string, ligar: boolean) {
    const m = new Map(marcas);
    const s = new Set(m.get(guarnicaoId) ?? []);
    if (ligar) s.add(c);
    else s.delete(c);
    m.set(guarnicaoId, s);
    setMarcas(m);
  }

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    const enviar = linhas.flatMap((l): VinculosDaEscala['itens'] =>
      escala.faixas.filter((f) => marcas.get(l.id)?.has(chave(f.inicio, f.fim))).map((f) => ({ guarnicaoId: l.id, inicio: f.inicio, fim: f.fim })),
    );
    try {
      await salvarVinculos(escala.id, desde, { itens: enviar });
      setSalvo(assinatura(marcas));
      atualizarEscalas(queryClient);
      setAviso({ erro: false, texto: `Salvo a partir de ${mesPorExtenso(desde)}.` });
      aoSalvar(desde);
    } catch (err) {
      const primeiro = err instanceof ErroApi && err.campos ? Object.values(err.campos)[0] : undefined;
      setAviso({ erro: true, texto: primeiro ? `${mensagemDe(err)} ${primeiro}` : mensagemDe(err) });
    }
  }

  return (
    <div className="grid gap-4">
      {[...orfas.values()].map((o) => (
        <p key={chave(o.inicio, o.fim)} role="status" className="rounded-md border border-alerta/40 bg-alerta/5 px-3 py-2 text-sm">
          A faixa {textoFaixa(o.inicio, o.fim)} não existe mais nos serviços desta escala: {o.nomes.join(', ')}. Salve a matriz para tirá-la.
        </p>
      ))}
      {escala.faixas.length === 0 && <p className="text-sm text-apagado">Reúna os serviços primeiro: as colunas são os horários dos turnos deles.</p>}
      {guarnicoes.isPending && <Espera />}
      {guarnicoes.error && <p role="alert" className="text-alerta">{mensagemDe(guarnicoes.error)}</p>}
      {guarnicoes.data && escala.faixas.length > 0 && (
        <div ref={caixaDaMatriz} data-rolagem="matriz" className="overflow-x-auto">
          {/* `border-separate`: a fronteira da coluna presa (3 px em tinta, `lib/tabela-com-rolagem.ts`) acompanha a célula quando a tabela rola; as linhas entre as guarnições vão nas células */}
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="*:border-b *:border-linha text-left">
                <th className={cn('sticky left-0 z-10 bg-superficie py-2 pr-4 text-xs font-normal text-apagado', COLUNA_PRESA_ESQUERDA)}>Guarnição</th>
                {escala.faixas.map((f) => (
                  <th key={chave(f.inicio, f.fim)} className="px-4 py-2 text-center font-normal">
                    {escala.comLetra && <span className="block font-cond text-base font-semibold text-tinta">{f.letras[0]}</span>}
                    <span className={escala.comLetra ? 'block text-xs text-apagado' : 'block font-cond text-base font-semibold text-tinta'}>{textoFaixa(f.inicio, f.fim)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((g) => {
                const tamanho = lista.find((x) => x.id === g.id);
                return (
                  <tr key={g.id} className="*:border-b *:border-linha/60">
                    <td className={cn('sticky left-0 z-10 bg-superficie py-1.5 pr-4', COLUNA_PRESA_ESQUERDA)}>
                      <Link to="/configuracoes/modelos-de-guarnicao/$id" params={{ id: g.id }} className="font-medium text-vinho hover:underline">{g.nome}</Link>
                      {desativada.has(g.id) && <span className="ml-2 rounded border border-linha px-1.5 text-xs">desativada</span>}
                      {tamanho && <span className="block text-xs text-apagado">{limites(tamanho)}</span>}
                    </td>
                    {escala.faixas.map((f) => {
                      const c = chave(f.inicio, f.fim);
                      const nome = escala.comLetra ? `${g.nome} em ${f.letras[0]} (${textoFaixa(f.inicio, f.fim)})` : `${g.nome} em ${textoFaixa(f.inicio, f.fim)}`;
                      return (
                        <td key={c} className="px-4 py-1.5 text-center">
                          <Checkbox aria-label={nome} checked={marcas.get(g.id)?.has(c) ?? false} onChange={(ev) => alternar(g.id, c, ev.target.checked)} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={escala.faixas.length + 1} className="py-3 text-apagado">Nenhuma guarnição ativa. Cadastre em Configurações › Modelos de guarnição.</td>
                </tr>
              )}
            </tbody>
            {linhas.length > 0 && (
              <tfoot>
                <tr className="text-xs text-apagado">
                  <td className={cn('sticky left-0 z-10 bg-superficie pt-2 pr-4', COLUNA_PRESA_ESQUERDA)}>Mínimo de militares</td>
                  {escala.faixas.map((f) => <td key={chave(f.inicio, f.fim)} className="px-4 pt-2 text-center">mín. {minimoDaFaixa(chave(f.inicio, f.fim))}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <div className="grid gap-3 border-t border-linha pt-3 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="em-desde">Vale a partir de</Label>
          <Input id="em-desde" type="month" value={desde} min={mes} onChange={(ev) => setDesde(ev.target.value)} />
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} forcar={orfas.size > 0 || mudaOQueVale} aviso={aviso} tipo="button" desabilitado={!desde} rotulo={`Salvar a partir de ${desde ? mesPorExtenso(desde) : '…'}`} aoSalvar={() => void salvar()} />
      </div>
    </div>
  );
}
