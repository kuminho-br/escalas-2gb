import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { saida } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { authCliente } from '@/auth-cliente';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

/** Só caminho interno do próprio site (começa com uma barra, não com duas nem com barra e contrabarra): nada que mande a pessoa para fora. */
const caminhoInterno = (v: string) => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') && !/[\u0000-\u001f]/.test(v);

export const Route = createFileRoute('/entrar')({
  validateSearch: (s: Record<string, unknown>): { sessao?: 'terminou'; voltar?: string } => ({
    sessao: s.sessao === 'terminou' ? 'terminou' : undefined,
    voltar: typeof s.voltar === 'string' && caminhoInterno(s.voltar) ? s.voltar : undefined,
  }),
  component: Entrar,
});

const ERRO_CREDENCIAIS = 'E-mail ou senha incorretos.';
const ERRO_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

function Entrar() {
  const navigate = useNavigate();
  const router = useRouter();
  const { sessao, voltar } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await authCliente.signIn.email({
        email: String(dados.get('email')),
        password: String(dados.get('senha')),
      });
      if (error) {
        setErro(!error.status || error.status >= 500 ? ERRO_REDE : ERRO_CREDENCIAIS);
        return;
      }
      // um "Sair" anterior não cala o aviso de uma sessão que terminar daqui para a frente
      saida.marcar(false);
      // busca de novo: o cache pode guardar "sem sessão" da visita anterior
      await queryClient.fetchQuery({ ...consultaEu, staleTime: 0 });
      // depois de uma sessão que terminou, volta para a página em que a pessoa estava
      if (voltar) router.history.push(voltar);
      else await navigate({ to: '/' });
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setEnviando(false);
    }
  }

  // o mockup aprovado (docs/telas/login-e-inicio/mockup.html): no computador, a foto do quartel ao fundo coberta de vinho à esquerda, a
  // marca à esquerda e o cartão à direita; no celular, a foto em cima com a marca e o cartão subindo sobre ela
  return (
    <main className="relative flex min-h-dvh flex-col bg-superficie lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-10 lg:bg-fundo lg:px-[clamp(24px,5vw,64px)] lg:py-12">
      <figure className="absolute inset-x-0 top-0 m-0 h-[380px] overflow-hidden bg-[#3a2626] lg:inset-0 lg:h-auto">
        <img src="/quartel.png" alt="" className="size-full object-cover object-[center_30%]" />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(111,20,20,.55)_0%,rgba(111,20,20,.35)_35%,rgba(111,20,20,.92)_100%)] lg:bg-[linear-gradient(90deg,rgba(111,20,20,.92)_0%,rgba(111,20,20,.70)_42%,rgba(28,36,48,.25)_100%)]"
        />
        <figcaption className="absolute top-3 right-2 rounded bg-[rgba(28,36,48,.62)] px-1.5 py-0.5 text-[11.5px] leading-tight text-white lg:top-auto lg:bottom-2">
          Quartel do 2º GB
        </figcaption>
      </figure>

      <div className="relative z-10 flex h-[380px] flex-none flex-col justify-end gap-2.5 px-[22px] pb-11 text-white lg:h-auto lg:max-w-[600px] lg:justify-center lg:gap-[18px] lg:p-0">
        <img src="/brasao-2gb.png" alt="Brasão do 2º GB" className="w-[84px] drop-shadow-[0_4px_14px_rgba(0,0,0,.35)] lg:w-[132px]" />
        <h1 className="font-cond text-[32px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-5xl">
          Sistema de Gestão <span className="whitespace-nowrap">- 2º GB</span>
        </h1>
        <p className="text-[15px] text-white/85 lg:text-lg">2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco</p>
      </div>

      <div className="relative z-10 -mt-[22px] flex-1 rounded-t-[22px] bg-superficie lg:mt-0 lg:flex-none lg:overflow-hidden lg:rounded-xl lg:shadow-[0_1px_2px_rgba(28,36,48,.08),0_18px_40px_rgba(0,0,0,.28)]">
        <header className="px-[22px] pt-6 lg:bg-vinho lg:px-6 lg:py-[18px] lg:text-white">
          <h2 className="font-cond text-2xl font-semibold">Entrar</h2>
          <p className="text-sm text-apagado lg:text-white/80">Use o e-mail cadastrado pela sua seção.</p>
          {sessao === 'terminou' && <p role="alert" className="mt-2 text-sm font-medium text-alerta lg:text-white">Sua sessão terminou. Entre de novo.</p>}
        </header>
        <form onSubmit={enviar} className="grid gap-4 px-[22px] pt-5 pb-8 lg:p-6" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus className="h-[46px] lg:h-10" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" name="senha" type="password" autoComplete="current-password" required className="h-[46px] lg:h-10" />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-alerta">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={enviando} className="mt-1 h-[46px] lg:h-10">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
