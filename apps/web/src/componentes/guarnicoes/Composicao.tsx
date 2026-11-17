import { useQueryClient } from '@tanstack/react-query';
import type { Funcao } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { criarFuncao } from '@/api/guarnicoes';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

export type LinhaEdicao = { chave: number; funcaoId: string; minimo: number; maximo: number | null; cnh: string };

const NOVA = '__nova';
const CATEGORIAS = ['A', 'B', 'C', 'D', 'E'];

function Passo({ grandeza, nome, valor, onMenos, onMais, menosOff, maisOff }: {
  grandeza: 'mínimo' | 'máximo'; nome: string; valor: number | null; onMenos: () => void; onMais: () => void; menosOff: boolean; maisOff: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon-xs" aria-label={`Diminuir ${grandeza} de ${nome}`} disabled={menosOff} onClick={onMenos}>−</Button>
      <span aria-label={`${grandeza === 'mínimo' ? 'Mínimo' : 'Máximo'} de ${nome}`} className="min-w-12 text-center text-sm tabular-nums">{valor === null ? 'sem limite' : valor}</span>
      <Button type="button" variant="outline" size="icon-xs" aria-label={`Aumentar ${grandeza} de ${nome}`} disabled={maisOff} onClick={onMais}>+</Button>
    </div>
  );
}

/** Uma linha por função, na ordem em que valem na ficha e no documento. */
export function Composicao({ linhas, aoMudar, funcoes, unidadeId, aoCriarFuncao }: {
  linhas: LinhaEdicao[];
  aoMudar: (l: LinhaEdicao[]) => void;
  funcoes: Funcao[];
  unidadeId: string;
  aoCriarFuncao: (f: Funcao) => void;
}) {
  const queryClient = useQueryClient();
  const [criando, setCriando] = useState<number | null>(null);
  const [nomeNovo, setNomeNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (chave: number, parte: Partial<LinhaEdicao>) => aoMudar(linhas.map((l) => (l.chave === chave ? { ...l, ...parte } : l)));
  const nomeDe = (l: LinhaEdicao, i: number) => funcoes.find((f) => f.id === l.funcaoId)?.nome ?? `linha ${i + 1}`;

  async function criar(chave: number) {
    setErro(null);
    try {
      const f = await criarFuncao(unidadeId, nomeNovo.trim());
      aoCriarFuncao(f);
      void queryClient.invalidateQueries({ queryKey: ['funcoes'] });
      mudar(chave, { funcaoId: f.id });
      setCriando(null);
      setNomeNovo('');
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {linhas.map((l, i) => {
          const nome = nomeDe(l, i);
          return (
            <li key={l.chave} className="grid gap-3 rounded-lg border border-linha p-3">
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(10rem,1fr)_auto_auto_7rem_auto]">
                <Selecao
                  aria-label={`Função ${i + 1}`}
                  value={l.funcaoId}
                  onChange={(e) => {
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
                <Passo
                  grandeza="mínimo" nome={nome}
                  valor={l.minimo}
                  menosOff={l.minimo <= 0}
                  maisOff={l.maximo !== null && l.minimo >= l.maximo}
                  onMenos={() => mudar(l.chave, { minimo: l.minimo - 1 })}
                  onMais={() => mudar(l.chave, { minimo: l.minimo + 1 })}
                />
                <div className="flex items-center gap-2">
                  <Passo
                    grandeza="máximo" nome={nome}
                    valor={l.maximo}
                    menosOff={l.maximo === null || l.maximo <= l.minimo}
                    maisOff={l.maximo === null}
                    onMenos={() => mudar(l.chave, { maximo: l.maximo! - 1 })}
                    onMais={() => mudar(l.chave, { maximo: l.maximo! + 1 })}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      aria-label={`Sem limite de ${nome}`}
                      checked={l.maximo === null}
                      onChange={(e) => mudar(l.chave, { maximo: e.target.checked ? null : l.minimo })}
                      className="size-4 accent-vinho"
                    />
                    Sem limite
                  </label>
                </div>
                <Selecao aria-label={`CNH exigida de ${nome}`} value={l.cnh} onChange={(e) => mudar(l.chave, { cnh: e.target.value })}>
                  <option value="">CNH: nenhuma</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>CNH {c}</option>)}
                </Selecao>
                <Button type="button" variant="ghost" size="xs" aria-label={`Retirar ${nome}`} onClick={() => aoMudar(linhas.filter((x) => x.chave !== l.chave))}>
                  Retirar
                </Button>
              </div>
              {criando === l.chave && (
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label="Nome da nova função" value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} className="max-w-xs" />
                  <Button type="button" size="sm" disabled={!nomeNovo.trim()} onClick={() => void criar(l.chave)}>Criar</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCriando(null)}>Cancelar</Button>
                </div>
              )}
            </li>
          );
        })}
        {linhas.length === 0 && <li className="text-sm text-apagado">Nenhuma função na composição.</li>}
      </ul>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      <div>
        <Button type="button" variant="outline" onClick={() => aoMudar([...linhas, { chave: Math.max(0, ...linhas.map((x) => x.chave)) + 1, funcaoId: '', minimo: 1, maximo: 1, cnh: '' }])}>
          Incluir função
        </Button>
      </div>
    </div>
  );
}
