import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CartaoDaGuarnicao, FuncaoDoCartao } from '@/componentes/CartaoDaGuarnicao';
import { Encaixe } from '@/componentes/Encaixe';
import { Placa } from '@/componentes/Placa';

// Entrega 6.20, Task 3: a placa, o encaixe e o cartão da guarnição (docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md, "Placa, encaixe e cartão").
const ALFA = { patente: 'SD', nome: 'ALFA', matricula: '990001-1' };

describe('Placa', () => {
  it('mostra a patente (13 px, apagado, peso 500) e o nome (17 px estreita); o nome do serviço só quando a origem não é Pronto', () => {
    const { rerender } = render(<Placa {...ALFA} servico={{ nome: 'Pronto', cor: '#2F8F5B' }} />);
    expect(screen.getByText('SD')).toHaveClass('text-apoio', 'font-medium', 'text-apagado');
    expect(screen.getByText('ALFA')).toHaveClass('font-cond', 'text-nome', 'font-semibold');
    expect(screen.queryByText('Pronto')).toBeNull();
    rerender(<Placa {...ALFA} servico={{ nome: 'JES', cor: '#6E56A8' }} />);
    expect(screen.getByText('JES')).toHaveClass('text-apoio', 'text-apagado');
  });

  it('a faixa do serviço tem 5 px e a cor do cadastro; a placa tem altura de controle, borda linha, raio de controle e sombra apoiada', () => {
    render(<Placa {...ALFA} servico={{ nome: 'JES', cor: '#6E56A8' }} />);
    const placa = document.querySelector('[data-placa]') as HTMLElement;
    expect(placa).toHaveClass('h-(--altura-controle)', 'rounded-controle', 'border-linha', 'shadow-apoiada', 'bg-superficie');
    const faixa = placa.querySelector('[data-faixa-servico]') as HTMLElement;
    expect(faixa).toHaveClass('w-[5px]');
    expect(faixa.style.backgroundColor).toBe('rgb(110, 86, 168)');
  });

  it('P5 negada: a matrícula continua visível na linha da guarnição; a dica traz patente, nome, matrícula e serviço', () => {
    render(<Placa {...ALFA} servico={{ nome: 'JES', cor: '#6E56A8' }} />);
    expect(screen.getByText('990001-1')).toHaveClass('text-apoio', 'text-apagado');
    expect(document.querySelector('[data-placa]')).toHaveAttribute('title', 'SD ALFA, 990001-1, JES');
  });

  it('quem corta é o nome: o nome tem reticências e o resto não encolhe', () => {
    render(<Placa {...ALFA} servico={{ nome: 'JES', cor: '#6E56A8' }} acoes={[{ rotulo: 'Remover da vaga', aoEscolher: () => {} }]} />);
    expect(screen.getByText('ALFA')).toHaveClass('truncate');
    expect(screen.getByText('SD')).toHaveClass('shrink-0');
    expect(screen.getByRole('button', { name: 'Ações de ALFA' })).toHaveClass('shrink-0');
  });

  it('o botão das ações (três pontos) está sempre à mostra e abre "Trocar militar" e "Remover da vaga"', async () => {
    const trocar = vi.fn();
    const remover = vi.fn();
    render(
      <Placa
        {...ALFA}
        acoes={[
          { rotulo: 'Trocar militar', aoEscolher: trocar },
          { rotulo: 'Remover da vaga', aoEscolher: remover },
        ]}
      />,
    );
    const botao = screen.getByRole('button', { name: 'Ações de ALFA' });
    expect(botao).toHaveClass('size-7', 'text-apagado', 'hover:text-tinta');
    await userEvent.click(botao);
    const itens = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(itens).toEqual(['Trocar militar', 'Remover da vaga']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remover da vaga' }));
    expect(remover).toHaveBeenCalledTimes(1);
    expect(trocar).not.toHaveBeenCalled();
  });

  it('Esc fecha o menu e devolve o foco ao botão das ações (Review Focus 4)', async () => {
    render(<Placa {...ALFA} acoes={[{ rotulo: 'Remover da vaga', aoEscolher: () => {} }]} />);
    const botao = screen.getByRole('button', { name: 'Ações de ALFA' });
    await userEvent.click(botao);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(botao).toHaveFocus();
  });

  it('sem ações, a placa não tem botão; o rótulo das ações pode vir de quem usa', () => {
    const { rerender } = render(<Placa {...ALFA} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<Placa {...ALFA} acoes={[{ rotulo: 'Remover do turno', aoEscolher: () => {} }]} rotuloDasAcoes="Ações de ALFA em ABT" />);
    expect(screen.getByRole('button', { name: 'Ações de ALFA em ABT' })).toBeInTheDocument();
  });

  it('escolhida: borda e contorno de 1 px tinta; choque: borda alerta, ícone e a frase embaixo', () => {
    const { rerender } = render(<Placa {...ALFA} estado="escolhida" />);
    expect(document.querySelector('[data-placa]')).toHaveClass('border-tinta', 'ring-1', 'ring-tinta');
    rerender(<Placa {...ALFA} estado="choque" choque="Já está em ABT no mesmo horário." />);
    const placa = document.querySelector('[data-placa]') as HTMLElement;
    expect(placa).toHaveClass('border-alerta', 'ring-1', 'ring-alerta');
    const frase = screen.getByText('Já está em ABT no mesmo horário.');
    expect(frase).toHaveClass('text-apoio', 'font-medium', 'text-alerta');
    expect(frase.querySelector('svg')).not.toBeNull();
    expect(placa).toHaveAccessibleDescription('Já está em ABT no mesmo horário.');
  });

  it('com aoClicar a placa inteira é um botão (o trecho da linha do tempo), sem o menu', async () => {
    const aoClicar = vi.fn();
    render(<Placa {...ALFA} aoClicar={aoClicar} rotuloAcessivel="Motorista: SD ALFA, 08h–20h, Pronto" />);
    await userEvent.click(screen.getByRole('button', { name: 'Motorista: SD ALFA, 08h–20h, Pronto' }));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });
});

describe('Encaixe', () => {
  it('o obrigatório tem a caixa da placa, fundo de pendência, borda tracejada de 1,5 px e o texto "Escolher militar"', () => {
    render(<Encaixe obrigatorio aoEscolher={() => {}} rotuloAcessivel="Escolher militar para Chefe de ABT" />);
    const botao = screen.getByRole('button', { name: 'Escolher militar para Chefe de ABT' });
    expect(botao).toHaveClass('h-(--altura-controle)', 'rounded-controle', 'bg-pendencia-fundo', 'border-dashed', 'border-pendencia', 'text-pendencia', 'font-medium', 'border-[1.5px]');
    expect(botao).toHaveTextContent('Escolher militar');
    expect(botao).toHaveAttribute('data-obrigatoria');
    expect(botao.querySelector('svg')).not.toBeNull();
  });

  it('o opcional não tem fundo, a borda tracejada é de 1 px encaixe, o texto é apagado e diz "Vaga opcional"', () => {
    render(<Encaixe obrigatorio={false} aoEscolher={() => {}} rotuloAcessivel="Escolher militar para Chefe de ABT" />);
    const botao = screen.getByRole('button', { name: 'Escolher militar para Chefe de ABT' });
    expect(botao).toHaveClass('border-dashed', 'border-encaixe', 'text-apagado', 'font-normal', 'hover:bg-superficie', 'hover:border-solid', 'hover:border-tinta', 'hover:text-tinta');
    expect(botao).not.toHaveClass('bg-pendencia-fundo');
    expect(botao).not.toHaveAttribute('data-obrigatoria');
    expect(botao).toHaveTextContent('Vaga opcional');
  });

  it('com o mouse, o tracejado vira linha cheia', () => {
    render(<Encaixe obrigatorio aoEscolher={() => {}} rotuloAcessivel="x" />);
    expect(screen.getByRole('button', { name: 'x' })).toHaveClass('hover:border-solid');
  });

  it('sem como escolher (consulta), é só um aviso: nada para clicar', () => {
    render(<Encaixe obrigatorio />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Vaga livre')).toBeInTheDocument();
  });

  it('clicar escolhe', async () => {
    const aoEscolher = vi.fn();
    render(<Encaixe obrigatorio aoEscolher={aoEscolher} rotuloAcessivel="x" />);
    await userEvent.click(screen.getByRole('button', { name: 'x' }));
    expect(aoEscolher).toHaveBeenCalledTimes(1);
  });
});

describe('Cartão da guarnição', () => {
  it('junta a equipe: fundo superfície, borda linha, raio de superfície; o nome em 17 px estreita e a viatura em 13 px apagado', () => {
    render(
      <CartaoDaGuarnicao nome="ABT" viatura="ABT-01" faltam={0}>
        <p>conteúdo</p>
      </CartaoDaGuarnicao>,
    );
    const cartao = document.querySelector('[data-cartao]') as HTMLElement;
    expect(cartao).toHaveClass('rounded-superficie', 'border-linha', 'bg-superficie', 'p-3', 'pb-3.5');
    expect(screen.getByRole('heading', { name: 'ABT' })).toHaveClass('font-cond', 'text-nome', 'font-semibold');
    expect(screen.getByText('ABT-01')).toHaveClass('text-apoio', 'text-apagado');
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
  });

  it('diz "Falta 1" ou "Faltam N" numa etiqueta de falta; completa tem o visto cinza com "Completa" para leitor de tela', () => {
    const { rerender } = render(<CartaoDaGuarnicao nome="ABT" faltam={1} frases="Falta 1 Chefe.">x</CartaoDaGuarnicao>);
    expect(screen.getByText('Falta 1').closest('[data-etiqueta]')).toHaveClass('text-pendencia', 'bg-pendencia-fundo');
    expect(screen.getByRole('img', { name: 'Falta 1 Chefe.' })).toBeInTheDocument();
    rerender(<CartaoDaGuarnicao nome="ABT" faltam={3}>x</CartaoDaGuarnicao>);
    expect(screen.getByText('Faltam 3')).toBeInTheDocument();
    rerender(<CartaoDaGuarnicao nome="ABT" faltam={0}>x</CartaoDaGuarnicao>);
    const completa = screen.getByRole('img', { name: 'Completa' });
    expect(completa).toHaveClass('text-encaixe');
    expect(screen.queryByText(/Falta/)).toBeNull();
  });

  it('a função tem o rótulo numa coluna de 72 px (nome em 13 px, peso 500; a CNH embaixo, apagado) e os lugares em coluna, a 6 px; com menos de 340 px o rótulo sobe', () => {
    render(
      <CartaoDaGuarnicao nome="ABT" faltam={0}>
        <FuncaoDoCartao nome="Motorista" cnh="D">
          <Placa {...ALFA} />
          <Placa patente="CB" nome="BRAVO" matricula="990002-2" />
        </FuncaoDoCartao>
      </CartaoDaGuarnicao>,
    );
    const funcao = document.querySelector('[data-funcao-do-cartao]') as HTMLElement;
    expect(funcao).toHaveClass('grid-cols-[4.5rem_1fr]', '@max-[21.25rem]:grid-cols-1');
    expect(document.querySelector('[data-cartao]')).toHaveClass('@container');
    expect(within(funcao).getByText('Motorista')).toHaveClass('text-apoio', 'font-medium');
    expect(within(funcao).getByText('CNH D')).toHaveClass('text-apoio', 'text-apagado');
    expect(funcao.querySelector('[data-lugares]')).toHaveClass('gap-1.5');
  });
});
