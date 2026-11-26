import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { preparar } from '@/lib/transicao-login/armazem';

/**
 * O cenário e o cartão do login para as telas de acesso sem sessão (primeiro acesso, esqueci minha senha): no computador, a foto do quartel ao fundo coberta de vinho à
 * esquerda, a marca à esquerda e o cartão à direita; no celular, a foto em cima com a marca e o cartão subindo sobre ela. É o mesmo desenho de `routes/entrar.tsx`
 * (docs/telas/login-e-inicio/mockup.html), sem a cena das mangueiras, que é só da entrada pelo botão "Entrar".
 */
export function MoldeDoAcesso({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  // a imagem da cena é carregada quando o login abre: aqui também, para quem chega pelo link do login e entra logo depois
  useEffect(() => preparar(), []);
  return (
    <main className="relative flex min-h-dvh flex-col bg-superficie lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-10 lg:bg-fundo lg:px-[clamp(24px,5vw,64px)] lg:py-12">
      <figure className="absolute inset-x-0 top-0 m-0 h-[380px] overflow-hidden bg-[#3a2626] lg:inset-0 lg:h-auto">
        <img src="/quartel.png" alt="" className="size-full object-cover object-[center_30%]" />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(111,20,20,.55)_0%,rgba(111,20,20,.35)_35%,rgba(111,20,20,.92)_100%)] lg:bg-[linear-gradient(90deg,rgba(111,20,20,.92)_0%,rgba(111,20,20,.70)_42%,rgba(28,36,48,.25)_100%)]"
        />
        <figcaption className="absolute top-3 right-2 rounded bg-[rgba(28,36,48,.62)] px-1.5 py-0.5 text-[11.5px] leading-tight text-white lg:top-auto lg:bottom-2">Quartel do 2º GB</figcaption>
      </figure>

      <div className="relative z-10 flex h-[380px] flex-none flex-col justify-end gap-2.5 px-[22px] pb-11 text-white lg:h-auto lg:max-w-[600px] lg:justify-center lg:gap-[18px] lg:p-0">
        <img src="/brasao-2gb.png" alt="Brasão do 2º GB" className="w-[84px] drop-shadow-[0_4px_14px_rgba(0,0,0,.35)] lg:w-[132px]" />
        <p className="font-cond text-[32px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-5xl">
          Sistema de Gestão <span className="whitespace-nowrap">- 2º GB</span>
        </p>
        <p className="text-[15px] text-white/85 lg:text-lg">2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco</p>
      </div>

      <div className="relative z-10 -mt-[22px] flex-1 rounded-t-[22px] bg-superficie lg:mt-0 lg:flex-none lg:overflow-hidden lg:rounded-xl lg:shadow-[0_1px_2px_rgba(28,36,48,.08),0_18px_40px_rgba(0,0,0,.28)]">
        <header className="px-[22px] pt-6 lg:bg-vinho lg:px-6 lg:py-[18px] lg:text-white">
          <h1 className="font-cond text-2xl font-semibold">{titulo}</h1>
          <p className="text-sm text-apagado lg:text-white/80">{descricao}</p>
        </header>
        {children}
      </div>
    </main>
  );
}
