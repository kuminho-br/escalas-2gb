import type { FuncaoNoEfetivo, GuarnicaoNoEfetivo, TrechoNoEfetivo } from 'contratos';
import { EtiquetaDoServico } from '@/componentes/EtiquetaDoServico';
import { corDoTexto } from '@/lib/cores';
import { fracaoDaJanela, posicao, type Janela } from '@/lib/efetivo';
import { textoMinutos } from '@/lib/turnos';

export type AcoesDaLinha = {
  aoClicarVaga?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
  aoClicarOcupado?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
};

/** "08h", e "24h" para o fim do dia (1440), que o relógio escreveria "00h". */
const hora = (m: number) => (m === 1440 ? '24h' : textoMinutos(m));
const faixa = (t: TrechoNoEfetivo) => `${hora(t.inicio)}–${hora(t.fim)}`;

/** O nome acessível do trecho: "Motorista: SD BM ALFA, 08h–08h, Pronto" ou "Motorista: vaga 00h–24h". */
export function nomeDoTrecho(funcao: string, t: TrechoNoEfetivo): string {
  return t.ocupante ? `${funcao}: ${t.ocupante.posto} ${t.ocupante.nomeGuerra}, ${faixa(t)}, ${t.ocupante.servico.nome}` : `${funcao}: vaga ${faixa(t)}`;
}

// quanto do dia o trecho precisa ocupar para caber o horário e, mais, a etiqueta do serviço (o nome acessível sempre tem tudo)
const CABE_HORARIO = 0.15;
const CABE_ETIQUETA = 0.28;

function Trecho({ funcao, t, janela, acoes }: { funcao: FuncaoNoEfetivo; t: TrechoNoEfetivo; janela: Janela; acoes: AcoesDaLinha }) {
  const estilo = { left: posicao(janela, t.inicio), width: `calc(${posicao(janela, t.fim)} - ${posicao(janela, t.inicio)})` };
  const base = 'absolute inset-y-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden rounded px-1.5 text-left focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta';
  const fracao = fracaoDaJanela(janela, t);
  if (!t.ocupante) {
    return (
      <button
        type="button"
        aria-label={nomeDoTrecho(funcao.funcao, t)}
        onClick={() => acoes.aoClicarVaga?.(funcao, t)}
        data-vaga
        // as mesmas listras das vagas vazias da Escala do mês
        className={`${base} border border-[#F2C200] bg-[repeating-linear-gradient(135deg,#FFF3B8_0_8px,#FFFFFF_8px_16px)] text-xs font-medium text-pendencia hover:brightness-95`}
        style={estilo}
      >
        <span className="truncate">vaga</span>
        {fracao >= CABE_HORARIO && <span className="shrink-0 text-[11px] opacity-80">{faixa(t)}</span>}
      </button>
    );
  }
  const o = t.ocupante;
  return (
    <button
      type="button"
      aria-label={nomeDoTrecho(funcao.funcao, t)}
      onClick={() => acoes.aoClicarOcupado?.(funcao, t)}
      className={`${base} border border-white/40 hover:brightness-95`}
      style={{ ...estilo, backgroundColor: o.servico.cor, color: corDoTexto(o.servico.cor) }}
    >
      <span className="truncate font-cond text-sm font-semibold">
        <span className="text-[11px] font-normal opacity-80">{o.posto}</span> {o.nomeGuerra}
        {o.acumulo && <span className="ml-1 text-[11px] font-normal opacity-80">acumula</span>}
      </span>
      {fracao >= CABE_HORARIO && <span className="shrink-0 text-[11px] opacity-90">{faixa(t)}</span>}
      {fracao >= CABE_ETIQUETA && <EtiquetaDoServico nome={o.servico.nome} cor={o.servico.cor} variante="contorno" />}
    </button>
  );
}

/**
 * As funções da guarnição ao longo do dia: uma linha por vaga ocupada ou aberta, na régua comum da página. O nome da função fica só na
 * primeira linha dela; no celular, acima da barra.
 */
export function LinhaDoTempoDaGuarnicao({ g, janela, acoes = {} }: { g: GuarnicaoNoEfetivo; janela: Janela; acoes?: AcoesDaLinha }) {
  if (!g.funcoes.length) return null;
  return (
    <div className="grid gap-1">
      {g.funcoes.map((f) =>
        f.linhas.map((linha, i) => (
          <div key={`${f.funcaoId}|${i}`} className="grid gap-x-3 sm:grid-cols-[6rem_1fr] sm:items-center">
            {i === 0 ? (
              <span data-funcao className="truncate text-sm text-apagado">{f.funcao}</span>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
            <div className="relative h-8 rounded bg-black/[0.03]">
              {linha.map((t) => <Trecho key={`${t.inicio}|${t.fim}|${t.ocupante?.militarId ?? 'vaga'}`} funcao={f} t={t} janela={janela} acoes={acoes} />)}
            </div>
          </div>
        )),
      )}
    </div>
  );
}
