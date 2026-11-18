import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, type FichaGuarnicao, type Funcao, type VersaoSalva } from 'contratos';
import { useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { atualizarGuarnicoes, consultaFuncoes, salvarVersao } from '@/api/guarnicoes';
import { AcoesDoBloco, podeDescartar, usePendencia } from '@/componentes/AlteracoesPendentes';
import { Composicao, type LinhaEdicao } from '@/componentes/guarnicoes/Composicao';
import { LinhaDoTempo } from '@/componentes/LinhaDoTempo';
import { Secao } from '@/componentes/militares/Secao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { versaoVigente } from '@/lib/guarnicoes';
import { mesAtual } from '@/lib/meses';

/** `escolhida` vem de cima: a ficha recomeça este bloco a cada gravação, e a versão escolhida não se perde. */
export function Versoes({ ficha, unidadeId, escolhida, aoEscolher }: { ficha: FichaGuarnicao; unidadeId: string; escolhida: string | undefined; aoEscolher: (v: string) => void }) {
  const mes = mesAtual();
  const vigente = versaoVigente(ficha.versoes, mes);
  const versao = ficha.versoes.find((v) => v.vigencia === escolhida) ?? vigente;

  return (
    <Secao titulo="Versões">
      {ficha.versoes.length > 1 && (
        <LinhaDoTempo vigencias={ficha.versoes.map((v) => v.vigencia)} escolhida={versao?.vigencia} aoEscolher={(v) => { if (podeDescartar('versao')) aoEscolher(v); }} />
      )}
      <Editor key={`${ficha.id}-${versao?.vigencia ?? 'nova'}`} ficha={ficha} unidadeId={unidadeId} versao={versao} aoSalvar={aoEscolher} />
    </Secao>
  );
}

function Editor({ ficha, unidadeId, versao, aoSalvar }: { ficha: FichaGuarnicao; unidadeId: string; versao: VersaoSalva | undefined; aoSalvar: (mes: string) => void }) {
  const queryClient = useQueryClient();
  const funcoes = useQuery(consultaFuncoes(unidadeId));
  // funções criadas ou renomeadas aqui, até a lista voltar do servidor
  const [locais, setLocais] = useState<Funcao[]>([]);
  const [viatura, setViatura] = useState(versao?.viatura ?? '');
  const [tipoViatura, setTipoViatura] = useState(versao?.tipoViatura ?? '');
  const [prioridade, setPrioridade] = useState(versao?.prioridade == null ? '' : String(versao.prioridade));
  // a versão grava com o `ativa` com que abriu (desativar e reativar são no cabeçalho da ficha)
  const ativa = versao?.ativa ?? true;
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(
    (versao?.composicao ?? []).map((c, i) => ({ chave: i + 1, funcaoId: c.funcaoId, minimo: c.minimo, maximo: c.maximo, cnh: c.cnhExigida ?? '' })),
  );
  // sugere o mês corrente, ou o começo da versão quando ela só vale no futuro
  const [desde, setDesde] = useState(versao && versao.vigencia > mesAtual() ? versao.vigencia : mesAtual());
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  // o conteúdo da versão em texto: o que difere do último gravado é alteração pendente (o mês "a partir de" não conta)
  const assinatura = () =>
    JSON.stringify([viatura.trim(), tipoViatura.trim(), prioridade.trim(), linhas.map((l) => [l.funcaoId, l.minimo, l.maximo, l.cnh])]);
  const [salvo, setSalvo] = useState(assinatura);
  const sujo = assinatura() !== salvo;
  usePendencia('versao', sujo);

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
      setSalvo(assinatura());
      atualizarGuarnicoes(queryClient, ficha.id);
      setAviso({ erro: false, texto: `Salvo a partir de ${mesPorExtenso(desde)}.` });
      aoSalvar(desde);
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

      <div className="grid gap-2">
        <h4 className="font-cond text-base font-semibold">Composição</h4>
        <Composicao linhas={linhas} aoMudar={setLinhas} funcoes={opcoes} unidadeId={unidadeId} aoMudarFuncao={(f) => setLocais((x) => [...x.filter((y) => y.id !== f.id), f])} />
      </div>

      <div className="grid gap-3 border-t border-linha pt-3 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="gv-desde">A partir de</Label>
          <Input id="gv-desde" type="month" value={desde} min={mesAtual()} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <AcoesDoBloco sujo={sujo} aviso={aviso} tipo="button" desabilitado={!desde} rotulo={`Salvar a partir de ${desde ? mesPorExtenso(desde) : '…'}`} aoSalvar={() => void salvar()} />
      </div>
    </div>
  );
}
