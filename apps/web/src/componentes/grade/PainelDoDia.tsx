import { useQuery, useQueryClient } from '@tanstack/react-query';
import { textoFaixa, type OpcaoDeServico } from 'contratos';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { escalar, removerAlocacao } from '@/api/escala-do-mes';
import { consultaPainelDoDia } from '@/api/grade';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { useSoConsulta } from '@/componentes/FaixaSoConsulta';
import { Button } from '@/componentes/ui/button';
import { estiloDaCor } from '@/lib/cores';
import { listaComE } from '@/lib/escala';
import { dataPorExtenso } from '@/lib/meses';
import { AdicionarServico } from './AdicionarServico';
import { TrocarServico } from './TrocarServico';

/**
 * O painel do dia de um militar na Grade geral: como ele está naquele dia (afastamento, horários marcados, serviços, choques) e o que dá para
 * fazer: adicionar um serviço onde ele pode entrar e remover. No computador fica ao lado da grade; no celular ocupa a tela.
 */
export function PainelDoDia({ unidadeId, militarId, data, aoFechar }: { unidadeId: string; militarId: string; data: string; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  // numa unidade só de consulta o painel mostra o dia e nada mais: sem trocar, remover nem adicionar
  const soConsulta = useSoConsulta();
  const painel = useQuery(consultaPainelDoDia(unidadeId, data.slice(0, 7), militarId, data));
  const [adicionando, setAdicionando] = useState(false);
  const [trocando, setTrocando] = useState<{ alocacaoId: string; acumulaCom: string[] } | null>(null);
  const raiz = useRef<HTMLElement>(null);
  // ao abrir, o foco vai para o painel (quem usa o teclado não precisa passar pelas células que sobram); Esc fecha
  useEffect(() => raiz.current?.focus(), []);
  const teclar = (e: KeyboardEvent<HTMLElement>) => {
    // o que vem de um diálogo (portal) não é do painel: Esc fecha só o diálogo
    if (e.key === 'Escape' && !e.defaultPrevented && e.currentTarget.contains(e.target as Node)) aoFechar();
  };
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const p = painel.data;

  const adicionar = travar(async (o: OpcaoDeServico, turnoId: string) => {
    setErro(null);
    try {
      await escalar(queryClient, o.escalaId, { militarId, data, turnoId, guarnicaoId: o.guarnicaoId, funcaoId: o.funcaoId });
      setAdicionando(false);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });
  const remover = travar(async (alocacaoId: string) => {
    setErro(null);
    try {
      await removerAlocacao(queryClient, alocacaoId);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const nome = p ? `${p.militar.posto} ${p.militar.nomeGuerra}` : null;
  return (
    <aside
      ref={raiz}
      tabIndex={-1}
      onKeyDown={teclar}
      aria-label={nome ? `Dia de ${nome}` : 'Dia do militar'}
      className="outline-none max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:bg-fundo max-lg:p-3 lg:sticky lg:top-4 lg:self-start"
    >
      <div className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
        <header className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-cond text-2xl leading-tight font-semibold">{nome ?? 'Carregando…'}</h2>
            {p && (
              <>
                <p className="mt-1 text-sm text-apagado">
                  Matrícula {p.militar.matricula}, {p.militar.equipe ? `equipe ${p.militar.equipe}, ` : ''}jornada {p.militar.jornada === 'adm' ? 'Adm' : 'Pronto'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.militar.cnh.length > 0 && <span className="rounded border border-linha px-1.5 text-xs">CNH {[...p.militar.cnh].sort().at(-1)}</span>}
                  <span className="rounded border border-linha px-1.5 text-xs">{p.militar.voluntarioJes ? 'Voluntário JES' : 'Não é voluntário JES'}</span>
                </div>
              </>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={aoFechar}>
            <X aria-hidden />
          </Button>
        </header>

        {painel.error && <p role="alert" className="p-4 text-sm text-alerta">{mensagemDe(painel.error)}</p>}
        {p && (
          <>
            <section className="grid gap-1.5 p-4 text-sm">
              <p className="font-medium">{dataPorExtenso(data)}</p>
              {p.afastamento && <p className="text-pendencia">Afastado: {p.afastamento}</p>}
              <p className="text-apagado">
                {p.disponibilidade.length ? `Marcou ${listaComE(p.disponibilidade.map((d) => textoFaixa(d.inicio, d.fim)))} no voluntariado.` : 'Não marcou voluntariado neste dia.'}
              </p>
              {p.choques.map((c) => <p key={c} className="text-alerta">{c}</p>)}
            </section>

            <section className="grid gap-3 p-4">
              {p.servicos.length === 0 ? (
                <p className="text-sm text-apagado">Sem serviço neste dia.</p>
              ) : (
                <ul className="grid gap-3">
                  {p.servicos.map((s) => (
                    <li key={s.alocacaoId} aria-label={`${s.servico.nome} ${s.letra}, ${textoFaixa(s.inicio, s.fim)}`} className="grid gap-1 rounded-lg border border-linha p-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="rounded px-1.5 font-cond text-sm font-semibold" style={estiloDaCor(s.servico.cor)}>
                          {s.servico.nome} {s.letra}
                        </span>
                        <span aria-hidden className="text-sm">{textoFaixa(s.inicio, s.fim)}</span>
                        {!soConsulta && (
                          <span className="ml-auto flex gap-1.5">
                            <Button type="button" variant="outline" size="sm" disabled={salvando} onClick={() => setTrocando({ alocacaoId: s.alocacaoId, acumulaCom: s.acumulaCom })}>
                              Trocar
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled={salvando} onClick={() => void remover(s.alocacaoId)}>
                              Remover
                            </Button>
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{s.escala} · {s.guarnicao ? `${s.guarnicao}, ${s.funcao}` : 'sem guarnição'}</p>
                      {s.acumulaCom.length > 0 && <p className="text-xs text-apagado">Acumula {listaComE(s.acumulaCom)}.</p>}
                      {/* os avisos do "Remover", como na Escala do mês */}
                      {!soConsulta && <p className="text-xs text-apagado">Ele não volta para este turno quando a pré-escala for gerada de novo.</p>}
                      {!soConsulta && s.acumulaCom.length > 0 && <p className="text-xs text-apagado">Sai também de: {listaComE(s.acumulaCom)}.</p>}
                    </li>
                  ))}
                </ul>
              )}
              {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
              {!soConsulta && (
                <>
                  <div>
                    <Button type="button" variant={adicionando ? 'secondary' : 'outline'} aria-expanded={adicionando} onClick={() => setAdicionando((v) => !v)}>
                      Adicionar serviço neste dia
                    </Button>
                  </div>
                  {adicionando && <AdicionarServico opcoes={p.opcoes} salvando={salvando} aoEscolher={(o, turnoId) => void adicionar(o, turnoId)} />}
                </>
              )}
            </section>
          </>
        )}
      </div>
      {trocando && <TrocarServico alocacaoId={trocando.alocacaoId} acumulaCom={trocando.acumulaCom} nomeAtual={p?.militar.nomeGuerra ?? ''} aoFechar={() => setTrocando(null)} />}
    </aside>
  );
}
