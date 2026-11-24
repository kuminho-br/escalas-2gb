import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Campo } from '@/componentes/Campo';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { Selecao } from '@/componentes/Selecao';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Contador } from '@/componentes/ui/contador';
import { DialogContent, DialogTitle, Dialog } from '@/componentes/ui/dialog';
import { EnvioDeArquivo } from '@/componentes/ui/envio-de-arquivo';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Radio } from '@/componentes/ui/radio';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';

// Entrega 6.20, Task 2: as peças do sistema de estilo (docs/superpowers/specs/2026-11-23-sistema-de-estilo-design.md, seção "Componentes").
describe('Campo', () => {
  it('a ajuda (13 px, apagado) e o erro (13 px, peso 500, alerta, com ícone) se ligam ao campo por aria-describedby, e o campo com erro vira aria-invalid', () => {
    render(
      <Campo id="x" rotulo="Matrícula" ajuda="Seis dígitos, hífen e um dígito." erro="Matrícula inválida.">
        <Input id="x" />
      </Campo>,
    );
    const campo = screen.getByLabelText('Matrícula');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Seis dígitos, hífen e um dígito. Matrícula inválida.');
    expect(screen.getByText('Seis dígitos, hífen e um dígito.')).toHaveClass('text-apoio', 'text-apagado');
    const erro = screen.getByText('Matrícula inválida.');
    expect(erro).toHaveClass('text-apoio', 'font-medium', 'text-alerta');
    expect(erro.querySelector('svg')).not.toBeNull();
  });

  it('só com a ajuda, ela é a descrição do campo e o campo não é inválido', () => {
    render(
      <Campo id="y" rotulo="Telefone" ajuda="Com DDD.">
        <Input id="y" />
      </Campo>,
    );
    expect(screen.getByLabelText('Telefone')).toHaveAccessibleDescription('Com DDD.');
    expect(screen.getByLabelText('Telefone')).not.toHaveAttribute('aria-invalid');
  });

  it('sem ajuda nem erro, nada é ligado ao campo; o campo opcional diz "(opcional)" no rótulo', () => {
    render(
      <>
        <Campo id="a" rotulo="Nome">
          <Input id="a" />
        </Campo>
        <Campo id="b" rotulo="Apelido" opcional>
          <Input id="b" />
        </Campo>
      </>,
    );
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Apelido (opcional)')).toBeInTheDocument();
  });

  it('o rótulo tem 15 px, peso 500, e fica a 6 px do campo', () => {
    render(
      <Campo id="c" rotulo="Posto">
        <Input id="c" />
      </Campo>,
    );
    expect(screen.getByText('Posto')).toHaveClass('text-corpo', 'font-medium');
    expect(screen.getByText('Posto').closest('div')).toHaveClass('gap-1.5');
  });
});

describe('o campo (entrada, texto e lista de opções)', () => {
  const comum = ['rounded-controle', 'border-encaixe', 'text-corpo', 'px-3', 'hover:border-tinta', 'aria-invalid:border-2', 'aria-invalid:border-alerta'];

  it('a entrada tem a altura de controle, raio de controle, borda encaixe, 15 px, e com erro borda de 2 px de alerta', () => {
    render(<Input aria-label="e" />);
    expect(screen.getByLabelText('e')).toHaveClass('h-(--altura-controle)', ...comum);
  });

  it('o texto de várias linhas e a lista de opções nativa seguem o mesmo campo', () => {
    render(
      <>
        <Textarea aria-label="t" />
        <Selecao aria-label="s">
          <option>a</option>
        </Selecao>
      </>,
    );
    expect(screen.getByLabelText('t')).toHaveClass(...comum);
    expect(screen.getByLabelText('s')).toHaveClass('h-(--altura-controle)', ...comum);
  });

  it('o rótulo avulso tem 15 px e peso 500', () => {
    render(<Label>Nome</Label>);
    expect(screen.getByText('Nome')).toHaveClass('text-corpo', 'font-medium');
  });
});

describe('Etiqueta', () => {
  it('tem quatro tipos: serviço (quadradinho com a cor), falta (âmbar), erro (alerta, com ícone) e neutra (passa e apagado)', () => {
    render(
      <>
        <Etiqueta tipo="servico" cor="#2B7BB9">Saldo</Etiqueta>
        <Etiqueta tipo="falta">Sem telefone</Etiqueta>
        <Etiqueta tipo="erro">Choque</Etiqueta>
        <Etiqueta tipo="neutra">novo</Etiqueta>
      </>,
    );
    const servico = screen.getByText('Saldo').closest('[data-etiqueta]')!;
    expect(servico).toHaveClass('h-6', 'rounded-controle', 'text-apoio', 'font-medium', 'text-tinta');
    expect((servico.querySelector('[data-quadradinho]') as HTMLElement).style.backgroundColor).toBe('rgb(43, 123, 185)');
    // a cor do serviço nunca fica atrás do texto
    expect((servico as HTMLElement).style.backgroundColor).toBe('');
    expect(screen.getByText('Sem telefone').closest('[data-etiqueta]')).toHaveClass('text-pendencia', 'bg-pendencia-fundo');
    const erro = screen.getByText('Choque').closest('[data-etiqueta]')!;
    expect(erro).toHaveClass('text-alerta', 'bg-alerta-fundo');
    expect(erro.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('novo').closest('[data-etiqueta]')).toHaveClass('bg-passa', 'text-apagado');
  });
});

describe('marcar e escolher', () => {
  it('a caixa e o círculo têm 20 px, borda encaixe e, marcados, fundo tinta', () => {
    render(
      <>
        <Checkbox aria-label="caixa" />
        <Radio aria-label="círculo" name="g" />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: 'caixa' })).toHaveClass('size-5', 'border-encaixe', 'checked:bg-tinta');
    const circulo = screen.getByRole('radio', { name: 'círculo' });
    expect(circulo).toHaveClass('size-5', 'rounded-full', 'border-encaixe', 'checked:bg-tinta');
  });

  it('o círculo marca e desmarca como um radio comum', async () => {
    const aoMudar = vi.fn();
    render(<Radio aria-label="r" name="g" checked={false} onChange={aoMudar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'r' }));
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });
});

describe('abas', () => {
  it('a faixa rola dentro dela mesma; a aba tem altura de controle, apagada, peso 500; a escolhida é tinta, peso 600, com 2 px embaixo', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="seções">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByRole('tablist')).toHaveClass('overflow-x-auto', 'border-b');
    const aba = screen.getByRole('tab', { name: 'B' });
    expect(aba).toHaveClass('h-(--altura-controle)', 'text-apagado', 'font-medium', 'data-[state=active]:text-tinta', 'data-[state=active]:font-semibold', 'data-[state=active]:border-tinta');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('data-state', 'active');
  });
});

describe('tabela', () => {
  it('o cabeçalho é de 13 px, peso 500, apagado; a linha tem 44 px e fica em passa com o mouse em cima; a tabela rola dentro do próprio quadro', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alfa</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText('Nome')).toHaveClass('text-apoio', 'font-medium', 'text-apagado');
    const linha = screen.getByText('Alfa').closest('tr')!;
    expect(linha).toHaveClass('h-11', 'hover:bg-passa');
    expect(screen.getByRole('table').parentElement).toHaveClass('overflow-x-auto');
  });
});

describe('o diálogo', () => {
  it('tem raio de superfície, sombra por cima, título de 20 px e o véu é tinta a 45%', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('rounded-superficie', 'shadow-por-cima');
    expect(screen.getByText('Título')).toHaveClass('text-bloco', 'font-cond');
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('bg-tinta/45');
  });
});

describe('mês', () => {
  it('é um grupo com borda encaixe e duas setas, e o nome do mês em 17 px estreita; só um mês completo troca o mês da tela', () => {
    const aoMudar = vi.fn();
    render(
      <>
        <Label htmlFor="m">Mês</Label>
        <CampoDeMes id="m" valor="2026-12" aoMudar={aoMudar} />
      </>,
    );
    const campo = screen.getByLabelText('Mês');
    expect(campo.parentElement).toHaveClass('rounded-controle', 'border', 'border-encaixe');
    expect(campo).toHaveClass('font-cond', 'text-nome');
    fireEvent.change(campo, { target: { value: '2027-01' } });
    expect(aoMudar).toHaveBeenCalledWith('2027-01');
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeInTheDocument();
  });
});

describe('contador', () => {
  it('é um grupo com menos, o valor em 17 px estreita e mais; os botões se apagam nos limites', async () => {
    const aoMudar = vi.fn();
    render(<Contador rotulo="Mínimo de Chefe" valor={1} minimo={1} maximo={2} aoMudar={aoMudar} />);
    const grupo = screen.getByRole('group', { name: 'Mínimo de Chefe' });
    expect(grupo).toHaveClass('rounded-controle', 'border', 'border-encaixe');
    expect(within(grupo).getByText('1')).toHaveClass('font-cond', 'text-nome', 'tabular-nums');
    expect(within(grupo).getByRole('button', { name: 'Diminuir mínimo de Chefe' })).toBeDisabled();
    await userEvent.click(within(grupo).getByRole('button', { name: 'Aumentar mínimo de Chefe' }));
    expect(aoMudar).toHaveBeenCalledWith(2);
  });
});

describe('envio de arquivo', () => {
  it('vazio: borda tracejada encaixe e botão secundário; com arquivo: borda cheia linha, o nome em peso 600 e "Trocar"', async () => {
    const aoEscolher = vi.fn();
    const { rerender } = render(<EnvioDeArquivo id="arq" rotulo="Arquivo da planilha (.xlsx)" accept=".xlsx" arquivo={null} aoEscolher={aoEscolher} />);
    const quadro = document.querySelector('[data-envio]') as HTMLElement;
    expect(quadro).toHaveClass('border-dashed', 'border-encaixe', 'rounded-controle');
    expect(screen.getByRole('button', { name: 'Escolher arquivo' })).toHaveAttribute('data-variant', 'secundario');
    const arquivo = new File(['x'], 'sandbox.xlsx');
    await userEvent.upload(screen.getByLabelText('Arquivo da planilha (.xlsx)'), arquivo);
    expect(aoEscolher).toHaveBeenCalledWith(arquivo);
    rerender(<EnvioDeArquivo id="arq" rotulo="Arquivo da planilha (.xlsx)" accept=".xlsx" arquivo={arquivo} aoEscolher={aoEscolher} />);
    expect(document.querySelector('[data-envio]')).toHaveClass('border-linha');
    expect(document.querySelector('[data-envio]')).not.toHaveClass('border-dashed');
    expect(screen.getByText('sandbox.xlsx')).toHaveClass('font-semibold');
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument();
  });
});
