import { useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';

/** A aba Regras: o texto do mockup (docs/telas/escala-dos-oficiais/mockup.html, seção "Regras"), palavra por palavra. */
export function RegrasDosOficiais() {
  return (
    <div className="grid max-w-3xl gap-5 [&_h2]:font-cond [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-1.5 [&_ul]:list-disc">
      <section>
        <h2>Como a escala é montada</h2>
        <ul>
          <li>Cada dia tem dois turnos de 12 horas: o do dia e o da noite.</li>
          <li>Os oficiais escolhem os turnos pela antiguidade: o mais antigo escolhe primeiro.</li>
          <li>A antiguidade decide a ordem, não a quantidade. Todos tiram a cota calculada para o mês.</li>
          <li>Quem está afastado não tira serviço nos dias do afastamento.</li>
        </ul>
      </section>
      <section>
        <h2>Como a cota é calculada</h2>
        <ol>
          <li><b>Presença.</b> Conta os dias do mês em que você participa da escala e não está afastado. Qualquer afastamento conta, sem distinção: férias, dispensa, curso.</li>
          <li><b>O que cada um deve.</b> Os turnos do mês são divididos na proporção da presença de cada um. O resultado tem casas decimais, como 8,25.</li>
          <li><b>A cota.</b> É esse número sem a parte quebrada: 8,25 vira 8.</li>
          <li><b>A sobra.</b> Os turnos que sobram depois disso vão um para cada, começando pelo mais moderno. Os mais antigos ficam com um a menos.</li>
        </ol>
        <p><b>Exemplo:</b> um mês de 31 dias tem 62 turnos. São 8 oficiais, e um deles está de férias em 15 dias, então fica presente em 16.</p>
        <div className="overflow-x-auto">
          <table aria-label="Exemplo de 62 turnos" className="my-2 w-full max-w-xl text-sm">
            <thead>
              <tr className="text-left text-xs text-apagado">
                <th scope="col" className="px-2 py-1 font-medium">Quem</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">Devia</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">Cota</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">Saldo do mês</th>
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-linha [&_td]:px-2 [&_td]:py-1 [&_td.n]:text-right [&_td.n]:tabular-nums">
              <tr><td>Os 5 mais antigos</td><td className="n">8,25</td><td className="n">8</td><td className="n">−0,25</td></tr>
              <tr><td>Os 2 mais modernos</td><td className="n">8,25</td><td className="n">9</td><td className="n">+0,75</td></tr>
              <tr><td>O que estava de férias (16 dias)</td><td className="n">4,26</td><td className="n">4</td><td className="n">−0,26</td></tr>
            </tbody>
          </table>
        </div>
        <p>As cotas somam 5 × 8 + 2 × 9 + 4 = 62 turnos. A parte quebrada (os −0,25, +0,75 e −0,26) não se perde: vai para o saldo de cada um.</p>
      </section>
      <section>
        <h2>Os dias vermelhos</h2>
        <ul>
          <li>Dia vermelho é um dia ruim, que ninguém quer tirar. O escalante marca no calendário do mês, até o mês ser encerrado.</li>
          <li>Todos os dias vermelhos pesam igual. O sistema só conta quantos cada oficial tirou, no mês e no acumulado do painel de saldo.</li>
          <li>Os dias vermelhos não mudam a cota de ninguém.</li>
        </ul>
      </section>
      <section>
        <h2>O saldo</h2>
        <p>O saldo é o que você tirou menos o que devia tirar, somado mês a mês. Ele tem casas decimais e não é zerado de um mês para o outro.</p>
        <ul>
          <li><b>Positivo:</b> você trabalhou mais do que devia.</li>
          <li><b>Negativo:</b> você trabalhou menos do que devia.</li>
        </ul>
        <p>Nesta primeira versão o saldo só aparece no painel. Ele ainda não muda a cota.</p>
      </section>
      <section>
        <h2>O que muda o saldo</h2>
        <ul>
          <li><b>Afastamento.</b> Se o afastamento deixa o que você devia com parte quebrada, a parte que não foi tirada entra como negativo.</li>
          <li><b>Sobra da divisão.</b> Quem ficou com o turno a mais fica positivo; quem ficou com um a menos, negativo.</li>
          <li><b>Imprevisto depois da escala fechada.</b> Quem cobre ganha o turno; quem saiu não fica devendo. Vale para qualquer imprevisto.</li>
          <li><b>Oficial que chega.</b> Começa com a média dos saldos de quem já está na escala. No mês em que chega, deve só a parte dos dias em que esteve.</li>
          <li><b>Oficial que sai.</b> Por transferência ou mudança de quadro, o saldo dele fica guardado e parado. Se voltar, continua de onde parou. O saldo dos outros não muda.</li>
          <li><b>Turno que ficou sem ninguém.</b> Ninguém ganha esse turno. O que cada um devia é refeito só com os turnos que foram tirados.</li>
          <li><b>Correção depois do mês encerrado.</b> O mês não é refeito. O gestor lança um ajuste no saldo, com o motivo, e ele fica no registro.</li>
          <li><b>Permuta.</b> Trocar um turno por outro no mesmo mês não muda o saldo. As demais regras de permuta virão depois.</li>
        </ul>
      </section>
      <section>
        <h2>Os dois momentos do mês</h2>
        <ul>
          <li><b>Fechar a escala:</b> quando todas as escolhas estão feitas. Antes disso, um afastamento diminui a cota. Depois disso, trocar o nome num turno é uma cobertura, e o registro guarda quem saiu e quem cobriu.</li>
          <li><b>Encerrar o mês:</b> o saldo do mês é calculado com a escala como ficou e somado ao acumulado. Depois disso, só um ajuste do gestor muda o saldo.</li>
        </ul>
      </section>
      <section>
        <h2>O que fica registrado</h2>
        <p>Cada serviço tirado: quem, o dia, o turno (dia ou noite) e, quando for cobertura, no lugar de quem. Os ajustes do gestor ficam no mesmo histórico, com o motivo.</p>
      </section>
    </div>
  );
}

/** O botão "Regras" com a janela das regras: aparece em qualquer tela de oficiais, mesmo sem escala de rodada (6.30). */
export function BotaoDasRegras() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant="secundario" onClick={() => setAberto(true)}>Regras</Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Regras da escala dos oficiais</DialogTitle>
            <DialogDescription className="sr-only">Como a escala é montada, como a cota e o saldo são calculados e o que são os dias vermelhos.</DialogDescription>
          </DialogHeader>
          <RegrasDosOficiais />
        </DialogContent>
      </Dialog>
    </>
  );
}
