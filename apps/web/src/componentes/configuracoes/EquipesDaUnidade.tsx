import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Equipe } from 'contratos';
import { useState, type FormEvent } from 'react';
import { ErroApi, mensagemDe } from '@/api/cliente';
import { excluirEquipe, incluirEquipe, reativarEquipe, renomearEquipe } from '@/api/equipes';
import { consultaEquipes } from '@/api/militares';
import { Espera } from '@/componentes/resposta/Espera';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

const GRUPOS: { tipo: Equipe['tipo']; titulo: string }[] = [
  { tipo: 'pronto', titulo: 'Pronto' },
  { tipo: 'adm', titulo: 'ADM' },
  { tipo: 'externa', titulo: 'Externa' },
];

/**
 * As equipes que a unidade vê (6.64): as da corporação, as das unidades de cima e as dela, por tipo (Pronto, ADM e Externa). As herdadas levam a marca de onde vêm e só quem as criou
 * as muda (o administrador, na corporação); o gestor cria equipes do ADM na própria unidade, renomeia e exclui as dela. A API confere cada regra e a frase do erro aparece aqui.
 * `podeGerir`: gestor ou acima; `admin`: o administrador, que também renomeia as padrão.
 */
export function EquipesDaUnidade({ unidadeId, podeGerir, admin }: { unidadeId: string; podeGerir: boolean; admin: boolean }) {
  const queryClient = useQueryClient();
  const equipes = useQuery(consultaEquipes(unidadeId));
  const [nome, setNome] = useState('');
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function executar<T>(acao: () => Promise<T>): Promise<T | null> {
    setErro(null);
    setAviso(null);
    try {
      const r = await acao();
      await queryClient.invalidateQueries({ queryKey: ['equipes'] });
      return r;
    } catch (e) {
      setErro(mensagemDe(e));
      return null;
    }
  }
  async function incluir(e: FormEvent) {
    e.preventDefault();
    setErroDoNome(null);
    setErro(null);
    setAviso(null);
    try {
      await incluirEquipe(unidadeId, nome);
      await queryClient.invalidateQueries({ queryKey: ['equipes'] });
      setNome('');
    } catch (err) {
      // o nome repetido aparece junto do campo, com o que foi digitado
      if (err instanceof ErroApi && err.campos?.nome) setErroDoNome(err.campos.nome);
      else setErro(mensagemDe(err));
    }
  }
  const podeMudar = (e: Equipe) => admin || (podeGerir && !e.herdada);

  if (equipes.isPending) return <Espera className="py-6" />;
  if (equipes.error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(equipes.error)}</p>;
  const lista = equipes.data;
  const soHerdadas = lista.some((e) => e.herdada) && !lista.some((e) => !e.herdada);
  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-corpo text-apagado">
        As equipes do Pronto e a Externa são da corporação, e toda unidade as usa. {podeGerir ? 'Você pode criar equipes do ADM na sua unidade.' : 'Quem cuida do cadastro cria as equipes do ADM de cada unidade.'}
      </p>
      {soHerdadas && <p className="text-corpo text-apagado">Esta unidade só usa as equipes da corporação.</p>}
      {GRUPOS.map(({ tipo, titulo }) => {
        const doTipo = lista.filter((e) => e.tipo === tipo);
        if (doTipo.length === 0) return null;
        return (
          <section key={tipo} aria-label={titulo} className="rounded-xl border border-linha bg-superficie">
            <h3 className="border-b border-linha px-4 py-2.5 font-cond text-lg font-semibold">{titulo}</h3>
            <ul className="divide-y divide-linha">
              {doTipo.map((e) => (
                <Item key={e.id} equipe={e} podeMudar={podeMudar(e)} aoRenomear={(novo) => executar(() => renomearEquipe(e.id, novo))} aoReativar={() => void executar(() => reativarEquipe(e.id))}
                  aoExcluir={async () => { const r = await executar(() => excluirEquipe(e.id)); if (r?.aviso) setAviso(r.aviso); }} />
              ))}
            </ul>
          </section>
        );
      })}
      {aviso && <p role="status" className="rounded-md bg-pendencia-fundo px-3 py-2 text-corpo text-pendencia">{aviso}</p>}
      {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
      {podeGerir && (
        <form onSubmit={incluir} className="grid max-w-md gap-2 rounded-xl border border-linha bg-superficie p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="nova-equipe">Nova equipe do ADM</Label>
            <Input id="nova-equipe" value={nome} maxLength={60} onChange={(e) => { setNome(e.target.value); setErroDoNome(null); }} aria-invalid={erroDoNome ? true : undefined} aria-describedby={erroDoNome ? 'nova-equipe-erro' : undefined} autoComplete="off" />
            {erroDoNome && <p id="nova-equipe-erro" role="alert" className="text-apoio text-alerta">{erroDoNome}</p>}
          </div>
          <div><Button type="submit" disabled={!nome.trim()}>Incluir</Button></div>
        </form>
      )}
    </div>
  );
}

function Item({ equipe, podeMudar, aoRenomear, aoReativar, aoExcluir }: { equipe: Equipe; podeMudar: boolean; aoRenomear: (nome: string) => Promise<unknown>; aoReativar: () => void; aoExcluir: () => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [nome, setNome] = useState(equipe.nome);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (await aoRenomear(nome)) setEditando(false);
  }
  // as padrão do Pronto e a Externa só se renomeiam; a ADM e as criadas pela unidade também se excluem
  const podeExcluir = podeMudar && equipe.tipo === 'adm';
  if (editando) {
    return (
      <li className="px-4 py-2">
        <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`Novo nome de ${equipe.nome}`} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoFocus className="max-w-xs" />
          <Button type="submit" size="sm" disabled={!nome.trim()}>Salvar</Button>
          <Button type="button" size="sm" variant="discreto" onClick={() => { setNome(equipe.nome); setEditando(false); }}>Cancelar</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className={equipe.ativa ? 'font-medium' : 'text-apagado'}>{equipe.nome}</span>
      {equipe.tipo === 'pronto' && equipe.posicaoCiclo !== null && <span className="text-apoio text-apagado">{`${equipe.posicaoCiclo}ª no ciclo`}</span>}
      {equipe.herdada && <span className="rounded bg-passa px-1.5 text-apoio text-apagado">{equipe.daCorporacao ? 'da corporação' : `de ${equipe.unidadeSigla}`}</span>}
      {!equipe.ativa && <span className="rounded bg-passa px-1.5 text-apoio text-apagado">desativada</span>}
      {podeMudar && !excluindo && (
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="discreto" aria-label={`Renomear ${equipe.nome}`} onClick={() => setEditando(true)}>Renomear</Button>
          {!equipe.ativa && <Button size="sm" variant="discreto" aria-label={`Reativar ${equipe.nome}`} onClick={aoReativar}>Reativar</Button>}
          {podeExcluir && <Button size="sm" variant="discreto" aria-label={`Excluir ${equipe.nome}`} onClick={() => setExcluindo(true)}>Excluir</Button>}
        </span>
      )}
      {podeMudar && excluindo && (
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <span className="text-corpo">{`Excluir ${equipe.nome}?`}</span>
          <Button size="sm" aria-label={`Confirmar a exclusão de ${equipe.nome}`} onClick={() => { setExcluindo(false); void aoExcluir(); }}>Excluir</Button>
          <Button size="sm" variant="discreto" onClick={() => setExcluindo(false)}>Cancelar</Button>
        </span>
      )}
    </li>
  );
}
