import type { CardDaGuarnicao as Card, FuncaoNoCard, OcupanteDaVaga } from 'contratos';
import { CartaoDaGuarnicao, FuncaoDoCartao } from '@/componentes/CartaoDaGuarnicao';
import { Encaixe } from '@/componentes/Encaixe';
import { Placa, type AcaoDaPlaca } from '@/componentes/Placa';
import { listaComE, nomeDaVaga } from '@/lib/escala';

/** A vaga que a tela oferece ao escalante (preenchida pelo diálogo "Escolher militar"). */
export type VagaDaTela = { data: string; inicio: string; fim: string; guarnicaoId: string; guarnicao: string; funcaoId: string; funcao: string; cnhExigida: FuncaoNoCard['cnhExigida'] };

/** Quem ocupa o lugar, como placa: o menu dela tem "Trocar militar" e "Remover da vaga" (em "Sem guarnição", "Remover do turno"). */
export function PlacaDoOcupante({ o, vaga, acoes }: { o: OcupanteDaVaga; vaga: string; acoes?: AcaoDaPlaca[] }) {
  return (
    <Placa
      patente={o.posto}
      nome={o.nomeGuerra}
      matricula={o.matricula}
      servico={{ nome: o.servico.nome, cor: o.servico.cor }}
      acumulaCom={o.acumulaCom.length > 0 ? listaComE(o.acumulaCom) : undefined}
      acoes={acoes}
      rotuloDasAcoes={`Ações de ${o.nomeGuerra} em ${vaga}`}
    />
  );
}

/** Um cartão por guarnição: nome, viatura, o estado ("Falta 1", "Faltam 2" ou o visto de completa) e, por função, as placas de quem ocupa e o encaixe do que falta. */
export function CardDaGuarnicao({
  card,
  aoEscolher,
  aoRemover,
  aoTrocar,
}: {
  card: Card;
  aoEscolher?: (vaga: Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>) => void;
  aoRemover?: (o: OcupanteDaVaga, guarnicao: string, vaga: string) => void;
  /** "Trocar militar": tira quem está na vaga e abre a escolha da mesma vaga em seguida. */
  aoTrocar?: (o: OcupanteDaVaga, guarnicao: string, vaga: string, daVaga: Omit<VagaDaTela, 'data' | 'inicio' | 'fim'>) => void;
}) {
  // as vagas obrigatórias que ainda estão vazias (o mesmo que o servidor diz em `faltam`, só que em número)
  const faltam = card.funcoes.reduce((n, f) => n + Math.max(0, f.minimo - f.ocupantes.length), 0);
  return (
    <CartaoDaGuarnicao nome={card.nome} viatura={card.viatura} faltam={card.completa ? 0 : faltam} frases={card.faltam.join('. ')}>
      <div data-funcoes className="grid gap-2">
        {card.funcoes.map((f) => {
          const daVaga = { guarnicaoId: card.guarnicaoId, guarnicao: card.nome, funcaoId: f.funcaoId, funcao: f.funcao, cnhExigida: f.cnhExigida };
          const vaga = nomeDaVaga(card.nome, f.funcao, card.funcoes.length);
          return (
            <FuncaoDoCartao key={f.funcaoId} nome={f.funcao} cnh={f.cnhExigida}>
              {f.ocupantes.map((o) => {
                const acoes: AcaoDaPlaca[] = [];
                if (aoTrocar) acoes.push({ rotulo: 'Trocar militar', aoEscolher: () => aoTrocar(o, card.nome, vaga, daVaga) });
                if (aoRemover) acoes.push({ rotulo: 'Remover da vaga', aoEscolher: () => aoRemover(o, card.nome, vaga) });
                return <PlacaDoOcupante key={`${o.alocacaoId}|${o.acumuloId ?? ''}`} o={o} vaga={vaga} acoes={acoes} />;
              })}
              {Array.from({ length: Math.max(0, f.maximo - f.ocupantes.length) }, (_, i) => (
                <Encaixe
                  key={`v${i}`}
                  obrigatorio={f.ocupantes.length + i < f.minimo}
                  rotuloAcessivel={`Escolher militar para ${f.funcao} de ${card.nome}`}
                  aoEscolher={aoEscolher && (() => aoEscolher(daVaga))}
                />
              ))}
            </FuncaoDoCartao>
          );
        })}
      </div>
    </CartaoDaGuarnicao>
  );
}
