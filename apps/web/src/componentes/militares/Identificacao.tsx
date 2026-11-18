import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarMilitares, consultaPostos, editarMilitar } from '@/api/militares';
import { Selecao } from '@/componentes/Selecao';
import { AcoesDoBloco, usePendencia } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Secao } from './Secao';

export function Identificacao({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const postos = useQuery(consultaPostos);
  const [posto, setPosto] = useState(ficha.postoGradId);
  const [nome, setNome] = useState(ficha.nomeGuerra);
  const [antiguidade, setAntiguidade] = useState(ficha.antiguidade == null ? '' : String(ficha.antiguidade));
  const [jes, setJes] = useState(ficha.voluntarioJes);
  const [ativo, setAtivo] = useState(ficha.ativo);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const assinatura = (p: string, n: string, a: string, j: boolean, at: boolean) => JSON.stringify([p, n.trim().toUpperCase(), a.trim() ? Number(a) : null, j, at]);
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(() => assinatura(ficha.postoGradId, ficha.nomeGuerra, ficha.antiguidade == null ? '' : String(ficha.antiguidade), ficha.voluntarioJes, ficha.ativo));
  const sujo = assinatura(posto, nome, antiguidade, jes, ativo) !== salvo;
  usePendencia('identificacao', sujo);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    try {
      await editarMilitar(ficha.id, {
        postoGradId: posto,
        nomeGuerra: nome.trim().toUpperCase(),
        antiguidade: antiguidade.trim() ? Number(antiguidade) : null,
        voluntarioJes: jes,
        ativo,
      });
      setSalvo(assinatura(posto, nome, antiguidade, jes, ativo));
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={salvar} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_7rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="id-posto">Posto ou graduação</Label>
            <Selecao id="id-posto" value={posto} onChange={(e) => setPosto(e.target.value)}>
              {postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
            </Selecao>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="id-nome">Nome de guerra</Label>
            <Input id="id-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="id-antig">Antiguidade</Label>
            <Input id="id-antig" type="number" min={1} value={antiguidade} onChange={(e) => setAntiguidade(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={jes} onChange={(e) => setJes(e.target.checked)} className="size-4 accent-vinho" />
            Voluntário JES
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4 accent-vinho" />
            Ativo
          </label>
        </div>
        <AcoesDoBloco sujo={sujo} aviso={aviso} rotulo="Salvar alterações" />
      </form>
    </Secao>
  );
}
