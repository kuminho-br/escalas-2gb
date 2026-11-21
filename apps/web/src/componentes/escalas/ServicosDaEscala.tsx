import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Escala } from 'contratos';
import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, salvarServicosDaEscala } from '@/api/escalas';
import { consultaServicos } from '@/api/servicos';
import { AcoesDoBloco, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { Secao } from '@/componentes/militares/Secao';
import { Selecao } from '@/componentes/Selecao';
import { QuadradoDaCor } from '@/componentes/QuadradoDaCor';
import { Button } from '@/componentes/ui/button';

type Item = { id: string; nome: string; cor: string };

/** Serviços reunidos na ordem de preenchimento (o primeiro é o que uma alocação nova recebe). */
export function ServicosDaEscala({ escala, unidadeId }: { escala: Escala; unidadeId: string }) {
  const queryClient = useQueryClient();
  const servicos = useQuery(consultaServicos(unidadeId));
  const [itens, setItens] = useState<Item[]>(escala.servicos);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  // o último gravado (começa com o que veio do servidor): a ordem que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => escala.servicos.map((x) => x.id).join('|'));
  const sujo = itens.map((x) => x.id).join('|') !== salvo;
  usePendencia('servicos', sujo);
  const doServidor = escala.servicos.map((x) => `${x.id}:${x.nome}:${x.cor}`).join('|');
  useSincronizar(doServidor, sujo, () => {
    setItens(escala.servicos);
    setSalvo(escala.servicos.map((x) => x.id).join('|'));
  });
  const fora = (servicos.data ?? []).filter((s) => s.ativo && !itens.some((i) => i.id === s.id));
  // escolher na lista só marca; quem põe o serviço na escala é o botão "Incluir" (e quem grava é o "Salvar serviços")
  const [escolhido, setEscolhido] = useState('');
  const doEscolhido = fora.find((x) => x.id === escolhido);

  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= itens.length) return;
    const n = [...itens];
    [n[i], n[j]] = [n[j]!, n[i]!];
    setItens(n);
  }
  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    try {
      await salvarServicosDaEscala(escala.id, itens.map((i) => i.id));
      setSalvo(itens.map((i) => i.id).join('|'));
      atualizarEscalas(queryClient);
      setAviso({ erro: false, texto: 'Serviços salvos.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Serviços">
      <p className="-mt-1 mb-3 text-xs text-apagado">Na ordem de preenchimento: o primeiro é o que um militar novo na escala recebe.</p>
      <ol className="grid gap-1.5">
        {itens.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-linha px-3 py-1.5 text-sm">
            <QuadradoDaCor cor={s.cor} />
            <Link to="/servicos/$id" params={{ id: s.id }} className="font-medium text-vinho hover:underline">{s.nome}</Link>
            <span className="ml-auto flex gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label={`Subir ${s.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={`Descer ${s.nome}`} disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>
                <ArrowDown aria-hidden />
              </Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remover ${s.nome}`} onClick={() => setItens(itens.filter((x) => x.id !== s.id))}>
                Remover
              </Button>
            </span>
          </li>
        ))}
      </ol>
      {itens.length === 0 && <p className="text-sm text-apagado">Nenhum serviço ainda.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {fora.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <Selecao aria-label="Incluir serviço" value={doEscolhido ? escolhido : ''} className="w-56" onChange={(ev) => setEscolhido(ev.target.value)}>
              <option value="">Incluir serviço…</option>
              {fora.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Selecao>
            <Button
              type="button"
              variant="outline"
              disabled={!doEscolhido}
              onClick={() => {
                if (!doEscolhido) return;
                setItens([...itens, { id: doEscolhido.id, nome: doEscolhido.nome, cor: doEscolhido.cor }]);
                setEscolhido('');
              }}
            >
              Incluir
            </Button>
          </span>
        )}
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} tipo="button" rotulo="Salvar serviços" aoSalvar={() => void salvar()} />
      </div>
    </Secao>
  );
}
