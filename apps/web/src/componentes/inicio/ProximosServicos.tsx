import { LIMITE_DE_PROXIMOS, type MeuServico } from 'contratos';
import { useId } from 'react';
import { diaDaSemanaCurto, diaDoMes, fundoDoCartao, horarioCurto, rotuloDoCartao } from '@/lib/proximos-servicos';
import { cn } from '@/lib/utils';

/**
 * Os próximos serviços do militar, dentro da cena da tela inicial (6.55): um cartão por serviço, com o dia da semana, o dia do mês, o nome do serviço e o horário, no fundo da cor do
 * serviço. O mais próximo ganha o contorno branco. Até seis; no celular a fila rola de lado, sem barra. Sem serviço, a frase que diz isso (docs/telas/refatoracao/tela-inicial).
 */
export function ProximosServicos({ servicos }: { servicos: MeuServico[] }) {
  const titulo = useId();
  return (
    <section aria-labelledby={titulo} className="grid min-w-0 gap-2">
      <small id={titulo} className="text-apoio leading-none font-medium text-white/80">Seus próximos serviços</small>
      {servicos.length === 0 ? (
        <p className="text-corpo text-white/90">Nenhum serviço marcado para você.</p>
      ) : (
        <ol aria-labelledby={titulo} className="-mx-0.5 -mt-0.5 -mb-[3px] flex gap-2 overflow-x-auto px-0.5 pt-0.5 pb-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {servicos.slice(0, LIMITE_DE_PROXIMOS).map((s, i) => (
            <li
              key={s.alocacaoId}
              style={{ background: fundoDoCartao(s.cor) }}
              className={cn('grid w-[104px] flex-none gap-0.5 rounded-controle px-2.5 pt-2 pb-[9px] text-white shadow-apoiada md:w-[112px]', i === 0 && 'ring-2 ring-white')}
            >
              {/* o rótulo é um texto só para a leitura de tela (o aria-label de um <li> nem todo leitor lê); o desenho do cartão fica escondido dela */}
              <span className="sr-only">{rotuloDoCartao(s)}</span>
              <div aria-hidden className="grid gap-0.5">
                <div className="flex items-baseline justify-between gap-1.5">
                  <small className="text-apoio leading-none font-medium text-white/90">{diaDaSemanaCurto(s.data)}</small>
                  <b className="font-cond text-titulo leading-7 font-semibold">{diaDoMes(s.data)}</b>
                </div>
                <span className="truncate font-cond text-corpo leading-[18px] font-semibold">{s.servico}</span>
                <span className="text-apoio leading-4 font-medium whitespace-nowrap text-white/90">{horarioCurto(s.inicio, s.fim)}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
