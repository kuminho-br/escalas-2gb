import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, consultaFuncoesDoMilitar, consultaPostos, editarMilitar } from '@/api/militares';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { AcoesDoBloco, usePendencia, useTrava, useSincronizar } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { alteracoesDaIdentificacao, type ValoresIdentificacao } from './alteracoes';
import { DonoDoBloco, LISTA_NAO_CARREGOU, Secao } from './Secao';

/**
 * Identificação (posto-graduação, nome completo, nome de guerra, antiguidade, sexo, função e abono de permanência: do Pecúlio) e, na mesma ficha, o voluntário JES (da escala).
 * O quadro e a situação valem por período e ficam no "Histórico de rastreio".
 * Sem papel acima da lotação, os campos do Pecúlio ficam só para leitura, com a frase; os da escala seguem com quem tem papel na seção.
 */
export function Identificacao({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const postos = useQuery(consultaPostos);
  const funcoes = useQuery(consultaFuncoesDoMilitar);
  const peculio = ficha.podeEditar.peculio;
  const escala = ficha.podeEditar.escala;
  const [posto, setPosto] = useState(ficha.postoGradId);
  const [nomeCompleto, setNomeCompleto] = useState(ficha.nomeCompleto ?? '');
  const [nome, setNome] = useState(ficha.nomeGuerra);
  const [sexo, setSexo] = useState<'M' | 'F' | null>(ficha.sexo);
  const [antiguidade, setAntiguidade] = useState(ficha.antiguidade == null ? '' : String(ficha.antiguidade));
  const [jes, setJes] = useState(ficha.voluntarioJes);
  // a função escolhida: '' é "sem função"
  const [funcaoId, setFuncaoId] = useState(ficha.funcaoMilitarId ?? '');
  const [abono, setAbono] = useState(ficha.abonoPermanencia);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  // o que está na tela, no formato do servidor (a antiguidade vazia é null)
  const atual: ValoresIdentificacao = {
    postoGradId: posto, nomeCompleto, nomeGuerra: nome, sexo, antiguidade: antiguidade.trim() ? Number(antiguidade) : null, voluntarioJes: jes,
    funcaoMilitarId: funcaoId || null, abonoPermanencia: abono,
  };
  const valoresDoServidor: ValoresIdentificacao = {
    postoGradId: ficha.postoGradId, nomeCompleto: ficha.nomeCompleto ?? '', nomeGuerra: ficha.nomeGuerra, sexo: ficha.sexo, antiguidade: ficha.antiguidade, voluntarioJes: ficha.voluntarioJes,
    funcaoMilitarId: ficha.funcaoMilitarId, abonoPermanencia: ficha.abonoPermanencia,
  };
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente, e é só isso que se grava
  const [salvo, setSalvo] = useState<ValoresIdentificacao>(valoresDoServidor);
  const alteracoes = alteracoesDaIdentificacao(salvo, atual);
  const sujo = Object.keys(alteracoes).length > 0;
  usePendencia('identificacao', sujo);
  const antiguidadeDoServidor = ficha.antiguidade == null ? '' : String(ficha.antiguidade);
  useSincronizar(JSON.stringify(valoresDoServidor), sujo, () => {
    setPosto(ficha.postoGradId);
    setNomeCompleto(ficha.nomeCompleto ?? '');
    setNome(ficha.nomeGuerra);
    setSexo(ficha.sexo);
    setAntiguidade(antiguidadeDoServidor);
    setJes(ficha.voluntarioJes);
    setFuncaoId(ficha.funcaoMilitarId ?? '');
    setAbono(ficha.abonoPermanencia);
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
  // o nome completo apagado de quem já tinha: a ficha pede que continue preenchido (o servidor não aceita vazio)
  const nomeCompletoApagado = !nomeCompleto.trim() && Boolean(ficha.nomeCompleto);
  // só as funções ativas entram na escolha; a que o militar já tem continua nela, mesmo desativada
  const funcoesAtivas = funcoes.data?.filter((f) => f.ativo) ?? [];
  const funcaoDesativada = ficha.funcaoMilitarId && ficha.funcao && !funcoesAtivas.some((f) => f.id === ficha.funcaoMilitarId) ? { id: ficha.funcaoMilitarId, nome: ficha.funcao } : null;

  return (
    <Secao titulo="Identificação">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="id-completo" rotulo="Nome completo" erro={campos.nomeCompleto ?? (nomeCompletoApagado ? 'Preencha este campo.' : undefined)}>
            <Input id="id-completo" value={nomeCompleto} disabled={!peculio} onChange={(e) => setNomeCompleto(e.target.value)} />
          </Campo>
          <Campo id="id-nome" rotulo="Nome de guerra" erro={campos.nomeGuerra}>
            <Input id="id-nome" value={nome} disabled={!peculio} onChange={(e) => setNome(e.target.value)} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[10rem_7rem_9rem]">
          <Campo id="id-posto" rotulo="Posto-graduação" erro={campos.postoGradId ?? ((postos.isError && !postos.data) ? LISTA_NAO_CARREGOU : undefined)}>
            <Selecao id="id-posto" value={posto} disabled={!peculio} onChange={(e) => setPosto(e.target.value)}>
              {postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
            </Selecao>
          </Campo>
          <Campo id="id-antig" rotulo="Antiguidade" erro={campos.antiguidade}>
            <Input id="id-antig" type="number" min={1} value={antiguidade} disabled={!peculio} onChange={(e) => setAntiguidade(e.target.value)} />
          </Campo>
          <Campo id="id-sexo" rotulo="Sexo" erro={campos.sexo}>
            <Selecao id="id-sexo" value={sexo ?? ''} disabled={!peculio} onChange={(e) => setSexo(e.target.value === 'M' ? 'M' : e.target.value === 'F' ? 'F' : null)}>
              <option value="">Sem informação</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </Selecao>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[16rem]">
          <Campo id="id-funcao" rotulo="Função" erro={campos.funcaoMilitarId ?? ((funcoes.isError && !funcoes.data) ? LISTA_NAO_CARREGOU : undefined)}>
            <Selecao id="id-funcao" value={funcaoId} disabled={!peculio} onChange={(e) => setFuncaoId(e.target.value)}>
              <option value="">Sem função</option>
              {funcoesAtivas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              {funcaoDesativada && <option value={funcaoDesativada.id}>{funcaoDesativada.nome} (desativada)</option>}
            </Selecao>
          </Campo>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={jes} disabled={!escala} onChange={(e) => setJes(e.target.checked)} className="size-4 accent-vinho" />
            Voluntário JES
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={abono} disabled={!peculio} onChange={(e) => setAbono(e.target.checked)} className="size-4 accent-vinho" />
            Abono de permanência
          </label>
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={nomeCompletoApagado} aviso={aviso} rotulo="Salvar alterações" />
      </form>
    </Secao>
  );
}
