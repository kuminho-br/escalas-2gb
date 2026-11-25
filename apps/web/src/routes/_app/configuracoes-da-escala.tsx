import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { mesPorExtenso, somarMeses, type Parametro } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { atualizarEscalas, consultaEscalas, marcarBlocosDoVoluntariado } from '@/api/escalas';
import { consultaParametros, salvarParametro } from '@/api/configuracoes';
import { ehGestorNaUnidade, podeMudarParametro } from '@/api/eu';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { ColetaDoVoluntariado } from '@/componentes/configuracoes/ColetaDoVoluntariado';
import { MetaDeAtivacao } from '@/componentes/configuracoes/MetaDeAtivacao';
import { MilitaresDeOutrasUnidades } from '@/componentes/configuracoes/MilitaresDeOutrasUnidades';
import { ImportarPlanilha } from '@/componentes/ImportarPlanilha';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Selecao } from '@/componentes/Selecao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table';
import { PainelComMenu } from '@/componentes/PainelComMenu';
import { TabsContent } from '@/componentes/ui/tabs';
import { AcoesDosModelos, ListaDeModelos } from '@/componentes/guarnicoes/ListaDeModelos';
import { ABAS_DA_ESCALA, type AbaDaEscala as Aba } from '@/lib/configuracoes';
import { mesAtual } from '@/lib/meses';
import { Checkbox } from '@/componentes/ui/checkbox';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';


export const Route = createFileRoute('/_app/configuracoes-da-escala')({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({ aba: ABAS_DA_ESCALA.find((a) => a === s.aba) }),
  component: ConfiguracoesDaEscala,
});

function ConfiguracoesDaEscala() {
  const { eu } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const podeMudar = podeMudarParametro(eu);
  const aba = Route.useSearch().aba ?? 'regras';
  const navigate = Route.useNavigate();

  return (
    <Moldura
      titulo="Configurações da escala"
      acaoPrincipal={
        <>
          {podeMudar && <ImportarPlanilha cadastro="configuracoes" rotulo="as configurações" aoConcluir={() => queryClient.invalidateQueries({ queryKey: ['parametros'] })} />}
        </>
      }
    >
      <PainelComMenu
        secoes={[{ valor: 'regras', nome: 'Regras do processo' }, { valor: 'voluntariado', nome: 'Voluntariado' }, { valor: 'modelos', nome: 'Modelos de guarnição' }, { valor: 'meta', nome: 'Meta de ativação' }]}
        valor={aba}
        rotulo="Seção das configurações da escala"
        aoEscolher={(v) => void navigate({ search: { aba: ABAS_DA_ESCALA.find((a) => a === v) }, replace: true })}
      >
        <TabsContent value="regras">
          <RegrasDoProcesso unidadeId={eu.unidade.id} sigla={eu.unidade.sigla} podeMudar={podeMudar} />
        </TabsContent>
        <TabsContent value="voluntariado">
          {/* a coleta é do gestor NA unidade de trabalho (ou de uma acima dela): gestor só em outra unidade vê o estado e não muda */}
          <ColetaDoVoluntariado unidadeId={eu.unidade.id} podeMudar={ehGestorNaUnidade(eu)} />
          <BlocosDoVoluntariado unidadeId={eu.unidade.id} podeMudar={podeMudar} />
          <MilitaresDeOutrasUnidades unidadeId={eu.unidade.id} sigla={eu.unidade.sigla} podeMudar={podeMudar} />
        </TabsContent>
        <TabsContent value="modelos">
          <div className="mt-4 grid max-w-xl gap-3">
            <div className="flex flex-wrap justify-end gap-2">
              <AcoesDosModelos unidadeId={eu.unidade.id} />
            </div>
            <div className="flex flex-col overflow-hidden rounded-xl border border-linha bg-superficie">
              <ListaDeModelos unidadeId={eu.unidade.id} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="meta">
          <div className="mt-4">
            <MetaDeAtivacao unidadeId={eu.unidade.id} podeMudar={podeMudar} />
          </div>
        </TabsContent>
      </PainelComMenu>
    </Moldura>
  );
}

/** Quais escalas montam os blocos do dia no voluntariado: cada interruptor grava na hora. */
function BlocosDoVoluntariado({ unidadeId, podeMudar }: { unidadeId: string; podeMudar: boolean }) {
  const queryClient = useQueryClient();
  const { data, error, isPending } = useQuery(consultaEscalas(unidadeId));
  const { salvando, travar } = useTrava();
  const [erroAoMudar, setErroAoMudar] = useState<string | null>(null);
  const mudar = travar(async (id: string, montaBlocos: boolean) => {
    setErroAoMudar(null);
    try {
      await marcarBlocosDoVoluntariado(id, montaBlocos);
      atualizarEscalas(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['voluntariado'] });
      void queryClient.invalidateQueries({ queryKey: ['voluntariado-militar'] });
    } catch (e) {
      setErroAoMudar(mensagemDe(e));
    }
  });

  if (isPending) return <Espera className="py-6" />;
  if (error) return <p role="alert" className="py-6 text-alerta">{mensagemDe(error)}</p>;
  const ativas = data.filter((e) => e.ativa && e.distribuicao === 'pre_escala');

  return (
    <div className="rounded-xl border border-linha bg-superficie">
      <p className="border-b border-linha px-4 py-3 text-sm text-apagado">
        Os blocos do dia no voluntariado vêm dos horários dos serviços de PJES e diária das escalas marcadas aqui. Tire a marca de uma escala para os horários dela deixarem de cortar o dia.
        A flexibilidade do voluntariado fica em “Regras do processo”.{podeMudar ? '' : ' Só o gestor ou o administrador muda.'}
      </p>
      {ativas.length === 0 && <p className="px-4 py-6 text-apagado">Nenhuma escala ativa nesta seção.</p>}
      <ul className="divide-y divide-linha">
        {ativas.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="font-medium">{e.nome}</span>
              <span className="block text-sm text-apagado">{e.servicos.join(', ') || 'sem serviços'}</span>
            </span>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <Checkbox
                aria-label={`${e.nome}: entra nos blocos do voluntariado`}
                checked={e.montaBlocosVoluntariado}
                disabled={!podeMudar || salvando}
                onChange={(ev) => void mudar(e.id, ev.target.checked)}
              />
              Entra nos blocos
            </label>
          </li>
        ))}
      </ul>
      {erroAoMudar && <p role="alert" className="border-t border-linha px-4 py-3 text-sm text-alerta">{erroAoMudar}</p>}
    </div>
  );
}

const textoDoValor = (p: Parametro) => (typeof p.valor === 'boolean' ? (p.valor ? 'Sim' : 'Não') : String(p.valor));

function RegrasDoProcesso({ unidadeId, sigla, podeMudar }: { unidadeId: string; sigla: string; podeMudar: boolean }) {
  const mes = mesAtual();
  const { data, error, isPending } = useQuery(consultaParametros(unidadeId, mes));
  const [mudando, setMudando] = useState<Parametro | null>(null);

  if (isPending) return <Espera className="py-6" />;
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
                  <Button variant="secundario" size="sm" onClick={() => setMudando(p)}>
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
