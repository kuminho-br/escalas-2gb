import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, type FichaGuarnicao, type Funcao, type VersaoSalva } from 'contratos';
import { useState } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { atualizarGuarnicoes, consultaFuncoes, salvarVersao } from '@/api/guarnicoes';
import { AcoesDoBloco, podeDescartar, usePendencia, useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
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
  // os campos da versão, como o formulário os guarda (texto), a partir do que o servidor trouxe
  const daVersao = (v: VersaoSalva | undefined) => ({
    viatura: v?.viatura ?? '',
    tipo: v?.tipoViatura ?? '',
    linhas: (v?.composicao ?? []).map((c, i): LinhaEdicao => ({ chave: i + 1, funcaoId: c.funcaoId, minimo: c.minimo, maximo: c.maximo, cnh: c.cnhExigida ?? '' })),
  });
  // o conteúdo da versão em texto: o que difere do último gravado é alteração pendente (o mês "a partir de" não conta)
  const montar = (viatura: string, tipo: string, linhas: LinhaEdicao[]) =>
    JSON.stringify([viatura.trim(), tipo.trim(), linhas.map((l) => [l.funcaoId, l.minimo, l.maximo, l.cnh])]);
  const assinaturaDa = (v: VersaoSalva | undefined) => {
    const d = daVersao(v);
    return montar(d.viatura, d.tipo, d.linhas);
  };
  const inicial = daVersao(versao);
  const [viatura, setViatura] = useState(inicial.viatura);
  const [tipoViatura, setTipoViatura] = useState(inicial.tipo);
  // a prioridade não se edita mais aqui (a ordem agora é da escala), mas o valor que já existe segue com a versão: é a ordem padrão das escalas sem ordem cadastrada
  const prioridade = versao?.prioridade ?? null;
  // a versão grava com o `ativa` com que abriu (desativar e reativar são no cabeçalho da ficha)
  const ativa = versao?.ativa ?? true;
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(inicial.linhas);
  // sugere o mês corrente, ou o começo da versão quando ela só vale no futuro
  const [desde, setDesde] = useState(versao && versao.vigencia > mesAtual() ? versao.vigencia : mesAtual());
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const assinatura = () => montar(viatura, tipoViatura, linhas);
  const [salvo, setSalvo] = useState(assinatura);
  const sujo = assinatura() !== salvo;
  usePendencia('versao', sujo);

  // o servidor trouxe outro conteúdo para esta versão (ex.: uma importação com a ficha aberta): sem alteração pendente, os campos recarregam; com alteração, a edição da pessoa fica
  const doServidor = assinaturaDa(versao);
  const [visto, setVisto] = useState(doServidor);
  if (doServidor !== visto) {
    setVisto(doServidor);
    if (!sujo) {
      setViatura(inicial.viatura);
      setTipoViatura(inicial.tipo);
      setLinhas(inicial.linhas);
      setSalvo(doServidor);
    }
  }
  // gravar a partir de "desde" muda o que vale se o formulário difere da versão em vigor nesse mês (ex.: uma versão antiga trazida de volta)
  const mesDeVigor = /^\d{4}-\d{2}$/.test(desde) ? desde : mesAtual();
  const emVigor = versaoVigente(ficha.versoes, mesDeVigor);
  const mudaOQueVale = Boolean(emVigor) && assinaturaDa(emVigor) !== assinatura();


  const servidor = funcoes.data ?? [];
  const opcoes = [...servidor.map((f) => locais.find((l) => l.id === f.id) ?? f), ...locais.filter((l) => !servidor.some((f) => f.id === l.id))];

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    if (linhas.some((l) => !l.funcaoId)) {
      setAviso({ erro: true, texto: 'Escolha a função de cada linha.' });
      return;
    }
    try {
      await salvarVersao(ficha.id, desde, {
        viatura: viatura.trim() || null,
        tipoViatura: tipoViatura.trim() || null,
        prioridade,
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
      </div>
      <p className="-mt-2 text-xs text-apagado">A viatura é só informativa: não muda as vagas. A ordem em que as vagas são preenchidas é definida na escala, em "Ordem de escalação".</p>

      <div className="grid gap-2">
        <h4 className="font-cond text-base font-semibold">Composição</h4>
        <Composicao linhas={linhas} aoMudar={setLinhas} funcoes={opcoes} unidadeId={unidadeId} aoMudarFuncao={(f) => setLocais((x) => [...x.filter((y) => y.id !== f.id), f])} />
      </div>

      <div className="grid gap-3 border-t border-linha pt-3 sm:max-w-md">
        <div className="grid gap-1.5">
          <Label htmlFor="gv-desde">A partir de</Label>
          <Input id="gv-desde" type="month" value={desde} min={mesAtual()} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} forcar={mudaOQueVale} aviso={aviso} tipo="button" desabilitado={!desde} rotulo={`Salvar a partir de ${desde ? mesPorExtenso(desde) : '…'}`} aoSalvar={() => void salvar()} />
      </div>
    </div>
  );
}
