import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Telefone, type MinhaFicha } from 'contratos';
import { useState, type ReactNode } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { alterarTelefone, consultaMinhaFicha } from '@/api/minha-ficha';
import { Campo } from '@/componentes/Campo';
import { Secao } from '@/componentes/militares/Secao';
import { mascararCep, mascararCpf } from '@/lib/militares';
import { gravarQuando, lerQuando, pedeMenosMovimento, type Quando } from '@/lib/transicao-login/regra';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

export const Route = createFileRoute('/_app/minha-ficha')({
  component: MinhaFichaTela,
});

const SEXO = { M: 'Masculino', F: 'Feminino' } as const;
const JORNADA = { pronto: 'Pronto', adm: 'Administrativo' } as const;
const dois = (n: number) => String(n).padStart(2, '0');

function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-apagado">{rotulo}</dt>
      <dd>{valor || <span className="text-apagado">—</span>}</dd>
    </div>
  );
}
const Dados = ({ children }: { children: ReactNode }) => <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>;

/** Os dados do próprio militar, só para leitura; só o telefone se altera aqui (CPF e endereço, só para leitura). O resto, quem cuida do cadastro altera. */
function MinhaFichaTela() {
  const { data: f, error, isPending } = useQuery(consultaMinhaFicha);
  if (isPending) return <p className="text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="text-alerta">{mensagemDe(error)}</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 font-cond text-3xl font-semibold">Minha ficha</h1>
      <div className="divide-y divide-linha rounded-lg border border-linha bg-superficie">
        <Secao titulo="Identificação">
          <Dados>
            <Dado rotulo="Posto-graduação" valor={f.postoGrad} />
            <Dado rotulo="Nome de guerra" valor={f.nomeGuerra} />
            <Dado rotulo="Nome completo" valor={f.nomeCompleto} />
            <Dado rotulo="Matrícula" valor={f.matricula} />
          </Dados>
        </Secao>
        <Contato ficha={f} />
        <Secao titulo="Dados pessoais">
          <Dados>
            <Dado rotulo="Sexo" valor={f.sexo && SEXO[f.sexo]} />
            <Dado rotulo="Aniversário" valor={f.nascimento && `${dois(f.nascimento.dia)}/${dois(f.nascimento.mes)}${f.nascimento.ano ? `/${f.nascimento.ano}` : ''}`} />
            <Dado rotulo="CPF" valor={f.cpf && mascararCpf(f.cpf)} />
          </Dados>
        </Secao>
        <Secao titulo="Endereço">
          <Dados>
            <Dado rotulo="CEP" valor={f.endereco.cep && mascararCep(f.endereco.cep)} />
            <Dado rotulo="Logradouro" valor={[f.endereco.logradouro, f.endereco.numero].filter(Boolean).join(', ')} />
            <Dado rotulo="Complemento" valor={f.endereco.complemento} />
            <Dado rotulo="Bairro" valor={f.endereco.bairro} />
            <Dado rotulo="Cidade" valor={[f.endereco.cidade, f.endereco.uf].filter(Boolean).join(' / ')} />
          </Dados>
        </Secao>
        <Secao titulo="Comportamento">
          <Dados>
            <Dado rotulo="Comportamento" valor={f.comportamento} />
            <Dado rotulo="Boletim" valor={f.comportamentoBoletim} />
          </Dados>
        </Secao>
        <Secao titulo="Situação de hoje">
          {f.situacao ? (
            <Dados>
              <Dado rotulo="Lotação" valor={f.situacao.lotacao} />
              <Dado rotulo="Equipe" valor={f.situacao.equipe} />
              <Dado rotulo="Jornada" valor={JORNADA[f.situacao.jornada]} />
              <Dado rotulo="Quadro" valor={f.situacao.quadro} />
              <Dado rotulo="Situação" valor={f.situacao.situacaoDoMilitar} />
            </Dados>
          ) : (
            <p className="text-sm text-apagado">Sem lotação neste momento.</p>
          )}
        </Secao>
        <AnimacaoDeEntrada />
        <Secao titulo="Motorista e voluntariado">
          <Dados>
            <Dado rotulo="No quadro de motoristas" valor={f.motorista ? 'Sim' : 'Não'} />
            <Dado rotulo="CNH" valor={[...f.cnh, ...f.cnhPorHierarquia.map((c) => `${c} (pela hierarquia)`)].join(', ')} />
            <Dado rotulo="Voluntário JES" valor={f.voluntarioJes ? 'Sim' : 'Não'} />
          </Dados>
        </Secao>
      </div>
    </div>
  );
}

function Contato({ ficha }: { ficha: MinhaFicha }) {
  const queryClient = useQueryClient();
  const [telefone, setTelefone] = useState(ficha.telefone ?? '');
  const [erro, setErro] = useState<string | undefined>();
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(undefined);
    setAviso(null);
    // vazio apaga; o que o contrato recusa aparece no campo, sem ir ao servidor
    const lido = telefone.trim() ? Telefone.safeParse(telefone) : null;
    if (lido && !lido.success) {
      setErro(lido.error.issues[0]!.message);
      return;
    }
    setSalvando(true);
    try {
      const nova = await alterarTelefone(lido?.success ? lido.data : null);
      queryClient.setQueryData(consultaMinhaFicha.queryKey, nova);
      setTelefone(nova.telefone ?? '');
      setAviso({ erro: false, texto: 'Telefone salvo.' });
    } catch (e) {
      const doCampo = camposDe(e).telefone;
      if (doCampo) setErro(doCampo);
      else setAviso({ erro: true, texto: mensagemDe(e) });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao titulo="Contato">
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Campo id="mf-telefone" rotulo="Telefone" erro={erro}>
            <Input id="mf-telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <Dados><Dado rotulo="E-mail institucional" valor={ficha.email} /></Dados>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={salvando}>Salvar</Button>
          {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? 'text-sm text-alerta' : 'text-sm text-apagado'}>{aviso.texto}</p>}
        </div>
      </form>
    </Secao>
  );
}

const OPCOES_DA_ANIMACAO: { valor: Quando; rotulo: string }[] = [
  { valor: 'sempre', rotulo: 'Em toda entrada' },
  { valor: '12h', rotulo: 'Uma vez a cada 12 horas' },
  { valor: 'nunca', rotulo: 'Nunca' },
];

/** Quando a animação do login toca. A escolha fica neste navegador (a animação começa antes de o servidor dizer quem entra) e grava na hora. */
function AnimacaoDeEntrada() {
  const [quando, setQuando] = useState<Quando>(lerQuando);
  const menosMovimento = pedeMenosMovimento();
  const escolher = (q: Quando) => {
    setQuando(q);
    gravarQuando(q);
  };
  return (
    <Secao titulo="Animação de entrada">
      <fieldset role="radiogroup" aria-label="Animação de entrada" className="grid gap-2">
        {OPCOES_DA_ANIMACAO.map((o) => (
          <label key={o.valor} className="flex items-center gap-2 text-sm">
            <input type="radio" name="animacao-de-entrada" value={o.valor} checked={quando === o.valor} onChange={() => escolher(o.valor)} className="size-4 accent-vinho" />
            {o.rotulo}
          </label>
        ))}
      </fieldset>
      <p className="mt-2 text-xs text-apagado">Vale para este navegador.</p>
      {menosMovimento && <p className="mt-1 text-sm text-pendencia">Seu aparelho pede menos movimento, então a animação não toca.</p>}
    </Secao>
  );
}
