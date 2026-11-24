import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { VersaoDaMetaPadrao } from 'contratos';
import { useState } from 'react';
import { mensagemComCampo, mensagemDe } from '@/api/cliente';
import { consultaMetaPadrao, gravarMetaPadrao } from '@/api/efetivo-do-dia';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { EditorDaMeta, useModelosDaMeta } from '@/componentes/efetivo-por-dia/EditorDaMeta';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { dataBr, hoje } from '@/lib/meses';
import { Espera } from '@/componentes/resposta/Espera';

const frase = (v: VersaoDaMetaPadrao) => `A partir de ${dataBr(v.desde)}: ${v.guarnicoes.map((g, i) => `${i + 1}º ${g.nome}`).join(', ') || 'nenhuma guarnição'}`;

/** Quem pode mudar parâmetro grava uma meta padrão nova (vale a partir da data); os outros só veem a lista. */
function GravarMetaPadrao({ unidadeId, emVigor }: { unidadeId: string; emVigor: VersaoDaMetaPadrao | undefined }) {
  const queryClient = useQueryClient();
  const atuais = emVigor?.guarnicoes ?? [];
  const { modelos, opcoes } = useModelosDaMeta(unidadeId, hoje().slice(0, 7), atuais);
  const [escolhidos, setEscolhidos] = useState<string[]>(atuais.map((g) => g.guarnicaoId));
  const [desde, setDesde] = useState(hoje());
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const { salvando, travar } = useTrava();

  const salvar = travar(async () => {
    setAviso(null);
    try {
      await gravarMetaPadrao(queryClient, unidadeId, { desde, guarnicoes: escolhidos });
      setAviso({ erro: false, texto: `Meta padrão salva a partir de ${dataBr(desde)}.` });
    } catch (e) {
      setAviso({ erro: true, texto: mensagemComCampo(e) });
    }
  });

  if (modelos.isPending) return <Espera className="px-4 py-3" />;
  if (modelos.error) return <p role="alert" className="px-4 py-3 text-alerta">{mensagemDe(modelos.error)}</p>;
  return (
    <div className="grid gap-4 border-t border-linha px-4 py-4">
      <h2 className="font-cond text-base font-semibold">Gravar uma meta padrão</h2>
      <EditorDaMeta opcoes={opcoes} escolhidos={escolhidos} aoMudar={setEscolhidos} semNenhum="Sem nenhum modelo marcado, a meta padrão fica vazia a partir da data." />
      <div className="grid gap-1.5">
        <Label htmlFor="meta-desde">Vale a partir de</Label>
        <Input id="meta-desde" type="date" min={hoje()} value={desde} onChange={(e) => setDesde(e.target.value)} className="w-44" />
        <p className="text-sm text-apagado">Os dias anteriores e os dias que o chefe alterou à mão não mudam.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={salvando || !desde || desde < hoje()} onClick={() => void salvar()}>Salvar</Button>
        {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
      </div>
    </div>
  );
}

/** Aba "Meta de ativação" das Configurações: a meta padrão em vigor, as que começam depois, e o editor. */
export function MetaDeAtivacao({ unidadeId, podeMudar }: { unidadeId: string; podeMudar: boolean }) {
  const versoes = useQuery(consultaMetaPadrao(unidadeId));
  if (versoes.isPending) return <Espera className="py-6" />;
  if (versoes.error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(versoes.error)}</p>;
  // da mais nova para a mais antiga: a que vale hoje é a primeira que já começou
  const emVigor = versoes.data.find((v) => v.desde <= hoje());
  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="px-4 py-3 text-sm text-apagado">
        A meta é a lista de modelos de guarnição que a seção quer ativar a cada dia, na ordem de ativação. A meta padrão vale para todos os dias a partir da data escolhida.
        {podeMudar ? '' : ' Só o gestor ou o administrador muda.'}
      </p>
      {versoes.data.length === 0 ? (
        <p className="border-t border-linha px-4 py-3 text-apagado">Nenhuma meta padrão gravada ainda.</p>
      ) : (
        <ul aria-label="Metas padrão" className="divide-y divide-linha border-t border-linha">
          {versoes.data.map((v) => (
            <li key={v.desde} className="flex flex-wrap items-center gap-x-3 px-4 py-2.5 text-sm">
              <span>{frase(v)}</span>
              {v === emVigor && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs font-medium">em vigor</span>}
            </li>
          ))}
        </ul>
      )}
      {podeMudar && <GravarMetaPadrao unidadeId={unidadeId} emVigor={emVigor} />}
    </div>
  );
}
