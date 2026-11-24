import { useQueryClient } from '@tanstack/react-query';
import type { OrdemDeEscalacao as Ordem, VagaDaOrdem, VagaNaTela } from 'contratos';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { mensagemComCampo } from '@/api/cliente';
import { gravarOrdemDeEscalacao } from '@/api/ordem-de-escalacao';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { listaComE } from '@/lib/escala';
import { cn } from '@/lib/utils';

const chave = (v: { guarnicaoId: string; funcaoId: string; vaga: number }) => `${v.guarnicaoId}|${v.funcaoId}|${v.vaga}`;
/** As vagas numeradas, na ordem, como chaves. */
const ordemDaTela = (vagas: VagaNaTela[]): string[] => vagas.filter((v) => v.posicao !== null).sort((a, b) => a.posicao! - b.posicao!).map(chave);

/** "Chefe ABT, vaga 1": o nome da vaga como a tela e os leitores de tela o dizem. */
const nomeDaVaga = (v: VagaNaTela) => `${v.funcao} ${v.guarnicao}, vaga ${v.vaga}`;

/**
 * A ordem em que as vagas são preenchidas: um quadrado por vaga, agrupados por guarnição. Clicar numera (o próximo número) ou tira da ordem
 * (os seguintes sobem um). Ao lado, a mesma ordem em lista, com Subir e Descer.
 */
export function OrdemDeEscalacao({ escalaId, mes, dados }: { escalaId: string; mes: string; dados: Ordem }) {
  const queryClient = useQueryClient();
  const doServidor = ordemDaTela(dados.vagas);
  const [ordem, setOrdem] = useState<string[]>(doServidor);
  const [salvo, setSalvo] = useState(doServidor.join(','));
  const sujo = ordem.join(',') !== salvo;
  usePendencia('ordem-de-escalacao', sujo);
  useSincronizar(doServidor.join(','), sujo, () => {
    setOrdem(doServidor);
    setSalvo(doServidor.join(','));
  });
  const { salvando, travar } = useTrava();
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  const porChave = new Map(dados.vagas.map((v) => [chave(v), v]));
  // a composição ou o vínculo podem mudar com a tela aberta (ou a ordem vir do cache): vaga que já não existe sai da ordem e as posições se fecham
  const existentes = (o: string[]) => o.filter((k) => porChave.has(k));
  const ativa = existentes(ordem);
  const posicaoDe = (v: VagaNaTela) => ativa.indexOf(chave(v)) + 1 || null;
  const alternar = (v: VagaNaTela) => setOrdem((o) => (existentes(o).includes(chave(v)) ? existentes(o).filter((k) => k !== chave(v)) : [...existentes(o), chave(v)]));
  const mover = (i: number, passo: -1 | 1) =>
    setOrdem((o) => {
      const novo = existentes(o);
      [novo[i], novo[i + passo]] = [novo[i + passo]!, novo[i]!];
      return novo;
    });

  const salvar = travar(async () => {
    setAviso(null);
    const itens = ativa.map((k): VagaDaOrdem => {
      const v = porChave.get(k)!;
      return { guarnicaoId: v.guarnicaoId, funcaoId: v.funcaoId, vaga: v.vaga };
    });
    try {
      await gravarOrdemDeEscalacao(queryClient, escalaId, mes, itens);
      setOrdem(ativa);
      setSalvo(ativa.join(','));
      setAviso({ erro: false, texto: 'Ordem salva.' });
    } catch (e) {
      setAviso({ erro: true, texto: mensagemComCampo(e) });
    }
  });

  // guarnições na ordem de exibição, cada uma com as vagas dela
  const guarnicoes: { id: string; nome: string; vagas: VagaNaTela[] }[] = [];
  for (const v of dados.vagas) {
    const g = guarnicoes.find((x) => x.id === v.guarnicaoId);
    if (g) g.vagas.push(v);
    else guarnicoes.push({ id: v.guarnicaoId, nome: v.guarnicao, vagas: [v] });
  }
  const vagasDaFuncao = (v: VagaNaTela) => dados.vagas.filter((x) => x.guarnicaoId === v.guarnicaoId && x.funcaoId === v.funcaoId).length;
  const rotuloCurto = (v: VagaNaTela) => (vagasDaFuncao(v) > 1 ? `${v.funcao} ${v.vaga}` : v.funcao);

  // o que falta, por guarnição: "Combatente 2 e Combatente 3 da ABT"
  const fora = dados.vagas.filter((v) => !ativa.includes(chave(v)));
  const falta = guarnicoes.flatMap((g) => {
    const delas = fora.filter((v) => v.guarnicaoId === g.id);
    return delas.length ? [`${listaComE(delas.map(rotuloCurto))} da ${g.nome}`] : [];
  });
  const rodape =
    fora.length === 0
      ? 'Todas as vagas estão na ordem.'
      : `${ativa.length} de ${dados.vagas.length} vagas na ordem.${ativa.length > 0 ? ` Falta: ${listaComE(falta)}.` : ''}`;

  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (passo === undefined || !(e.target as HTMLElement).hasAttribute('data-quadrado')) return;
    const todos = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-quadrado]')];
    const destino = todos[todos.indexOf(e.target as HTMLElement) + passo];
    if (!destino) return;
    e.preventDefault();
    destino.focus();
  };

  return (
    <div className="grid gap-4">
      {dados.vigencia === null && <p className="rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">Ainda sem ordem cadastrada: a sugestão abaixo segue a prioridade antiga das guarnições.</p>}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-3" onKeyDown={aoTeclar}>
          <p className="text-sm text-apagado">Clique nas vagas na ordem em que devem ser preenchidas. Clique numa vaga numerada para tirá-la da ordem (as seguintes sobem um).</p>
          {guarnicoes.map((g) => (
            <section key={g.id} aria-label={g.nome} className="grid gap-1.5 rounded-lg border border-linha bg-superficie p-3">
              <h2 className="font-cond text-base font-semibold">{g.nome}</h2>
              <div className="flex flex-wrap gap-2">
                {g.vagas.map((v) => {
                  const pos = posicaoDe(v);
                  return (
                    <button
                      key={chave(v)}
                      type="button"
                      data-quadrado
                      data-extra={v.obrigatoria ? undefined : ''}
                      data-posicao={pos ?? undefined}
                      aria-label={pos ? `${nomeDaVaga(v)}, posição ${pos}` : nomeDaVaga(v)}
                      onClick={() => alternar(v)}
                      className={cn(
                        'flex min-w-24 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm font-medium',
                        pos ? 'border-vinho bg-vinho text-white' : v.obrigatoria ? 'border-tinta bg-superficie hover:bg-accent' : 'border-dashed border-apagado bg-superficie text-apagado hover:bg-accent',
                      )}
                    >
                      <span aria-hidden className="w-5 text-center font-cond text-lg font-semibold">{pos ?? ''}</span>
                      <span aria-hidden>{rotuloCurto(v)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <aside className="grid gap-2 rounded-lg border border-linha bg-superficie p-3">
          <h2 className="font-cond text-base font-semibold">Ordem de preenchimento</h2>
          {ativa.length === 0 ? (
            <p className="text-sm text-apagado">Nenhuma vaga na ordem ainda.</p>
          ) : (
            <ol aria-label="Ordem de preenchimento" className="grid gap-1">
              {ativa.map((k, i) => {
                const v = porChave.get(k)!;
                return (
                  <li key={k} className="flex items-center gap-1.5 text-sm">
                    <span className="w-6 text-right font-cond font-semibold">{i + 1}</span>
                    <span className="min-w-0 flex-1">{nomeDaVaga(v)}</span>
                    <Button type="button" variant="discreto" size="icon" aria-label={`Subir ${nomeDaVaga(v)}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp aria-hidden /></Button>
                    <Button type="button" variant="discreto" size="icon" aria-label={`Descer ${nomeDaVaga(v)}`} disabled={i === ativa.length - 1} onClick={() => mover(i, 1)}><ArrowDown aria-hidden /></Button>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
      <p data-testid="rodape-da-ordem" className="text-sm text-apagado">{rodape}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secundario" onClick={() => setOrdem([])} disabled={salvando}>Limpar</Button>
        <AcoesDoBloco sujo={sujo} forcar={dados.vigencia === null} salvando={salvando} aviso={aviso} tipo="button" aoSalvar={() => void salvar()} />
      </div>
    </div>
  );
}
