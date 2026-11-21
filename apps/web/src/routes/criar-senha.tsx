import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { NovaSenha } from 'contratos';
import { useState, type FormEvent } from 'react';
import { trocarSenha } from '@/api/acesso';
import { mensagemDe } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { Campo } from '@/componentes/Campo';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';

export const Route = createFileRoute('/criar-senha')({
  beforeLoad: async ({ context }) => {
    const eu = await context.queryClient.ensureQueryData(consultaEu);
    if (!eu) throw redirect({ to: '/entrar' });
    if (!eu.trocarSenha) throw redirect({ to: '/' });
  },
  component: CriarSenha,
});

const MSG_DIFERENTES = 'As duas senhas precisam ser iguais.';

/** Quem entrou com a senha provisória cria a própria senha antes de qualquer outra tela. */
function CriarSenha() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const nova = String(dados.get('nova'));
    const repita = String(dados.get('repita'));
    setErro(null);
    const lida = NovaSenha.safeParse({ novaSenha: nova });
    const erros: Record<string, string> = {};
    if (!lida.success) erros.nova = lida.error.issues[0]!.message;
    else if (nova !== repita) erros.repita = MSG_DIFERENTES;
    setCampos(erros);
    if (Object.keys(erros).length) return;
    setSalvando(true);
    try {
      await trocarSenha(nova);
      await queryClient.fetchQuery({ ...consultaEu, staleTime: 0 });
      await navigate({ to: '/' });
    } catch (err) {
      setErro(mensagemDe(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-fundo px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-superficie shadow-[0_1px_2px_rgba(28,36,48,.08),0_18px_40px_rgba(0,0,0,.18)]">
        <header className="bg-vinho px-6 py-[18px] text-white">
          <h1 className="font-cond text-2xl font-semibold">Crie a sua senha</h1>
          <p className="text-sm text-white/80">Crie a sua senha antes de continuar.</p>
        </header>
        <form onSubmit={enviar} className="grid gap-4 p-6" noValidate>
          <Campo id="nova" rotulo="Nova senha" erro={campos.nova}>
            <Input id="nova" name="nova" type="password" autoComplete="new-password" autoFocus />
          </Campo>
          <Campo id="repita" rotulo="Repita a nova senha" erro={campos.repita}>
            <Input id="repita" name="repita" type="password" autoComplete="new-password" />
          </Campo>
          <p className="text-sm text-apagado">Use pelo menos 10 caracteres.</p>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <Button type="submit" disabled={salvando}>Salvar senha</Button>
        </form>
      </div>
    </main>
  );
}
