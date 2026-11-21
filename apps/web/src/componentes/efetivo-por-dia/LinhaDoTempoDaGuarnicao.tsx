import type { FuncaoNoEfetivo, GuarnicaoNoEfetivo, TrechoNoEfetivo } from 'contratos';
import { useState } from 'react';
import { EtiquetaDoServico } from '@/componentes/EtiquetaDoServico';
import { estiloDaCor } from '@/lib/cores';
import { posicao, type Janela } from '@/lib/efetivo';
import type { CSSProperties } from 'react';
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

function Trecho({ funcao, t, janela, acoes }: { funcao: FuncaoNoEfetivo; t: TrechoNoEfetivo; janela: Janela; acoes: AcoesDaLinha }) {
  const estilo = { left: posicao(janela, t.inicio), width: `calc(${posicao(janela, t.fim)} - ${posicao(janela, t.inicio)})` };
  // o trecho mede a própria largura (container query): o horário e a etiqueta só aparecem quando cabem ao lado do nome, que nunca cede lugar a eles
  const base = '@container absolute inset-y-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden rounded px-1.5 text-left focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta';
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
        <span className="hidden shrink-0 text-[11px] opacity-80 @min-[8rem]:inline">{faixa(t)}</span>
      </button>
    );
  }
  const o = t.ocupante;
  return <TrechoOcupado funcao={funcao} t={t} o={o} base={base} estilo={estilo} acoes={acoes} />;
}

/**
 * O trecho ocupado: o horário não fica no texto visível (informação mais leve). Está no `title` (mouse), aparece ao focar (teclado) e
 * ao tocar (celular, onde não há "passar o mouse"), e sempre no nome acessível.
 */
function TrechoOcupado({ funcao, t, o, base, estilo, acoes }: { funcao: FuncaoNoEfetivo; t: TrechoNoEfetivo; o: NonNullable<TrechoNoEfetivo['ocupante']>; base: string; estilo: CSSProperties; acoes: AcoesDaLinha }) {
  const [mostrarHorario, setMostrarHorario] = useState(false);
  return (
    <button
      type="button"
      aria-label={nomeDoTrecho(funcao.funcao, t)}
      title={faixa(t)}
      onClick={() => acoes.aoClicarOcupado?.(funcao, t)}
      onFocus={() => setMostrarHorario(true)}
      onBlur={() => setMostrarHorario(false)}
      onTouchStart={() => setMostrarHorario(true)}
      className={`${base} border border-white/40 hover:brightness-95`}
      style={{ ...estilo, ...estiloDaCor(o.servico.cor) }}
    >
      <span className="truncate font-cond text-sm font-semibold">
        <span className="text-[11px] font-normal opacity-80">{o.posto}</span> {o.nomeGuerra}
        {o.acumulo && <span className="ml-1 text-[11px] font-normal opacity-80">acumula</span>}
      </span>
      {mostrarHorario && <span data-horario className="shrink-0 text-[11px] opacity-90">{faixa(t)}</span>}
      <EtiquetaDoServico nome={o.servico.nome} cor={o.servico.cor} variante="contorno" className="hidden @min-[14rem]:inline-flex" />
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
