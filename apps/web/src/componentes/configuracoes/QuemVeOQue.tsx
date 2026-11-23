import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Bloco, Borda, Quadro } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaQuadros } from '@/api/militares';
import { atualizarVisao, consultaBorda, marcarQuadro, salvarBorda } from '@/api/visao';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Button } from '@/componentes/ui/button';
import { nomeDoPapel } from '@/lib/papeis';

/** O nome de cada bloco e o que ele tem (o texto da spec, "Os blocos e a borda inicial"). */
const BLOCOS: Record<Bloco, { nome: string; tem: string }> = {
  identificacao: { nome: 'Identificação', tem: 'Posto, nome de guerra, nome completo, matrícula, lotação e quadro' },
  contato: { nome: 'Contato', tem: 'Telefone e e-mail' },
  situacao: { nome: 'Situação', tem: 'Equipe, jornada, situação do militar e o histórico de lotação' },
  afastamentos: { nome: 'Afastamentos', tem: 'Tipo e período, sem motivo e sem boletim' },
  dados_da_escala: { nome: 'Dados da escala', tem: 'Motorista, CNH e voluntário JES' },
  comportamento: { nome: 'Comportamento', tem: 'Comportamento e boletim; motivo e boletim dos afastamentos' },
  escala_em_montagem: { nome: 'Escala em montagem', tem: 'Grade geral, escala do mês, efetivo por dia, cotas e voluntariado da unidade, só para leitura' },
};
type Camada = 'todos' | 'oficial' | 'gestorLateral';
const CAMADAS: { camada: Camada; nome: string; quem: string }[] = [
  { camada: 'todos', nome: 'Todos', quem: 'todo militar com conta' },
  { camada: 'oficial', nome: 'Oficial', quem: 'quem está num quadro de oficiais' },
  { camada: 'gestorLateral', nome: nomeDoPapel('gestor_lateral'), quem: 'nas unidades irmãs' },
];

/**
 * "Quem vê o quê" (entrega 6.11, só o administrador): a borda das camadas de visão, uma marca por bloco e camada, e os quadros "de oficiais". As
 * camadas se somam: marcar "Todos" marca e trava as outras duas, e a Identificação de "Todos" não se desliga. Quem tem nível de acesso na unidade
 * do militar vê tudo dele, e CPF, nascimento e endereço ficam fora desta tabela.
 */
export function QuemVeOQue() {
  const borda = useQuery(consultaBorda);
  // o aviso fica aqui, e não na tabela: ao salvar, a borda gravada volta do servidor, a tabela recomeça com ela (key) e levaria o aviso junto
  const [aviso, setAviso] = useState<Aviso | null>(null);
  if (borda.isPending) return <p className="py-6 text-apagado">Carregando…</p>;
  if (borda.error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(borda.error)}</p>;
  return (
    <div className="grid max-w-4xl gap-8">
      {/* key: uma borda nova do servidor (a que acabou de ser gravada, ou outra gravação) recomeça a tabela */}
      <TabelaDaBorda key={JSON.stringify(borda.data)} inicial={borda.data} aviso={aviso} aoAvisar={setAviso} />
      <QuadrosDeOficiais />
    </div>
  );
}

type Aviso = { erro: boolean; texto: string };

function TabelaDaBorda({ inicial, aviso, aoAvisar }: { inicial: Borda; aviso: Aviso | null; aoAvisar: (a: Aviso | null) => void }) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState(inicial);
  const { salvando, travar } = useTrava();
  const sujo = JSON.stringify(linhas) !== JSON.stringify(inicial);

  const marcar = (bloco: Bloco, camada: Camada, marcada: boolean) => {
    aoAvisar(null);
    // "Todos" marca as outras duas: as camadas se somam, então o que todos veem o oficial e o quinto nível também veem
    setLinhas((ls) => ls.map((l) => (l.bloco !== bloco ? l : (({ ...l, [camada]: marcada }) as Borda[number]))).map((l) => (l.todos ? { ...l, oficial: true, gestorLateral: true } : l)));
  };
  const salvar = travar(async () => {
    aoAvisar(null);
    try {
      await salvarBorda(linhas);
      aoAvisar({ erro: false, texto: 'Alterações salvas.' });
      atualizarVisao(queryClient);
    } catch (e) {
      aoAvisar({ erro: true, texto: mensagemDe(e) });
    }
  });

  return (
    <section>
      <p className="max-w-2xl text-sm text-apagado">
        O que cada pessoa vê de um militar, na consulta, além do que o nível de acesso já dá. As camadas se somam: quem está em mais de uma vê o que cada uma libera.
        Quem tem nível de acesso na unidade do militar, ou acima, vê tudo dele. CPF, nascimento e endereço não entram aqui: são de quem cuida do Pecúlio.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-linha bg-superficie">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-linha text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Bloco</th>
              {CAMADAS.map((c) => (
                <th key={c.camada} scope="col" className="w-32 px-3 py-2.5 text-center align-top font-medium">
                  {c.nome}
                  <span className="mt-0.5 block text-xs font-normal text-apagado">{c.quem}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {linhas.map((l) => (
              <tr key={l.bloco}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="block font-medium">{BLOCOS[l.bloco].nome}</span>
                  <span className="block text-xs text-apagado">{BLOCOS[l.bloco].tem}</span>
                </th>
                {CAMADAS.map((c) => {
                  // a identificação de "todos" não se desliga; e o que "todos" vê as outras duas já veem
                  const travada = (l.bloco === 'identificacao' && c.camada === 'todos') || (c.camada !== 'todos' && l.todos);
                  return (
                    <td key={c.camada} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${BLOCOS[l.bloco].nome}: ${c.nome}`}
                        checked={l[c.camada]}
                        disabled={travada}
                        onChange={(e) => marcar(l.bloco, c.camada, e.target.checked)}
                        className="size-4 accent-vinho"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-apagado">A identificação de “Todos” fica sempre marcada: sem ela a consulta não mostra nada.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!sujo || salvando} onClick={() => void salvar()}>Salvar</Button>
        {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
      </div>
    </section>
  );
}

/** Os quadros "de oficiais": quem está num quadro marcado tem a camada do oficial. A marca vale na hora (uma por vez). */
function QuadrosDeOficiais() {
  const queryClient = useQueryClient();
  const quadros = useQuery(consultaQuadros);
  const [erro, setErro] = useState<string | null>(null);
  const { travar } = useTrava();
  const mudar = (q: Quadro, oficial: boolean) =>
    travar(async () => {
      setErro(null);
      try {
        await marcarQuadro(q.id, { oficial });
        atualizarVisao(queryClient);
      } catch (e) {
        setErro(mensagemDe(e));
      }
    })();
  if (quadros.isPending) return <p className="text-apagado">Carregando…</p>;
  if (quadros.error) return <p role="alert" className="text-alerta">{mensagemDe(quadros.error)}</p>;
  return (
    <section>
      <h2 className="font-cond text-xl font-semibold">Quadros de oficiais</h2>
      <p className="mt-1 max-w-2xl text-sm text-apagado">Quem está hoje num quadro marcado ganha a camada “Oficial”. A marca grava na hora.</p>
      <ul aria-label="Quadros" className="mt-3 divide-y divide-linha rounded-xl border border-linha bg-superficie">
        {quadros.data.map((q) => (
          <li key={q.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-16 shrink-0 font-cond font-semibold">{q.sigla}</span>
            <span className="min-w-0 flex-1 text-sm text-apagado">{q.nome}</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" aria-label={`${q.sigla}: de oficiais`} checked={q.oficial} onChange={(e) => mudar(q, e.target.checked)} className="size-4 accent-vinho" />
              de oficiais
            </label>
          </li>
        ))}
      </ul>
      {erro && <p role="alert" className="mt-2 text-sm text-alerta">{erro}</p>}
    </section>
  );
}
