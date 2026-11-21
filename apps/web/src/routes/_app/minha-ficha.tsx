import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Telefone, type MinhaFicha } from 'contratos';
import { useState, type ReactNode } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { alterarTelefone, consultaMinhaFicha } from '@/api/minha-ficha';
import { Campo } from '@/componentes/Campo';
import { Secao } from '@/componentes/militares/Secao';
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

/** Os dados do próprio militar, só para leitura; só o telefone se altera aqui. O resto, quem cuida do cadastro altera. */
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
            <Dado rotulo="Posto ou graduação" valor={f.postoGrad} />
            <Dado rotulo="Nome de guerra" valor={f.nomeGuerra} />
            <Dado rotulo="Nome completo" valor={f.nomeCompleto} />
            <Dado rotulo="Matrícula" valor={f.matricula} />
          </Dados>
        </Secao>
        <Contato ficha={f} />
        <Secao titulo="Dados pessoais">
          <Dados>
            <Dado rotulo="Sexo" valor={f.sexo && SEXO[f.sexo]} />
            <Dado rotulo="Aniversário" valor={f.nascimento && `${dois(f.nascimento.dia)}/${dois(f.nascimento.mes)}`} />
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
            </Dados>
          ) : (
            <p className="text-sm text-apagado">Sem lotação neste momento.</p>
          )}
        </Secao>
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
