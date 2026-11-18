import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mesPorExtenso, somarMeses, type ItemCatalogo, type Parametro } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo, consultaParametros, editarNoCatalogo, incluirNoCatalogo, salvarParametro, type Catalogo } from '@/api/configuracoes';
import { ehAdministrador, podeMudarParametro } from '@/api/eu';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Selecao } from '@/componentes/Selecao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/configuracoes')({
  component: Configuracoes,
});

function Configuracoes() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const admin = ehAdministrador(eu);
  const podeMudar = podeMudarParametro(eu);

  return (
    <section>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Configurações</h1>
        {podeMudar && <ImportarPlanilha cadastro="configuracoes" rotulo="as configurações" aoConcluir={() => queryClient.invalidateQueries({ queryKey: ['parametros'] })} />}
      </header>
      <Tabs defaultValue="regras" className="mt-6">
        <TabsList>
          <TabsTrigger value="regras">Regras do processo</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de afastamento</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
        </TabsList>
        <TabsContent value="regras">
          <RegrasDoProcesso unidadeId={eu.unidade.id} sigla={eu.unidade.sigla} podeMudar={podeMudar} />
        </TabsContent>
        <TabsContent value="tipos">
          <ListaDoCatalogo catalogo="tipos-afastamento" rotuloNovo="Novo tipo de afastamento" podeEditar={admin} />
        </TabsContent>
        <TabsContent value="atividades">
          <ListaDoCatalogo catalogo="atividades" rotuloNovo="Nova atividade" podeEditar={admin} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

const textoDoValor = (p: Parametro) => (typeof p.valor === 'boolean' ? (p.valor ? 'Sim' : 'Não') : String(p.valor));

function RegrasDoProcesso({ unidadeId, sigla, podeMudar }: { unidadeId: string; sigla: string; podeMudar: boolean }) {
  const mes = mesAtual();
  const { data, error, isPending } = useQuery(consultaParametros(unidadeId, mes));
  const [mudando, setMudando] = useState<Parametro | null>(null);

  if (isPending) return <p className="py-6 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;

  return (
    <div className="rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Valores em vigor em {mesPorExtenso(mes)} para {sigla}. Uma mudança vale a partir do mês escolhido, e os meses anteriores ficam como estavam.{podeMudar ? '' : ' Só o gestor ou o administrador muda.'}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Regra</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Norma de referência</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead className="sr-only">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.chave}>
              <TableCell className="whitespace-normal">
                <span className="font-medium">{p.rotulo}</span>
                {p.descricao && <span className="block max-w-[52ch] text-sm text-apagado">{p.descricao}</span>}
              </TableCell>
              <TableCell className="font-cond text-base">{textoDoValor(p)}</TableCell>
              <TableCell>{p.normaReferencia ?? <span className="text-apagado">—</span>}</TableCell>
              <TableCell className="text-sm">
                {p.origem === 'padrao' ? (
                  <span className="text-apagado">padrão do sistema</span>
                ) : (
                  <>
                    {mesPorExtenso(p.vigencia)}
                    {p.origem === 'herdada' && <span className="block text-apagado">vem do {p.unidadeSigla}</span>}
                  </>
                )}
              </TableCell>
              <TableCell className="text-right">
                {podeMudar && (
                  <Button variant="outline" size="sm" onClick={() => setMudando(p)}>
                    Mudar a partir de…
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {mudando && <MudarParametro unidadeId={unidadeId} parametro={mudando} aoFechar={() => setMudando(null)} />}
    </div>
  );
}

function MudarParametro({ unidadeId, parametro, aoFechar }: { unidadeId: string; parametro: Parametro; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(textoDoValor(parametro));
  const [vigencia, setVigencia] = useState(somarMeses(mesAtual(), 1));
  const [norma, setNorma] = useState(parametro.normaReferencia ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await salvarParametro(unidadeId, { chave: parametro.chave, valor, vigencia, normaReferencia: norma.trim() || undefined });
      await queryClient.invalidateQueries({ queryKey: ['parametros'] });
      aoFechar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parametro.rotulo}</DialogTitle>
          <DialogDescription>O valor atual continua valendo até o mês anterior ao escolhido.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="param-valor">Novo valor</Label>
            {parametro.tipo === 'simnao' ? (
              <Selecao id="param-valor" value={valor} onChange={(e) => setValor(e.target.value)}>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </Selecao>
            ) : (
              <Input
                id="param-valor"
                type={parametro.tipo === 'inteiro' || parametro.tipo === 'decimal' ? 'number' : 'text'}
                step={parametro.tipo === 'inteiro' ? 1 : parametro.tipo === 'decimal' ? 'any' : undefined}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="param-mes">A partir de</Label>
            <Input id="param-mes" type="month" value={vigencia} min={mesAtual()} onChange={(e) => setVigencia(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="param-norma">Norma de referência</Label>
            <Input id="param-norma" value={norma} placeholder="Ex.: Portaria 12/2026" onChange={(e) => setNorma(e.target.value)} />
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando || !vigencia}>
              Salvar a partir de {vigencia ? mesPorExtenso(vigencia) : '…'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListaDoCatalogo({ catalogo, rotuloNovo, podeEditar }: { catalogo: Catalogo; rotuloNovo: string; podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(consultaCatalogo(catalogo));
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: ['catalogo', catalogo] });
      return true;
    } catch (e) {
      setErro(mensagemDe(e));
      return false;
    }
  }

  async function incluir(e: FormEvent) {
    e.preventDefault();
    if (await executar(() => incluirNoCatalogo(catalogo, novo))) setNovo('');
  }

  if (isPending) return <p className="py-6 text-apagado">Carregando…</p>;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;

  return (
    <div className="max-w-xl rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Lista do sistema todo. {podeEditar ? 'Desativar tira da lista de escolha, mas mantém nos registros antigos.' : 'Só o administrador altera.'}
      </p>
      <ul className="divide-y divide-linha">
        {data.map((item) => (
          <ItemDoCatalogo key={item.id} item={item} podeEditar={podeEditar} aoSalvar={(dados) => executar(() => editarNoCatalogo(catalogo, item.id, dados))} />
        ))}
      </ul>
      {podeEditar && (
        <form onSubmit={incluir} className="flex items-end gap-2 border-t border-linha px-4 py-3">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor={`novo-${catalogo}`}>{rotuloNovo}</Label>
            <Input id={`novo-${catalogo}`} value={novo} onChange={(e) => setNovo(e.target.value)} />
          </div>
          <Button type="submit" disabled={!novo.trim()}>
            Incluir
          </Button>
        </form>
      )}
      {erro && <p role="alert" className="px-4 pb-3 text-sm text-alerta">{erro}</p>}
    </div>
  );
}

function ItemDoCatalogo({ item, podeEditar, aoSalvar }: { item: ItemCatalogo; podeEditar: boolean; aoSalvar: (d: { nome?: string; ativo?: boolean }) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(item.nome);

  async function renomear(e: FormEvent) {
    e.preventDefault();
    if (await aoSalvar({ nome })) setEditando(false);
  }

  if (editando) {
    return (
      <li className="px-4 py-2">
        <form onSubmit={renomear} className="flex items-center gap-2">
          <Input aria-label={`Novo nome de ${item.nome}`} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          <Button type="submit" size="sm">Salvar</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className={item.ativo ? '' : 'text-apagado'}>{item.nome}</span>
      {!item.ativo && <span className="rounded bg-muted px-1.5 text-xs text-apagado">desativado</span>}
      {podeEditar && (
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>Renomear</Button>
          <Button size="sm" variant="ghost" onClick={() => void aoSalvar({ ativo: !item.ativo })}>
            {item.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        </span>
      )}
    </li>
  );
}
