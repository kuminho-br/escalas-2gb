import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NoDaEstrutura, UnidadeDeTrabalho } from 'contratos';
import { useState, type FormEvent } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { consultaEstrutura, criarDivisao, moverSecao, renomearDivisao } from '@/api/estrutura';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';

const AVISO_AO_MOVER = 'Mover a seção muda na hora quem tem acesso a ela.';

type Movimento = { secao: NoDaEstrutura; de: NoDaEstrutura | null; para: NoDaEstrutura | null };

/**
 * A estrutura do grupamento (entrega 6.10): as divisões, com as seções de dentro, e as seções sem divisão. O gestor do grupamento e o
 * administrador criam e renomeiam divisões e põem cada seção numa divisão (ou a tiram), pelo seletor "Divisão" da seção.
 */
export function Estrutura({ grupamentos, inicial }: { grupamentos: UnidadeDeTrabalho[]; inicial: string }) {
  const [grupamentoId, setGrupamentoId] = useState(inicial);
  const queryClient = useQueryClient();
  const { data: gb, error, isPending } = useQuery(consultaEstrutura(grupamentoId));
  // um formulário por vez: a divisão nova ou a que está sendo renomeada
  const [aberto, setAberto] = useState<'nova' | string | null>(null);
  const [movimento, setMovimento] = useState<Movimento | null>(null);

  const atualizar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['estrutura', grupamentoId] });
    // os caminhos das unidades mudam (o seletor de unidade e o que cada um alcança)
    void queryClient.invalidateQueries({ queryKey: ['eu'] });
  };

  const seletor = grupamentos.length > 1 && (
    <div className="mb-4 max-w-xs">
      <Campo id="estrutura-grupamento" rotulo="Grupamento">
        <Selecao id="estrutura-grupamento" value={grupamentoId} onChange={(e) => { setAberto(null); setGrupamentoId(e.target.value); }}>
          {grupamentos.map((g) => <option key={g.id} value={g.id}>{g.sigla}</option>)}
        </Selecao>
      </Campo>
    </div>
  );
  if (isPending) return <>{seletor}<p className="py-6 text-apagado">Carregando…</p></>;
  if (error) return <>{seletor}<p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p></>;

  const divisoes = gb.filhas.filter((f) => f.tipo === 'divisao');
  const semDivisao = gb.filhas.filter((f) => f.tipo === 'secao');
  const linhaDaSecao = (secao: NoDaEstrutura, divisao: NoDaEstrutura | null) => (
    <li key={secao.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pr-4 ${divisao ? 'pl-10' : 'pl-4'}`}>
      <span data-sigla className="w-20 shrink-0 font-cond font-semibold">{secao.sigla}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-apagado">{secao.nome}</span>
      <Selecao
        aria-label={`Divisão de ${secao.sigla}`}
        className="w-40"
        value={divisao?.id ?? ''}
        onChange={(e) => setMovimento({ secao, de: divisao, para: divisoes.find((d) => d.id === e.target.value) ?? null })}
      >
        <option value="">Sem divisão</option>
        {divisoes.map((d) => <option key={d.id} value={d.id}>{d.sigla}</option>)}
      </Selecao>
    </li>
  );

  return (
    <div className="max-w-2xl">
      {seletor}
      <div className="rounded-xl border border-linha bg-superficie">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-4 py-3">
          <p className="text-sm text-apagado">
            As divisões e as seções de <strong className="text-tinta">{gb.sigla}</strong>. Quem tem nível de acesso numa divisão alcança as seções de dentro dela.
          </p>
          {aberto === null && <Button size="sm" variant="outline" onClick={() => setAberto('nova')}>Nova divisão</Button>}
        </div>
        {aberto === 'nova' && (
          <FormularioDaDivisao
            rotuloDoBotao="Criar divisão"
            aoSalvar={(d) => criarDivisao(grupamentoId, d)}
            aoFechar={() => setAberto(null)}
            aoGravar={atualizar}
          />
        )}
        <ul aria-label={`Estrutura de ${gb.sigla}`} className="divide-y divide-linha">
          {divisoes.flatMap((d) => [
            aberto === d.id ? (
              <li key={d.id}>
                <FormularioDaDivisao
                  divisao={d}
                  rotuloDoBotao="Salvar"
                  aoSalvar={(dados) => renomearDivisao(d.id, dados)}
                  aoFechar={() => setAberto(null)}
                  aoGravar={atualizar}
                />
              </li>
            ) : (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-fundo/60 px-4 py-2.5">
                <span data-sigla className="w-20 shrink-0 font-cond font-semibold">{d.sigla}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{d.nome}</span>
                {d.filhas.length === 0 && <span className="text-xs text-apagado">Sem seções</span>}
                {aberto === null && <Button size="sm" variant="ghost" aria-label={`Renomear ${d.sigla}`} onClick={() => setAberto(d.id)}>Renomear</Button>}
              </li>
            ),
            ...d.filhas.map((s) => linhaDaSecao(s, d)),
          ])}
          {semDivisao.map((s) => linhaDaSecao(s, null))}
        </ul>
      </div>
      {movimento && (
        <ConfirmarMovimento
          movimento={movimento}
          aoFechar={() => setMovimento(null)}
          aoMover={async () => {
            const arvore = await moverSecao(movimento.secao.id, movimento.para?.id ?? null);
            queryClient.setQueryData(['estrutura', grupamentoId], arvore);
            void queryClient.invalidateQueries({ queryKey: ['eu'] });
          }}
        />
      )}
    </div>
  );
}

function FormularioDaDivisao({ divisao, rotuloDoBotao, aoSalvar, aoFechar, aoGravar }: {
  divisao?: NoDaEstrutura;
  rotuloDoBotao: string;
  aoSalvar: (d: { sigla: string; nome: string }) => Promise<unknown>;
  aoFechar: () => void;
  aoGravar: () => Promise<void>;
}) {
  const [sigla, setSigla] = useState(divisao?.sigla ?? '');
  const [nome, setNome] = useState(divisao?.nome ?? '');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const id = divisao?.id ?? 'nova';
  const salvar = travar(async () => {
    setCampos({});
    setErro(null);
    try {
      await aoSalvar({ sigla, nome });
      await aoGravar();
      aoFechar();
    } catch (e) {
      const doCampo = camposDe(e);
      setCampos(doCampo);
      if (!Object.keys(doCampo).length) setErro(mensagemDe(e));
    }
  });
  return (
    <div className="border-b border-linha px-4 py-3 last:border-b-0">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void salvar(); }} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <Campo id={`divisao-sigla-${id}`} rotulo="Sigla" erro={campos.sigla}>
          <Input id={`divisao-sigla-${id}`} value={sigla} onChange={(e) => setSigla(e.target.value)} maxLength={20} required autoFocus />
        </Campo>
        <Campo id={`divisao-nome-${id}`} rotulo="Nome" erro={campos.nome}>
          <Input id={`divisao-nome-${id}`} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required />
        </Campo>
        <span className="flex gap-1">
          <Button type="submit" size="sm" disabled={salvando}>{rotuloDoBotao}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>Cancelar</Button>
        </span>
      </form>
      {erro && <p role="alert" className="mt-2 text-sm text-alerta">{erro}</p>}
    </div>
  );
}

/** O aviso antes de gravar: o acesso à seção muda na hora. Só o "Mover" grava. */
function ConfirmarMovimento({ movimento, aoFechar, aoMover }: { movimento: Movimento; aoFechar: () => void; aoMover: () => Promise<void> }) {
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const { secao, de, para } = movimento;
  const mover = travar(async () => {
    setErro(null);
    try {
      await aoMover();
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{para ? `Mover ${secao.sigla} para ${para.sigla}?` : `Tirar ${secao.sigla} de ${de?.sigla ?? 'a divisão'}?`}</DialogTitle>
          <DialogDescription>{AVISO_AO_MOVER}</DialogDescription>
        </DialogHeader>
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button type="button" disabled={salvando} onClick={() => void mover()}>Mover</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
