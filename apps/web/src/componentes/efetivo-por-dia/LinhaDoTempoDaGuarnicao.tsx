import type { FuncaoNoEfetivo, GuarnicaoNoEfetivo, TrechoNoEfetivo } from 'contratos';
import { corDoTexto } from '@/lib/cores';
import { textoMinutos } from '@/lib/turnos';
import { LimitesDoDia, posicao, type Janela } from './ReguaDoEfetivo';

export type AcoesDaLinha = {
  aoClicarVaga?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
  aoClicarOcupado?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
};

const faixa = (t: TrechoNoEfetivo) => `${textoMinutos(t.inicio)}–${textoMinutos(t.fim)}`;

/** O nome acessível do trecho: "Motorista: SD BM ALFA, 08h–08h, Pronto" ou "Motorista: vaga 20h–08h". */
export function nomeDoTrecho(funcao: string, t: TrechoNoEfetivo): string {
  return t.ocupante ? `${funcao}: ${t.ocupante.posto} ${t.ocupante.nomeGuerra}, ${faixa(t)}, ${t.ocupante.servico.nome}` : `${funcao}: vaga ${faixa(t)}`;
}

function Trecho({ funcao, t, janela, acoes }: { funcao: FuncaoNoEfetivo; t: TrechoNoEfetivo; janela: Janela; acoes: AcoesDaLinha }) {
  const estilo = { left: posicao(janela, t.inicio), width: `calc(${posicao(janela, t.fim)} - ${posicao(janela, t.inicio)})` };
  const base = 'absolute inset-y-0.5 flex min-w-0 items-center overflow-hidden rounded px-1.5 text-left focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tinta';
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
          <div key={`${f.funcaoId}|${i}`} className="grid gap-x-3 sm:grid-cols-[8rem_1fr] sm:items-center">
            {i === 0 ? (
              <span data-funcao className="truncate text-sm text-apagado">{f.funcao}</span>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
            <div className="relative h-8 rounded bg-black/[0.03]">
              <LimitesDoDia janela={janela} className="-inset-y-0.5" />
              {linha.map((t) => <Trecho key={`${t.inicio}|${t.fim}|${t.ocupante?.militarId ?? 'vaga'}`} funcao={f} t={t} janela={janela} acoes={acoes} />)}
            </div>
          </div>
        )),
      )}
    </div>
  );
}
