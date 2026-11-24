import { useQueryClient } from '@tanstack/react-query';
import { CategoriaCnh, QuantidadeDeMilitares, type Funcao } from 'contratos';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { criarFuncao, renomearFuncao } from '@/api/guarnicoes';
import { usePendencia, useTrava } from '@/componentes/AlteracoesPendentes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

/** `cnh` vazia = não exige CNH. */
export type LinhaEdicao = { chave: number; funcaoId: string; minimo: number; maximo: number; cnh: string };

const NOVA = '__nova';
// as categorias da carteira vêm do contrato (uma fonte só)
const CATEGORIAS = CategoriaCnh.options;

function Passo({ grandeza, nome, valor, onMenos, onMais, menosOff, maisOff }: {
  grandeza: 'mínimo' | 'máximo'; nome: string; valor: number; onMenos: () => void; onMais: () => void; menosOff: boolean; maisOff: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Button type="button" variant="secundario" size="icon-xs" aria-label={`Diminuir ${grandeza} de ${nome}`} disabled={menosOff} onClick={onMenos}>−</Button>
      <span aria-label={`${grandeza === 'mínimo' ? 'Mínimo' : 'Máximo'} de ${nome}`} className="min-w-6 text-center tabular-nums">{valor}</span>
      <Button type="button" variant="secundario" size="icon-xs" aria-label={`Aumentar ${grandeza} de ${nome}`} disabled={maisOff} onClick={onMais}>+</Button>
    </span>
  );
}

/** Uma linha por função, lida como frase: "Chefe de 1 a 2 militares, exige CNH D". */
export function Composicao({ linhas, aoMudar, funcoes, unidadeId, aoMudarFuncao }: {
  linhas: LinhaEdicao[];
  aoMudar: (l: LinhaEdicao[]) => void;
  funcoes: Funcao[];
  unidadeId: string;
  /** função criada ou renomeada aqui, para aparecer já com o nome novo */
  aoMudarFuncao: (f: Funcao) => void;
}) {
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState<number | null>(null);
  const [nomeNovo, setNomeNovo] = useState('');
  const [renomeando, setRenomeando] = useState<{ chave: number; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // criar e renomear gravam na hora: travados, dois cliques seguidos mandam um pedido só; o nome novo digitado e não criado é alteração pendente
  const { salvando: gravando, travar } = useTrava();
  // só conta enquanto a linha da função nova existe (remover a linha desfaz o que ela tinha)
  usePendencia('funcao-nova', criando !== null && linhas.some((l) => l.chave === criando) && nomeNovo.trim() !== '');

  const mudar = (chave: number, parte: Partial<LinhaEdicao>) => aoMudar(linhas.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  const funcaoDe = (l: LinhaEdicao) => funcoes.find((f) => f.id === l.funcaoId);
  // a linha some com o que estava aberto nela (nome novo, renomear): um número de linha reaproveitado não herda a caixa de ninguém
  const remover = (chave: number) => {
    if (criando === chave) {
      setCriando(null);
      setNomeNovo('');
    }
    if (renomeando?.chave === chave) setRenomeando(null);
    aoMudar(linhas.filter((x) => x.chave !== chave));
  };

  const criar = travar(async (chave: number) => {
    setErro(null);
    try {
      const f = await criarFuncao(unidadeId, nomeNovo.trim());
      aoMudarFuncao(f);
      void queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      mudar(chave, { funcaoId: f.id });
      setCriando(null);
      setNomeNovo('');
    } catch (err) {
      setErro(mensagemDe(err));
    }
  });

  const renomear = travar(async (funcaoId: string) => {
    if (!renomeando) return;
    setErro(null);
    try {
      const f = await renomearFuncao(funcaoId, renomeando.nome.trim());
      aoMudarFuncao(f);
      void queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      void queryClient.invalidateQueries({ queryKey: ['guarnicao'] });
      setRenomeando(null);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  });

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {linhas.map((l, i) => {
          const funcao = funcaoDe(l);
          const nome = funcao?.nome ?? `linha ${i + 1}`;
          const exige = l.cnh !== '';
          return (
            <li key={l.chave} className="grid gap-2 rounded-lg border border-linha px-3 py-2">
              {/* no computador, cada função cabe numa linha: função, mínimo e máximo, CNH (largura reservada) e Remover */}
              <div className="grid items-center gap-x-3 gap-y-2 text-sm sm:grid-cols-[minmax(12rem,1fr)_auto_10.5rem_auto]">
                <span className="flex items-center gap-1">
                  <Selecao
                    aria-label={`Função ${i + 1}`}
                    value={l.funcaoId}
                    onChange={(e) => {
                      setRenomeando(null);
                      if (e.target.value === NOVA) {
                        setCriando(l.chave);
                        return;
                      }
                      setCriando(null);
                      mudar(l.chave, { funcaoId: e.target.value });
                    }}
                  >
                    <option value="">Escolha a função</option>
                    {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.herdada ? ` (${f.unidadeSigla})` : ''}</option>)}
                    <option value={NOVA}>Nova função…</option>
                  </Selecao>
                  {funcao && !funcao.herdada && (
                    <Button type="button" variant="discreto" size="icon-sm" aria-label={`Renomear ${funcao.nome}`} onClick={() => setRenomeando({ chave: l.chave, nome: funcao.nome })}>
                      <Pencil aria-hidden />
                    </Button>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  de
                  <Passo
                    grandeza="mínimo"
                    nome={nome}
                    valor={l.minimo}
                    menosOff={l.minimo <= 0}
                    maisOff={l.minimo >= l.maximo}
                    onMenos={() => mudar(l.chave, { minimo: l.minimo - 1 })}
                    onMais={() => mudar(l.chave, { minimo: l.minimo + 1 })}
                  />
                  a
                  <Passo
                    grandeza="máximo"
                    nome={nome}
                    valor={l.maximo}
                    menosOff={l.maximo <= l.minimo}
                    // o contrato limita a quantidade (99): o botão para ali, em vez de a API recusar ao salvar
                    maisOff={!QuantidadeDeMilitares.safeParse(l.maximo + 1).success}
                    onMenos={() => mudar(l.chave, { maximo: l.maximo - 1 })}
                    onMais={() => mudar(l.chave, { maximo: l.maximo + 1 })}
                  />
                  militares
                </span>
                <span className="inline-flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <input
                      type="checkbox"
                      aria-label={`Exige CNH para ${nome}`}
                      checked={exige}
                      onChange={(e) => mudar(l.chave, { cnh: e.target.checked ? 'D' : '' })}
                      className="size-4 accent-vinho"
                    />
                    Exige CNH
                  </label>
                  {exige && (
                    <Selecao aria-label={`CNH exigida de ${nome}`} value={l.cnh} onChange={(e) => mudar(l.chave, { cnh: e.target.value })} className="w-16">
                      {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Selecao>
                  )}
                </span>
                <Button type="button" variant="discreto" size="xs" aria-label={`Remover ${nome}`} className="justify-self-end" onClick={() => remover(l.chave)}>
                  Remover
                </Button>
              </div>
              {renomeando?.chave === l.chave && funcao && (
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={`Novo nome de ${funcao.nome}`}
                      value={renomeando.nome}
                      onChange={(e) => setRenomeando({ chave: l.chave, nome: e.target.value })}
                      className="max-w-xs"
                    />
                    <Button type="button" size="sm" disabled={!renomeando.nome.trim() || gravando} onClick={() => void renomear(funcao.id)}>Salvar nome</Button>
                    <Button type="button" size="sm" variant="discreto" onClick={() => setRenomeando(null)}>Cancelar</Button>
                  </div>
                  <p className="text-xs text-apagado">O nome muda em todas as guarnições.</p>
                </div>
              )}
              {criando === l.chave && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Nome da nova função" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} className="max-w-xs" />
                  <Button type="button" size="sm" disabled={!nomeNovo.trim() || gravando} onClick={() => void criar(l.chave)}>Criar</Button>
                  <Button type="button" size="sm" variant="discreto" disabled={gravando} onClick={() => setCriando(null)}>Cancelar</Button>
                </div>
              )}
            </li>
          );
        })}
        {linhas.length === 0 && <li className="text-sm text-apagado">Nenhuma função na composição.</li>}
      </ul>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      <div>
        <Button type="button" variant="secundario" onClick={() => aoMudar([...linhas, { chave: Math.max(0, ...linhas.map((x) => x.chave)) + 1, funcaoId: '', minimo: 1, maximo: 1, cnh: '' }])}>
          Incluir função
        </Button>
      </div>
    </div>
  );
}
