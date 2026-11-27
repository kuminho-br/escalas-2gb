import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { saida } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { authCliente } from '@/auth-cliente';
import { MoldeDoAcesso } from '@/componentes/acesso/MoldeDoAcesso';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { aprovar, cenaPronta, cobrir, iniciar, recusar, useTransicao } from '@/lib/transicao-login/armazem';
import { entradaDaVez, lerQuando, lerUltimaInteira, pedeMenosMovimento } from '@/lib/transicao-login/regra';

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
  const senha = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  // a cena das mangueiras (docs/superpowers/specs/2026-11-20-transicao-login-design.md): a imagem é carregada quando o login abre
  const cena = useTransicao().fase !== 'parada';
  // a cada erro, o foco vai para a senha; num efeito, porque a tela só destrava (sai o `inert`) depois de desenhada de novo
  const [falhas, setFalhas] = useState(0);
  useEffect(() => {
    if (falhas) senha.current?.focus();
  }, [falhas]);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    setErro(null);
    setEnviando(true);
    // inteira (as mangueiras) pela escolha da pessoa neste navegador (o padrão: uma vez a cada 12 h), indo para a tela inicial; senão, a entrada curta
    const menosMovimento = pedeMenosMovimento();
    const inteira = entradaDaVez({ agora: Date.now(), ultimaInteira: lerUltimaInteira(), menosMovimento, cenaPronta: cenaPronta(), destinoEhOInicio: !voltar, quando: lerQuando() }) === 'inteira';
    if (inteira) iniciar(botao.current?.getBoundingClientRect());
    // no erro, as mangueiras recuam primeiro; só depois o cartão volta, com a mensagem e os campos como estavam, e o foco na senha
    const falhar = async (mensagem: string) => {
      if (inteira) await recusar();
      setErro(mensagem);
      setFalhas((n) => n + 1);
    };
    try {
      const { error } = await authCliente.signIn.email({
        email: String(dados.get('email')),
        password: String(dados.get('senha')),
      });
      if (error) {
        // 403: o servidor diz por que não entra (ex.: a senha provisória venceu); o resto é e-mail ou senha errados
        await falhar(!error.status || error.status >= 500 ? ERRO_REDE : error.status === 403 && error.message ? error.message : ERRO_CREDENCIAIS);
        return;
      }
      // um "Sair" anterior não cala o aviso de uma sessão que terminar daqui para a frente
      saida.marcar(false);
      // busca de novo: o cache pode guardar "sem sessão" da visita anterior
      await queryClient.fetchQuery({ ...consultaEu, staleTime: 0 });
      // com a cena, a tela inicial entra por baixo dela, depois que o escuro cobre a tela toda
      if (inteira) await cobrir();
      // depois de uma sessão que terminou, volta para a página em que a pessoa estava
      if (voltar) router.history.push(voltar);
      // na entrada curta, o login se desfaz sobre as boas-vindas (0,3 s, no estilo.css), se o navegador souber e o aparelho não pedir menos movimento
      else await navigate({ to: '/', viewTransition: !inteira && !menosMovimento });
      // a água só corre com a tela inicial já montada (até lá a cena espera na junta), para a câmera ter onde pousar
      if (inteira) aprovar();
    } catch {
      await falhar(ERRO_REDE);
    } finally {
      setEnviando(false);
    }
  }

  // o cenário e o cartão são os de `componentes/acesso/MoldeDoAcesso` (o mesmo das telas de primeiro acesso e esqueci minha senha)
  return (
    <MoldeDoAcesso
      titulo="Entrar"
      descricao="Use o e-mail cadastrado pela sua seção."
      marcaEhTitulo
      cena={cena}
      aviso={sessao === 'terminou' && <p role="alert" className="mt-2 text-sm font-medium text-alerta lg:text-white">Sua sessão terminou. Entre de novo.</p>}
    >
        <form onSubmit={enviar} className="grid gap-4 px-[22px] pt-5 pb-8 lg:p-6" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus className="h-[46px] lg:h-10" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <Input ref={senha} id="senha" name="senha" type="password" autoComplete="current-password" required className="h-[46px] lg:h-10" />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-alerta">
              {erro}
            </p>
          )}
          <Button ref={botao} type="submit" disabled={enviando} className="mt-1 h-[46px] lg:h-10">
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/esqueci-a-senha" className="text-sm text-vinho underline underline-offset-2">
              Esqueci minha senha
            </Link>
            <Link to="/primeiro-acesso" className="text-sm text-vinho underline underline-offset-2">
              Primeiro acesso
            </Link>
          </div>
        </form>
    </MoldeDoAcesso>
  );
}
