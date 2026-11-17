import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { consultaEu } from '@/api/eu';
import { authCliente } from '@/auth-cliente';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';

export const Route = createFileRoute('/entrar')({
  component: Entrar,
});

const ERRO_CREDENCIAIS = 'E-mail ou senha incorretos.';
const ERRO_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

function Entrar() {
  const navigate = useNavigate();
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
      // busca de novo: o cache pode guardar "sem sessão" da visita anterior
      await queryClient.fetchQuery({ ...consultaEu, staleTime: 0 });
      await navigate({ to: '/' });
    } catch {
      setErro(ERRO_REDE);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-xl bg-superficie shadow-[0_1px_2px_rgba(28,36,48,.08),0_8px_24px_rgba(28,36,48,.08)]">
        <div className="bg-vinho px-6 py-5 text-white">
          <h1 className="font-cond text-2xl font-semibold tracking-tight">Escalas 2º GB</h1>
          <p className="text-sm text-white/80">Corpo de Bombeiros Militar de Pernambuco</p>
        </div>
        <form onSubmit={enviar} className="grid gap-4 px-6 py-6" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-alerta">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={enviando} className="mt-1 h-10">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
