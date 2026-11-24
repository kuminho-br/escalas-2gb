import type { FuncaoNoEfetivo, GuarnicaoNoEfetivo, TrechoNoEfetivo } from 'contratos';
import { useState } from 'react';
import { classeDoEncaixe } from '@/componentes/Encaixe';
import { Placa } from '@/componentes/Placa';
import { posicao, type Janela } from '@/lib/efetivo';
import type { CSSProperties } from 'react';
import { textoMinutos } from '@/lib/turnos';
import { cn } from '@/lib/utils';

export type AcoesDaLinha = {
  /** Numa unidade só de consulta: a vaga e o trecho ocupado são só para ver (nada para clicar). */
  soLeitura?: boolean;
  aoClicarVaga?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
  aoClicarOcupado?: (funcao: FuncaoNoEfetivo, trecho: TrechoNoEfetivo) => void;
};

/** "08h", e "24h" para o fim do dia (1440), que o relógio escreveria "00h". */
const hora = (m: number) => (m === 1440 ? '24h' : textoMinutos(m));
const faixa = (t: TrechoNoEfetivo) => `${hora(t.inicio)}–${hora(t.fim)}`;

/** O nome acessível do trecho: "Motorista: SD ALFA, 08h–08h, Pronto" ou "Motorista: vaga 00h–24h". */
export function nomeDoTrecho(funcao: string, t: TrechoNoEfetivo): string {
  return t.ocupante ? `${funcao}: ${t.ocupante.posto} ${t.ocupante.nomeGuerra}, ${faixa(t)}, ${t.ocupante.servico.nome}` : `${funcao}: vaga ${faixa(t)}`;
}

function Trecho({ funcao, t, janela, acoes }: { funcao: FuncaoNoEfetivo; t: TrechoNoEfetivo; janela: Janela; acoes: AcoesDaLinha }) {
  const estilo = { left: posicao(janela, t.inicio), width: `calc(${posicao(janela, t.fim)} - ${posicao(janela, t.inicio)})` };
  // o trecho mede a própria largura (container query): o horário e a etiqueta só aparecem quando cabem ao lado do nome, que nunca cede lugar a eles
  const base = '@container absolute inset-y-0 flex min-w-0 items-center gap-1.5 overflow-hidden rounded-controle px-1.5 text-left focus-visible:z-20';
  if (!t.ocupante && acoes.soLeitura) {
    return (
      <div
        role="group"
        aria-label={nomeDoTrecho(funcao.funcao, t)}
        data-vaga
        data-obrigatoria
        className={cn(base, classeDoEncaixe(true), 'pl-2 text-apoio hover:border-dashed')}
        style={estilo}
      >
        <span className="truncate">vaga</span>
        <span className="hidden shrink-0 text-apoio opacity-80 @min-[8rem]:inline">{faixa(t)}</span>
      </div>
    );
  }
  if (!t.ocupante) {
    return (
      <button
        type="button"
        aria-label={nomeDoTrecho(funcao.funcao, t)}
        onClick={() => acoes.aoClicarVaga?.(funcao, t)}
        data-vaga
        // a faixa só traz vagas até o mínimo da função: toda vaga aqui é obrigatória (a extra só existe na Escala do mês)
        data-obrigatoria
        // o mesmo desenho das vagas vazias da Escala do mês; sem estilo de cor: a cor de serviço é de quem já está escalado
        className={cn(base, classeDoEncaixe(true), 'pl-2 text-apoio')}
        style={estilo}
      >
        <span className="truncate">vaga</span>
        <span className="hidden shrink-0 text-apoio opacity-80 @min-[8rem]:inline">{faixa(t)}</span>
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
    // o trecho é a placa do militar, no lugar e na largura do horário dele; sem o menu das ações: clicar abre as alocações do trecho
    <div
      onFocus={() => setMostrarHorario(true)}
      onBlur={() => setMostrarHorario(false)}
      onTouchStart={() => setMostrarHorario(true)}
      className={cn(base, 'overflow-visible p-0')}
      style={estilo}
    >
      <Placa
        patente={o.posto}
        nome={o.nomeGuerra}
        servico={{ nome: o.servico.nome, cor: o.servico.cor }}
        servicoSoSeAmplo
        aoClicar={acoes.soLeitura ? undefined : () => acoes.aoClicarOcupado?.(funcao, t)}
        role={acoes.soLeitura ? 'group' : undefined}
        rotuloAcessivel={nomeDoTrecho(funcao.funcao, t)}
        dica={faixa(t)}
        extra={
          <>
            {o.acumulo && <span className="shrink-0 text-apoio text-apagado">acumula</span>}
            {mostrarHorario && <span data-horario className="shrink-0 text-apoio text-apagado">{faixa(t)}</span>}
          </>
        }
        className="h-full w-full"
      />
    </div>
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
            <div className="relative h-(--altura-controle) rounded-controle bg-tinta/5">
              {linha.map((t) => <Trecho key={`${t.inicio}|${t.fim}|${t.ocupante?.militarId ?? 'vaga'}`} funcao={f} t={t} janela={janela} acoes={acoes} />)}
            </div>
          </div>
        )),
      )}
    </div>
  );
}
