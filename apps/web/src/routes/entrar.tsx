import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { saida } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { authCliente } from '@/auth-cliente';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { aprovar, cenaPronta, cobrir, iniciar, preparar, recusar, useTransicao } from '@/lib/transicao-login/armazem';
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

/** No clique, com a cena: o cartão, o brasão e o título crescem um pouco, desfocam e somem (0,28 s); no erro, voltam. */
const DESFAZ = 'transition-[opacity,transform,filter] duration-300 in-data-[cena=tocando]:pointer-events-none in-data-[cena=tocando]:scale-105 in-data-[cena=tocando]:opacity-0 in-data-[cena=tocando]:blur-[7px]';

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
  useEffect(() => preparar(), []);
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

  // o mockup aprovado (docs/telas/login-e-inicio/mockup.html): no computador, a foto do quartel ao fundo coberta de vinho à esquerda, a
  // marca à esquerda e o cartão à direita; no celular, a foto em cima com a marca e o cartão subindo sobre ela
  return (
    <main data-cena={cena ? 'tocando' : undefined} className="relative flex min-h-dvh flex-col bg-superficie lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-10 lg:bg-fundo lg:px-[clamp(24px,5vw,64px)] lg:py-12">
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

      <div className={`${DESFAZ} relative z-10 flex h-[380px] flex-none flex-col justify-end gap-2.5 px-[22px] pb-11 text-white lg:h-auto lg:max-w-[600px] lg:justify-center lg:gap-[18px] lg:p-0`}>
        <img src="/brasao-2gb.png" alt="Brasão do 2º GB" className="w-[84px] drop-shadow-[0_4px_14px_rgba(0,0,0,.35)] lg:w-[132px]" />
        <h1 className="font-cond text-[32px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-5xl">
          Sistema de Gestão <span className="whitespace-nowrap">- 2º GB</span>
        </h1>
        <p className="text-[15px] text-white/85 lg:text-lg">2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco</p>
      </div>

      <div className={`${DESFAZ} relative z-10 -mt-[22px] flex-1 rounded-t-[22px] bg-superficie lg:mt-0 lg:flex-none lg:overflow-hidden lg:rounded-xl lg:shadow-[0_1px_2px_rgba(28,36,48,.08),0_18px_40px_rgba(0,0,0,.28)]`}>
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
      </div>
    </main>
  );
}
