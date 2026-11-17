import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, type FichaGuarnicao, type Funcao, type VersaoSalva } from 'contratos';
import { useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { atualizarGuarnicoes, consultaFuncoes, salvarVersao } from '@/api/guarnicoes';
import { Composicao, type LinhaEdicao } from '@/componentes/guarnicoes/Composicao';
import { Secao } from '@/componentes/militares/Secao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { cn } from '@/lib/utils';

/** A versão em vigor no mês; sem nenhuma ainda, a primeira. As versões vêm da mais recente para a mais antiga. */
function versaoVigente(versoes: VersaoSalva[], mes: string): VersaoSalva | undefined {
  return versoes.find((v) => v.vigencia <= mes) ?? versoes[versoes.length - 1];
}

export function Versoes({ ficha, unidadeId }: { ficha: FichaGuarnicao; unidadeId: string }) {
  const mes = mesAtual();
  const vigente = versaoVigente(ficha.versoes, mes);
  const [escolhida, setEscolhida] = useState(vigente?.vigencia ?? '');
  const versao = ficha.versoes.find((v) => v.vigencia === escolhida) ?? vigente;

  return (
    <Secao titulo="Versões">
      {ficha.versoes.length > 1 && (
        <ol className="mb-4 flex flex-wrap gap-2" aria-label="Versões por vigência">
          {[...ficha.versoes].reverse().map((v) => (
            <li key={v.vigencia}>
              <button
                type="button"
                aria-pressed={v.vigencia === versao?.vigencia}
                onClick={() => setEscolhida(v.vigencia)}
                className={cn('rounded-md border px-2.5 py-1 text-sm', v.vigencia === versao?.vigencia ? 'border-tinta bg-tinta text-white' : 'border-linha')}
              >
                {mesPorExtenso(v.vigencia)}
                {v.vigencia === vigente?.vigencia && v.vigencia <= mes && <span className="ml-1.5 text-xs opacity-80">em vigor</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
      <Editor key={`${ficha.id}-${versao?.vigencia ?? 'nova'}`} ficha={ficha} unidadeId={unidadeId} versao={versao} />
    </Secao>
  );
}

function Editor({ ficha, unidadeId, versao }: { ficha: FichaGuarnicao; unidadeId: string; versao: VersaoSalva | undefined }) {
  const queryClient = useQueryClient();
  const funcoes = useQuery(consultaFuncoes(unidadeId));
  // funções criadas ou renomeadas aqui, até a lista voltar do servidor
  const [locais, setLocais] = useState<Funcao[]>([]);
  const [viatura, setViatura] = useState(versao?.viatura ?? '');
  const [tipoViatura, setTipoViatura] = useState(versao?.tipoViatura ?? '');
  const [prioridade, setPrioridade] = useState(versao?.prioridade == null ? '' : String(versao.prioridade));
  const [ativa, setAtiva] = useState(versao?.ativa ?? true);
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(
    (versao?.composicao ?? []).map((c, i) => ({ chave: i + 1, funcaoId: c.funcaoId, minimo: c.minimo, maximo: c.maximo, cnh: c.cnhExigida ?? '' })),
  );
  // sugere o mês corrente, ou o começo da versão quando ela só vale no futuro
  const [desde, setDesde] = useState(versao && versao.vigencia > mesAtual() ? versao.vigencia : mesAtual());
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);

  const servidor = funcoes.data ?? [];
  const opcoes = [...servidor.map((f) => locais.find((l) => l.id === f.id) ?? f), ...locais.filter((l) => !servidor.some((f) => f.id === l.id))];

  async function salvar() {
    setAviso(null);
    if (linhas.some((l) => !l.funcaoId)) {
      setAviso({ erro: true, texto: 'Escolha a função de cada linha.' });
      return;
    }
    try {
      await salvarVersao(ficha.id, desde, {
        viatura: viatura.trim() || null,
        tipoViatura: tipoViatura.trim() || null,
        prioridade: prioridade.trim() ? Number(prioridade) : null,
        ativa,
        composicao: linhas.map((l) => ({ funcaoId: l.funcaoId, minimo: l.minimo, maximo: l.maximo, cnhExigida: (l.cnh || null) as 'A' | 'B' | 'C' | 'D' | 'E' | null })),
      });
      atualizarGuarnicoes(queryClient, ficha.id);
      setAviso({ erro: false, texto: `Salvo a partir de ${mesPorExtenso(desde)}.` });
    } catch (err) {
      const primeiro = err instanceof ErroApi && err.campos ? Object.values(err.campos)[0] : undefined;
      setAviso({ erro: true, texto: primeiro ? `${mensagemDe(err)} ${primeiro}` : mensagemDe(err) });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="gv-viatura">Sigla da viatura</Label>
          <Input id="gv-viatura" value={viatura} onChange={(e) => setViatura(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gv-tipo">Tipo de viatura</Label>
          <Input id="gv-tipo" value={tipoViatura} onChange={(e) => setTipoViatura(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gv-prioridade">Prioridade</Label>
          <Input id="gv-prioridade" type="number" min={1} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-apagado">A viatura é só informativa: não muda as vagas. A prioridade define a ordem de ativação; sem prioridade, a guarnição vai por último.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="size-4 accent-vinho" />
        Ativa
      </label>

      <div className="grid gap-2">
        <h4 className="font-cond text-base font-semibold">Composição</h4>
        <Composicao linhas={linhas} aoMudar={setLinhas} funcoes={opcoes} unidadeId={unidadeId} aoMudarFuncao={(f) => setLocais((x) => [...x.filter((y) => y.id !== f.id), f])} />
      </div>

      <div className="grid gap-3 border-t border-linha pt-3 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="gv-desde">A partir de</Label>
          <Input id="gv-desde" type="month" value={desde} min={mesAtual()} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!desde} onClick={() => void salvar()}>
            Salvar a partir de {desde ? mesPorExtenso(desde) : '…'}
          </Button>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
        </div>
      </div>
    </div>
  );
}
