import { useQueryClient } from '@tanstack/react-query';
import { LetraTurno, type Servico, type TurnoSalvo } from 'contratos';
import { duracaoMinutos } from 'dominio';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarServicos, editarTurno, incluirTurno, removerTurno } from '@/api/servicos';
import { Secao } from '@/componentes/militares/Secao';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { ReguaDoDia } from '@/componentes/servicos/ReguaDoDia';
import { corDoTexto } from '@/lib/cores';
import { textoDuracao } from '@/lib/turnos';

/** Turnos dentro do serviço: cada linha grava sozinha. */
export function Turnos({ servico }: { servico: Servico }) {
  const [novo, setNovo] = useState(false);
  const livre = LetraTurno.options.find((l) => !servico.turnos.some((t) => t.letra === l)) ?? 'A';
  return (
    <Secao titulo="Turnos">
      <ReguaDoDia servico={servico} />
      <ul className="grid gap-2">
        {servico.turnos.map((t) => <LinhaTurno key={t.id} servico={servico} turno={t} />)}
        {novo && <LinhaTurno servico={servico} padrao={{ letra: livre, inicio: '08:00', fim: '20:00' }} aoCancelar={() => setNovo(false)} />}
      </ul>
      {servico.turnos.length === 0 && !novo && <p className="text-sm text-apagado">Nenhum turno ainda.</p>}
      {!novo && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setNovo(true)}>
          Incluir turno
        </Button>
      )}
    </Secao>
  );
}

/** Duração calculada pelo horário digitado; null enquanto o horário não vale. */
function duracaoDe(inicio: string, fim: string): string | null {
  try {
    return textoDuracao(duracaoMinutos(inicio, fim));
  } catch {
    return null;
  }
}

/** A duração em destaque, no bloco com a cor do serviço. */
function BlocoDeDuracao({ cor, duracao }: { cor: string; duracao: string | null }) {
  return duracao ? (
    <span className="rounded px-2.5 py-0.5 font-cond text-base font-semibold" style={{ backgroundColor: cor, color: corDoTexto(cor) }}>
      {duracao}
    </span>
  ) : (
    <span className="rounded bg-fundo px-2.5 py-0.5 font-cond text-base font-semibold text-apagado">—</span>
  );
}

function LinhaTurno({
  servico,
  turno,
  padrao,
  aoCancelar,
}: {
  servico: Servico;
  turno?: TurnoSalvo;
  padrao?: { letra: LetraTurno; inicio: string; fim: string };
  aoCancelar?: () => void;
}) {
  const queryClient = useQueryClient();
  const base = turno ?? padrao!;
  const [letra, setLetra] = useState<LetraTurno>(base.letra);
  const [inicio, setInicio] = useState(base.inicio);
  const [fim, setFim] = useState(base.fim);
  const [erro, setErro] = useState<string | null>(null);
  const nome = turno ? `turno ${turno.letra}` : 'turno novo';
  const duracao = duracaoDe(inicio, fim);

  async function salvar() {
    setErro(null);
    try {
      if (turno) await editarTurno(turno.id, { letra, inicio, fim });
      else await incluirTurno(servico.id, { letra, inicio, fim });
      atualizarServicos(queryClient);
      aoCancelar?.();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }
  async function remover() {
    setErro(null);
    try {
      await removerTurno(turno!.id);
      atualizarServicos(queryClient);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  return (
    <li className="grid gap-1 rounded-lg border border-linha px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <Selecao aria-label={`Letra do ${nome}`} value={letra} onChange={(e) => setLetra(LetraTurno.parse(e.target.value))} className="w-16">
          {LetraTurno.options.map((l) => <option key={l} value={l}>{l}</option>)}
        </Selecao>
        <Input aria-label={`Início do ${nome}`} type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-28" />
        <span className="text-apagado">às</span>
        <Input aria-label={`Fim do ${nome}`} type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="w-28" />
        <BlocoDeDuracao cor={servico.cor} duracao={duracao} />
        <span className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void salvar()} aria-label={`Salvar ${nome}`}>
            Salvar
          </Button>
          {turno ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => void remover()} aria-label={`Remover ${nome}`}>
              Remover
            </Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={aoCancelar}>
              Cancelar
            </Button>
          )}
        </span>
      </div>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
    </li>
  );
}
