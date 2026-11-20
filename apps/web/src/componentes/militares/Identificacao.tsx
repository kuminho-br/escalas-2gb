import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, consultaPostos, editarMilitar } from '@/api/militares';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { AcoesDoBloco, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { alteracoesDaIdentificacao, type ValoresIdentificacao } from './alteracoes';
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
  const [campos, setCampos] = useState<Record<string, string>>({});
  // o que está na tela, no formato do servidor (a antiguidade vazia é null)
  const atual: ValoresIdentificacao = { postoGradId: posto, nomeGuerra: nome, antiguidade: antiguidade.trim() ? Number(antiguidade) : null, voluntarioJes: jes, ativo };
  const valoresDoServidor: ValoresIdentificacao = { postoGradId: ficha.postoGradId, nomeGuerra: ficha.nomeGuerra, antiguidade: ficha.antiguidade, voluntarioJes: ficha.voluntarioJes, ativo: ficha.ativo };
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente, e é só isso que se grava
  const [salvo, setSalvo] = useState<ValoresIdentificacao>(valoresDoServidor);
  const alteracoes = alteracoesDaIdentificacao(salvo, atual);
  const sujo = Object.keys(alteracoes).length > 0;
  usePendencia('identificacao', sujo);
  const antiguidadeDoServidor = ficha.antiguidade == null ? '' : String(ficha.antiguidade);
  useSincronizar(JSON.stringify(valoresDoServidor), sujo, () => {
    setPosto(ficha.postoGradId);
    setNome(ficha.nomeGuerra);
    setAntiguidade(antiguidadeDoServidor);
    setJes(ficha.voluntarioJes);
    setAtivo(ficha.ativo);
    setSalvo(valoresDoServidor);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    setCampos({});
    if (!sujo) return;
    try {
      await editarMilitar(ficha.id, alteracoes);
      // o que foi enviado vira o novo "salvo": uma edição feita durante a gravação continua pendente
      setSalvo(atual);
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setCampos(camposDe(err));
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Identificação">
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_7rem]">
          <Campo id="id-posto" rotulo="Posto ou graduação" erro={campos.postoGradId}>
            <Selecao id="id-posto" value={posto} onChange={(e) => setPosto(e.target.value)}>
              {postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
            </Selecao>
          </Campo>
          <Campo id="id-nome" rotulo="Nome de guerra" erro={campos.nomeGuerra}>
            <Input id="id-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo id="id-antig" rotulo="Antiguidade" erro={campos.antiguidade}>
            <Input id="id-antig" type="number" min={1} value={antiguidade} onChange={(e) => setAntiguidade(e.target.value)} />
          </Campo>
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
        <AcoesDoBloco salvando={salvando} sujo={sujo} aviso={aviso} rotulo="Salvar alterações" />
      </form>
    </Secao>
  );
}
