import { useQueryClient } from '@tanstack/react-query';
import { Nascimento, type FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { DonoDoBloco, Secao } from './Secao';

/** Dados pessoais: por ora o nascimento, só com dia e mês (a ficha não guarda o ano). Do Pecúlio: sem papel acima da lotação, só leitura. */
export function DadosPessoais({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const peculio = ficha.podeEditar.peculio;
  const doServidor = { dia: ficha.nascimento ? String(ficha.nascimento.dia) : '', mes: ficha.nascimento ? String(ficha.nascimento.mes) : '' };
  const [dia, setDia] = useState(doServidor.dia);
  const [mes, setMes] = useState(doServidor.mes);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(doServidor);
  const sujo = dia.trim() !== salvo.dia || mes.trim() !== salvo.mes;
  usePendencia('dados-pessoais', sujo);
  useSincronizar(JSON.stringify(doServidor), sujo, () => {
    setDia(doServidor.dia);
    setMes(doServidor.mes);
    setSalvo(doServidor);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    setCampos({});
    if (!sujo) return;
    // dia e mês andam juntos: os dois vazios limpam, um só ou um dia que não existe no mês é recusado aqui, com a mensagem do contrato
    let nascimento: Nascimento | null = null;
    if (dia.trim() || mes.trim()) {
      const lido = Nascimento.safeParse({ dia: Number(dia), mes: Number(mes) });
      if (!lido.success) {
        setCampos({ nascimento: lido.error.issues[0]!.message });
        return;
      }
      nascimento = lido.data;
    }
    try {
      await editarMilitar(ficha.id, { nascimento });
      setSalvo({ dia: dia.trim(), mes: mes.trim() });
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setCampos(camposDe(err));
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }
  const erro = campos.nascimento ?? campos['nascimento.dia'] ?? campos['nascimento.mes'];

  return (
    <Secao titulo="Dados pessoais">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Nascimento (dia e mês)</legend>
          <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
            <div className="grid gap-1.5">
              <Label htmlFor="dp-dia">Dia</Label>
              <Input id="dp-dia" type="number" min={1} max={31} value={dia} disabled={!peculio} aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'dp-erro' : undefined} onChange={(e) => setDia(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="dp-mes">Mês</Label>
              <Input id="dp-mes" type="number" min={1} max={12} value={mes} disabled={!peculio} aria-invalid={erro ? true : undefined} aria-describedby={erro ? 'dp-erro' : undefined} onChange={(e) => setMes(e.target.value)} />
            </div>
          </div>
          {erro && <p id="dp-erro" className="text-xs text-alerta">{erro}</p>}
        </fieldset>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={!peculio} aviso={aviso} rotulo="Salvar dados pessoais" />
      </form>
    </Secao>
  );
}
