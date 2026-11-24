import { createFileRoute } from '@tanstack/react-router';
import { ehAdministrador, raizesDaEstrutura } from '@/api/eu';
import { Estrutura } from '@/componentes/configuracoes/Estrutura';
import { TiposDeUnidade } from '@/componentes/configuracoes/TiposDeUnidade';
import { PainelComMenu } from '@/componentes/PainelComMenu';
import { TabsContent } from '@/componentes/ui/tabs';

const ABAS = ['arvore', 'tipos-de-unidade'] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute('/_app/estrutura')({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({ aba: ABAS.find((a) => a === s.aba) }),
  component: EstruturaDoSistema,
});

/**
 * O módulo Estrutura (entrega 6.26): a árvore de unidades, editável por quem tem poder sobre ela (o administrador, tudo; o gestor, da sua unidade para
 * baixo; os demais só consultam), e o cadastro de tipos de unidade, só do administrador.
 */
function EstruturaDoSistema() {
  const { eu } = Route.useRouteContext();
  const admin = ehAdministrador(eu);
  const raizes = raizesDaEstrutura(eu);
  const secoes: { valor: Aba; nome: string }[] = [{ valor: 'arvore', nome: 'Árvore de unidades' }, ...(admin ? [{ valor: 'tipos-de-unidade' as const, nome: 'Tipos de unidade' }] : [])];
  const pedida = Route.useSearch().aba;
  const aba: Aba = secoes.find((x) => x.valor === pedida)?.valor ?? 'arvore';
  const navigate = Route.useNavigate();
  return (
    <section>
      <h1 className="font-cond text-titulo leading-tight font-semibold">Estrutura</h1>
      <PainelComMenu secoes={secoes} valor={aba} rotulo="Seção da estrutura" aoEscolher={(v) => void navigate({ search: { aba: ABAS.find((a) => a === v) }, replace: true })}>
        <TabsContent value="arvore">
          <Estrutura raizes={raizes} />
        </TabsContent>
        {admin && (
          <TabsContent value="tipos-de-unidade">
            <TiposDeUnidade />
          </TabsContent>
        )}
      </PainelComMenu>
    </section>
  );
}
