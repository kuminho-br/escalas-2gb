import { createFileRoute, redirect } from '@tanstack/react-router';
import { consultaEu } from '@/api/eu';
import { useSair } from '@/componentes/useSair';
import { Button } from '@/componentes/ui/button';
import { escolherUnidade, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';

export const Route = createFileRoute('/sem-lotacao')({
  beforeLoad: async ({ context }) => {
    const eu = await context.queryClient.ensureQueryData(consultaEu);
    if (!eu) throw redirect({ to: '/entrar' });
    if (escolherUnidade(eu, lerUnidadeGuardada())) throw redirect({ to: '/' });
  },
  component: SemLotacao,
});

/** Quem entrou mas não tem unidade (sem papel e sem lotação hoje): a orientação e o Sair. */
function SemLotacao() {
  const { sair, erroSair } = useSair();
  return (
    <main className="grid min-h-dvh place-items-center bg-fundo px-4 py-10">
      <div className="grid w-full max-w-md gap-4 rounded-xl bg-superficie p-6 shadow-[0_1px_2px_rgba(28,36,48,.08),0_18px_40px_rgba(0,0,0,.18)]">
        <h1 className="font-cond text-2xl font-semibold">Sem lotação</h1>
        <p>Sua lotação não está cadastrada. Procure o auxiliar administrativo da sua seção.</p>
        {erroSair && <p role="alert" className="text-sm text-alerta">{erroSair}</p>}
        <Button type="button" onClick={() => void sair()}>Sair</Button>
      </div>
    </main>
  );
}
