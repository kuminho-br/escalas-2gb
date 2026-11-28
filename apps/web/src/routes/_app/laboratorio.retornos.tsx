import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { cadastrarFerramenta, consultaFerramentas, consultaRetornos, mudarFerramentaDeTeste, type FerramentaDeTeste, type FiltroDeRetornos, type RetornoListado } from '@/api/laboratorio';
import { mensagemComCampo, mensagemDe } from '@/api/cliente';
import { ehAdministrador } from '@/api/eu';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { useAviso } from '@/componentes/resposta/useAviso';
import { Vazio } from '@/componentes/resposta/Vazio';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { emLaboratorio } from '@/laboratorio/modo';

/** O que a API devolve de uma vez (`limit 500` em `retornos.ts`). */
const LIMITE_DOS_RETORNOS = 500;

export const Route = createFileRoute('/_app/laboratorio/retornos')({
  // é do administrador da conta real: o perfil de administrador de teste (dentro do Laboratório) não vale aqui; a API confere de qualquer jeito
  beforeLoad: ({ context }) => {
    if (!ehAdministrador(context.eu) || emLaboratorio()) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
  },
  component: Retornos,
});

const SITUACOES: Record<FerramentaDeTeste['situacao'], string> = { em_teste: 'Em teste', encerrada: 'Encerrada', virou_modulo: 'Virou módulo' };
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });

function Retornos() {
  return (
    <Moldura titulo="Laboratório" subtitulo="O que as pessoas acharam das ferramentas em teste, e o cadastro das ferramentas.">
      <Tabs defaultValue="retornos">
        <TabsList>
          <TabsTrigger value="retornos">Retornos</TabsTrigger>
          <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>
        </TabsList>
        <TabsContent value="retornos" className="pt-4"><ListaDeRetornos /></TabsContent>
        <TabsContent value="ferramentas" className="pt-4"><CadastroDeFerramentas /></TabsContent>
      </Tabs>
    </Moldura>
  );
}

function ListaDeRetornos() {
  const ferramentas = useQuery(consultaFerramentas());
  const [filtro, setFiltro] = useState<FiltroDeRetornos>({});
  const retornos = useQuery(consultaRetornos(filtro));
  const mudar = (parcial: FiltroDeRetornos) => setFiltro((f) => ({ ...f, ...parcial }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-4 rounded-controle border border-linha bg-superficie p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="retornos-ferramenta">Ferramenta</Label>
          <Selecao id="retornos-ferramenta" value={filtro.ferramenta ?? ''} onChange={(e) => mudar({ ferramenta: e.target.value || undefined })} className="w-56">
            <option value="">Todas</option>
            {ferramentas.data?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
        </div>
        <fieldset className="flex flex-wrap items-end gap-3">
          <legend className="mb-1.5 text-corpo font-medium">Período</legend>
          <div className="grid gap-1.5">
            <Label htmlFor="retornos-de" className="text-apoio text-apagado">De</Label>
            <Input id="retornos-de" type="date" value={filtro.de ?? ''} onChange={(e) => mudar({ de: e.target.value || undefined })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="retornos-ate" className="text-apoio text-apagado">Até</Label>
            <Input id="retornos-ate" type="date" value={filtro.ate ?? ''} onChange={(e) => mudar({ ate: e.target.value || undefined })} />
          </div>
        </fieldset>
      </div>
      {retornos.isPending && <Espera />}
      {retornos.isError && <p role="alert" className="text-corpo text-alerta">{mensagemDe(retornos.error)}</p>}
      {retornos.data && retornos.data.length === 0 && <Vazio titulo="Nenhum retorno" frase="Ninguém deixou retorno com esse filtro ainda." />}
      {/* a API devolve no máximo 500 (os mais recentes): com 500, pode haver outros que os filtros mostram */}
      {retornos.data && retornos.data.length >= LIMITE_DOS_RETORNOS && <p role="status" className="text-apoio text-apagado">Mostrando os 500 mais recentes. Use os filtros para ver os outros.</p>}
      {retornos.data && retornos.data.length > 0 && (
        <ul className="grid gap-2">
          {retornos.data.map((r) => <ItemDeRetorno key={r.id} r={r} />)}
        </ul>
      )}
    </div>
  );
}

function ItemDeRetorno({ r }: { r: RetornoListado }) {
  return (
    <li className="grid gap-2 rounded-controle border border-linha bg-superficie p-3 md:p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <b className="font-cond text-nome leading-6 font-semibold">{r.ferramenta}</b>
        <span aria-label={`Nota ${r.nota} de 5`} className="rounded-controle border border-laboratorio px-1.5 text-apoio font-semibold text-laboratorio">{r.nota} de 5</span>
        <span className="text-apoio text-apagado md:ml-auto">{quando(r.criadoEm)}</span>
      </div>
      <p className="text-corpo whitespace-pre-line">{r.texto}</p>
      <p className="text-apoio text-apagado">
        {r.conta ? <><span className="font-medium text-tinta">{r.conta.nome}</span> ({r.conta.matricula})</> : <span className="font-medium text-tinta">Conta apagada</span>}, testando como {r.perfilDeTeste}, na tela <span className="break-all">{r.tela}</span>
      </p>
    </li>
  );
}

function CadastroDeFerramentas() {
  const queryClient = useQueryClient();
  const avisar = useAviso();
  const ferramentas = useQuery(consultaFerramentas());
  const [nome, setNome] = useState('');
  const [oQueTestar, setOQueTestar] = useState('');
  const [caminho, setCaminho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ['laboratorio', 'ferramentas'] });

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await cadastrarFerramenta({ nome: nome.trim(), oQueTestar: oQueTestar.trim(), caminho: caminho.trim() || null });
      setNome('');
      setOQueTestar('');
      setCaminho('');
      await atualizar();
      avisar({ texto: 'Ferramenta cadastrada.' });
    } catch (err) {
      setErro(mensagemComCampo(err));
    } finally {
      setSalvando(false);
    }
  }

  async function mudarSituacao(f: FerramentaDeTeste, situacao: FerramentaDeTeste['situacao']) {
    try {
      await mudarFerramentaDeTeste(f.id, { situacao });
      await atualizar();
    } catch (err) {
      avisar({ texto: mensagemDe(err), erro: true });
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={cadastrar} className="grid gap-3 rounded-controle border border-linha bg-superficie p-4 md:max-w-180">
        <h2 className="font-cond text-bloco font-semibold">Nova ferramenta</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="ferramenta-nome">Nome</Label>
          <Input id="ferramenta-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ferramenta-o-que-testar">O que testar</Label>
          <Textarea id="ferramenta-o-que-testar" value={oQueTestar} onChange={(e) => setOQueTestar(e.target.value)} maxLength={500} rows={3} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ferramenta-caminho">Caminho no Laboratório (opcional)</Label>
          <Input id="ferramenta-caminho" value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="/grade" maxLength={200} />
        </div>
        {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
        <div><Button type="submit" disabled={salvando}>Cadastrar ferramenta</Button></div>
      </form>
      {ferramentas.isPending && <Espera />}
      {ferramentas.data && ferramentas.data.length === 0 && <Vazio titulo="Nenhuma ferramenta cadastrada" frase="Cadastre a primeira no formulário acima." />}
      {ferramentas.data && ferramentas.data.length > 0 && (
        <ul className="grid gap-2">
          {ferramentas.data.map((f) => (
            <li key={f.id} className="grid gap-2 rounded-controle border border-linha bg-superficie p-3 md:grid-cols-[1fr_12rem] md:items-start md:p-4">
              <div className="grid gap-1">
                <b className="font-cond text-nome leading-6 font-semibold">{f.nome}</b>
                <p className="text-corpo">{f.oQueTestar}</p>
                {f.caminho && <p className="text-apoio text-apagado">Caminho: {f.caminho}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`situacao-${f.id}`} className="text-apoio text-apagado">Situação de {f.nome}</Label>
                <Selecao id={`situacao-${f.id}`} value={f.situacao} onChange={(e) => void mudarSituacao(f, e.target.value as FerramentaDeTeste['situacao'])}>
                  {Object.entries(SITUACOES).map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
                </Selecao>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
