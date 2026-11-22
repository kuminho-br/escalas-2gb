import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Mes, somarMeses } from 'contratos';
import { ehGestorOuAdministrador } from '@/api/eu';
import { Tabs, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { mesAtual } from '@/lib/meses';

type Aba = 'escala' | 'saldo' | 'regras';
const ABAS: Aba[] = ['escala', 'saldo', 'regras'];

export const Route = createFileRoute('/_app/oficiais')({
  // o auxiliar não usa esta tela: volta ao início com o aviso, como nos outros módulos (a API confere o papel de qualquer jeito)
  beforeLoad: ({ context }) => {
    if (!ehGestorOuAdministrador(context.eu)) throw redirect({ to: '/', search: { aviso: 'outro-papel' } });
  },
  validateSearch: (s: Record<string, unknown>): { mes?: string; aba?: Aba } => ({
    mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined,
    aba: ABAS.find((a) => a === s.aba),
  }),
  component: Oficiais,
});

function Oficiais() {
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const mes = busca.mes ?? somarMeses(mesAtual(), 1);
  const aba = busca.aba ?? 'escala';
  void useQuery;
  void mes;
  return (
    <section className="grid gap-4">
      <div>
        <h1 className="font-cond text-[28px] leading-tight font-semibold">Escala dos oficiais</h1>
        <p className="text-sm text-apagado">Oficiais QOC e QOA.</p>
      </div>
      <Tabs value={aba} onValueChange={(v) => void navigate({ search: (s) => ({ ...s, aba: v as Aba }) })}>
        <TabsList>
          <TabsTrigger value="escala">Escala do mês</TabsTrigger>
          <TabsTrigger value="saldo">Painel de saldo</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
        </TabsList>
      </Tabs>
    </section>
  );
}
