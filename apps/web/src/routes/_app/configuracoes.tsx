import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { ItemCatalogo } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo, editarNoCatalogo, incluirNoCatalogo, type Catalogo } from '@/api/configuracoes';
import { ehAdministrador, ehGestorOuAdministrador, ehMilitarComum } from '@/api/eu';
import { AnimacaoDeEntrada } from '@/componentes/configuracoes/AnimacaoDeEntrada';
import { EquipesDaUnidade } from '@/componentes/configuracoes/EquipesDaUnidade';
import { FuncoesDoMilitar } from '@/componentes/configuracoes/FuncoesDoMilitar';
import { Postos } from '@/componentes/configuracoes/Postos';
import { QuemVeOQue } from '@/componentes/configuracoes/QuemVeOQue';
import { SituacoesDoMilitar } from '@/componentes/configuracoes/SituacoesDoMilitar';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { PainelComMenu } from '@/componentes/PainelComMenu';
import { TabsContent } from '@/componentes/ui/tabs';
import { ABAS_DA_ESCALA, type AbaDaEscala } from '@/lib/configuracoes';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';

const ABAS = ['preferencias', 'postos', 'funcoes', 'situacoes', 'tipos', 'equipes', 'quem-ve-o-que'] as const;
/** As seções que saíram daqui para o módulo Estrutura: o endereço antigo leva a elas. */
const DA_ESTRUTURA = { estrutura: 'arvore', 'tipos-de-unidade': 'tipos-de-unidade' } as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute('/_app/configuracoes')({
  // as abas da escala só passam pela validação para o beforeLoad levar o endereço antigo (/configuracoes?aba=regras…) ao lugar novo
  // as abas da escala e as da estrutura só passam pela validação para o beforeLoad levar o endereço antigo (/configuracoes?aba=regras…) ao lugar novo
  validateSearch: (s: Record<string, unknown>): { aba?: Aba | AbaDaEscala | keyof typeof DA_ESTRUTURA } => ({ aba: [...ABAS, ...ABAS_DA_ESCALA, ...Object.keys(DA_ESTRUTURA)].find((a) => a === s.aba) as never }),
  beforeLoad: ({ search }) => {
    const daEscala = ABAS_DA_ESCALA.find((a) => a === search.aba);
    if (daEscala) throw redirect({ to: '/configuracoes-da-escala', search: { aba: daEscala }, replace: true });
    const daEstrutura = search.aba && search.aba in DA_ESTRUTURA ? DA_ESTRUTURA[search.aba as keyof typeof DA_ESTRUTURA] : undefined;
    if (daEstrutura) throw redirect({ to: '/estrutura', search: { aba: daEstrutura }, replace: true });
  },
  component: Configuracoes,
});

/**
 * O painel das configurações gerais (entrega 6.26), aberto pelo cartão da tela inicial. Cada seção só aparece para quem a vê: o militar comum
 * muda só as próprias preferências; quem tem nível de acesso vê a Estrutura e os catálogos (o administrador os altera); o administrador também
 * cuida dos tipos de unidade e de "Quem vê o quê". As configurações da escala ficam no módulo de escalas.
 */
function Configuracoes() {
  const { eu } = Route.useRouteContext();
  const admin = ehAdministrador(eu);
  const comNivel = !ehMilitarComum(eu);
  // as seções que esta pessoa vê; o endereço de uma que ela não vê abre as preferências
  const secoes: { valor: Aba; nome: string }[] = [
    { valor: 'preferencias', nome: 'Minhas preferências' },
    ...(comNivel ? [
      { valor: 'postos' as const, nome: 'Postos e graduações' }, { valor: 'funcoes' as const, nome: 'Funções do militar' },
      { valor: 'situacoes' as const, nome: 'Situações do militar' }, { valor: 'tipos' as const, nome: 'Tipos de afastamento' }, { valor: 'equipes' as const, nome: 'Equipes' },
    ] : []),
    ...(admin ? [{ valor: 'quem-ve-o-que' as const, nome: 'Quem vê o quê' }] : []),
  ];
  const pedida = Route.useSearch().aba;
  const aba: Aba = secoes.find((x) => x.valor === pedida)?.valor ?? 'preferencias';
  const navigate = Route.useNavigate();

  return (
    <Moldura titulo="Configurações">
      <PainelComMenu secoes={secoes} valor={aba} rotulo="Seção das configurações" aoEscolher={(v) => void navigate({ search: { aba: ABAS.find((a) => a === v) }, replace: true })}>
        <TabsContent value="preferencias">
          <AnimacaoDeEntrada />
        </TabsContent>
        {comNivel && (
          <TabsContent value="postos">
            <Postos podeEditar={admin} />
          </TabsContent>
        )}
        {comNivel && (
          <TabsContent value="funcoes">
            <FuncoesDoMilitar podeEditar={admin} />
          </TabsContent>
        )}
        {comNivel && (
          <TabsContent value="situacoes">
            <SituacoesDoMilitar podeEditar={admin} />
          </TabsContent>
        )}
        {comNivel && (
          <TabsContent value="tipos">
            <ListaDoCatalogo catalogo="tipos-afastamento" rotuloNovo="Novo tipo de afastamento" podeEditar={admin} />
          </TabsContent>
        )}
        {comNivel && (
          <TabsContent value="equipes">
            <EquipesDaUnidade unidadeId={eu.unidade.id} podeGerir={ehGestorOuAdministrador(eu)} admin={admin} />
          </TabsContent>
        )}
        {admin && (
          <TabsContent value="quem-ve-o-que">
            <QuemVeOQue />
          </TabsContent>
        )}
      </PainelComMenu>
    </Moldura>
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

  if (isPending) return <Espera className="py-6" />;
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
          <Button type="button" size="sm" variant="discreto" onClick={() => setEditando(false)}>Cancelar</Button>
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
          <Button size="sm" variant="discreto" onClick={() => setEditando(true)}>Renomear</Button>
          <Button size="sm" variant="discreto" onClick={() => void aoSalvar({ ativo: !item.ativo })}>
            {item.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        </span>
      )}
    </li>
  );
}
