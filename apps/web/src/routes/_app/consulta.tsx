import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaDaBusca, consultaUnidadesDaBusca } from '@/api/consulta';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Moldura } from '@/componentes/Moldura';

export const MSG_BUSCA_CURTA = 'Digite pelo menos 3 letras ou escolha uma unidade.';
export const MSG_HA_MAIS = 'Há mais militares. Refine a busca.';

type Busca = { texto?: string; unidade?: string };

export const Route = createFileRoute('/_app/consulta')({
  // a busca fica no endereço: voltar da ficha de consulta traz o mesmo resultado
  validateSearch: (s: Record<string, unknown>): Busca => ({
    texto: typeof s.texto === 'string' && s.texto.trim() ? s.texto.trim() : undefined,
    unidade: typeof s.unidade === 'string' && s.unidade ? s.unidade : undefined,
  }),
  component: Consulta,
});

/**
 * A consulta de militares (entrega 6.11): todo militar com conta busca qualquer militar da corporação. A linha mostra só a identificação; abrir
 * leva à ficha de consulta, que traz só o que a pessoa pode ver (docs: "Telas").
 */
function Consulta() {
  const { texto = '', unidade = '' } = Route.useSearch();
  return (
    <Moldura titulo="Consulta de militares">
      {/* key: voltar ou avançar no navegador põe os campos no que a busca do endereço diz */}
      <Formulario key={`${texto}|${unidade}`} texto={texto} unidade={unidade} />
      <Resultado texto={texto} unidade={unidade} />
    </Moldura>
  );
}

function Formulario({ texto, unidade }: { texto: string; unidade: string }) {
  const navigate = useNavigate({ from: Route.fullPath });
  const unidades = useQuery(consultaUnidadesDaBusca);
  const [campo, setCampo] = useState(texto);
  const [escolhida, setEscolhida] = useState(unidade);
  const [erro, setErro] = useState<string | null>(null);
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (campo.trim().length < 3 && !escolhida) {
      setErro(MSG_BUSCA_CURTA);
      return;
    }
    setErro(null);
    void navigate({ search: { texto: campo.trim() || undefined, unidade: escolhida || undefined } });
  };
  return (
    <form onSubmit={buscar} className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end" role="search">
      <div className="grid gap-1.5">
        <Label htmlFor="consulta-texto">Nome, nome de guerra ou matrícula</Label>
        <Input
          id="consulta-texto"
          value={campo}
          onChange={(e) => setCampo(e.target.value)}
          className="bg-superficie"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? 'consulta-erro' : undefined}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="consulta-unidade">Lotados em</Label>
        {/* pela árvore, nó a nó (6.45): a busca pega a unidade escolhida e as de baixo; sem unidade, toda a corporação */}
        <EscolherUnidade id="consulta-unidade" rotulo="Lotados em" unidades={unidades.data ?? []} valor={escolhida} aoEscolher={setEscolhida} permiteLimpar textoVazio="Toda a corporação" />
      </div>
      <Button type="submit">
        <Search aria-hidden />
        Buscar
      </Button>
      {erro && <p id="consulta-erro" role="alert" className="text-sm text-alerta sm:col-span-3">{erro}</p>}
    </form>
  );
}

function Resultado({ texto, unidade }: { texto: string; unidade: string }) {
  const pode = texto.length >= 3 || unidade !== '';
  const busca = useQuery({ ...consultaDaBusca(texto, unidade), enabled: pode });
  if (!pode) return <p className="mt-8 max-w-xl text-apagado">Busque pelo nome, pelo nome de guerra ou pela matrícula. Para ver quem está lotado numa unidade, escolha a unidade em “Lotados em”.</p>;
  if (busca.isPending) return <p className="mt-8 text-apagado">Buscando…</p>;
  if (busca.error) return <p role="alert" className="mt-8 text-alerta">{mensagemDe(busca.error)}</p>;
  const { militares, haMais } = busca.data;
  if (militares.length === 0) return <p className="mt-8 max-w-xl text-apagado">Nenhum militar encontrado. Confira o nome ou a matrícula, ou escolha outra unidade.</p>;
  return (
    <div className="mt-6 max-w-3xl">
      {haMais && <p role="status" className="mb-3 rounded-md bg-pendencia-fundo px-3 py-2 text-sm text-pendencia">{MSG_HA_MAIS}</p>}
      {/* o mesmo desenho da lista do Pecúlio: posto e nome de guerra, a lotação no canto, e embaixo o nome completo, a matrícula e o quadro */}
      <div className="rounded-xl border border-linha bg-superficie">
        <ul aria-label="Militares encontrados" className="p-2">
          {militares.map((m) => (
            <li key={m.id}>
              <Link to="/consulta/$id" params={{ id: m.id }} search={{ texto: texto || undefined, unidade: unidade || undefined }} className="grid gap-0.5 rounded-lg px-3 py-2 hover:bg-accent">
                <span className="flex items-center gap-2">
                  <span className="font-cond text-apoio text-apagado">{m.postoGrad}</span>
                  <span className="font-cond text-base font-semibold">{m.nomeGuerra}</span>
                  <span className="ml-auto rounded border border-linha px-1.5 font-cond text-xs">{m.lotacao ?? 'Sem lotação'}</span>
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs text-apagado">
                  {m.nomeCompleto && <span>{m.nomeCompleto}</span>}
                  <span>{m.matricula}</span>
                  {m.quadro && <span>{m.quadro}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
