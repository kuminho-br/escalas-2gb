import { useQueryClient } from '@tanstack/react-query';
import { BoletimDoComportamento, COMPORTAMENTOS, Comportamento as ComportamentoDoMilitar, type EdicaoMilitar, type FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { DonoDoBloco, Secao } from './Secao';

/** Comportamento (Excepcional, Ótimo, Bom, Insuficiente, Mau) e o boletim que o publicou. Do Pecúlio: sem papel acima da lotação, só leitura. */
export function Comportamento({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const peculio = ficha.podeEditar.peculio;
  const doServidor = { comportamento: ficha.comportamento ?? '', boletim: ficha.comportamentoBoletim ?? '' };
  const [comportamento, setComportamento] = useState(doServidor.comportamento);
  const [boletim, setBoletim] = useState(doServidor.boletim);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(doServidor);
  const sujo = comportamento !== salvo.comportamento || boletim.trim() !== salvo.boletim;
  usePendencia('comportamento', sujo);
  useSincronizar(JSON.stringify(doServidor), sujo, () => {
    setComportamento(doServidor.comportamento);
    setBoletim(doServidor.boletim);
    setSalvo(doServidor);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    setCampos({});
    if (!sujo) return;
    const alteracoes: EdicaoMilitar = {};
    if (comportamento !== salvo.comportamento) alteracoes.comportamento = comportamento ? ComportamentoDoMilitar.parse(comportamento) : null;
    if (boletim.trim() !== salvo.boletim) {
      const lido = boletim.trim() ? BoletimDoComportamento.safeParse(boletim) : null;
      if (lido && !lido.success) {
        setCampos({ comportamentoBoletim: lido.error.issues[0]!.message });
        return;
      }
      alteracoes.comportamentoBoletim = lido?.success ? lido.data : null;
    }
    try {
      await editarMilitar(ficha.id, alteracoes);
      setSalvo({ comportamento, boletim: boletim.trim() });
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setCampos(camposDe(err));
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Comportamento">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Campo id="cp-comportamento" rotulo="Comportamento" erro={campos.comportamento}>
            <Selecao id="cp-comportamento" value={comportamento} disabled={!peculio} onChange={(e) => setComportamento(e.target.value)}>
              <option value="">Sem informação</option>
              {COMPORTAMENTOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Selecao>
          </Campo>
          <Campo id="cp-boletim" rotulo="Boletim" erro={campos.comportamentoBoletim}>
            <Input id="cp-boletim" placeholder="Boletim em que foi publicado" value={boletim} disabled={!peculio} onChange={(e) => setBoletim(e.target.value)} />
          </Campo>
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={!peculio} aviso={aviso} rotulo="Salvar comportamento" />
      </form>
    </Secao>
  );
}
