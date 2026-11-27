import { useEffect, type ReactNode } from 'react';
import { preparar } from '@/lib/transicao-login/armazem';

/** No clique de "Entrar", com a cena: a marca e o cartão crescem um pouco, desfocam e somem (0,28 s); no erro, voltam. */
const DESFAZ = 'transition-[opacity,transform,filter] duration-300 in-data-[cena=tocando]:pointer-events-none in-data-[cena=tocando]:scale-105 in-data-[cena=tocando]:opacity-0 in-data-[cena=tocando]:blur-[7px]';

/**
 * O cenário do login e o cartão, o mesmo no login (`routes/entrar.tsx`) e nas telas de primeiro acesso e esqueci minha senha (6.67; o desenho está no `estilo.css`, em
 * `.cenario-login`): a foto do quartel com um enquadramento por plataforma, a marca e o cartão. `marcaEhTitulo` (o login): o nome do sistema é o título da página e o
 * cartão leva o segundo nível; nas outras telas o título da página é o do cartão. `cena`: a animação das mangueiras está tocando (o cartão e a marca se desfazem).
 * `aviso` entra no cabeçalho do cartão.
 */
export function MoldeDoAcesso({ titulo, descricao, aviso, marcaEhTitulo = false, cena = false, children }: { titulo: string; descricao: string; aviso?: ReactNode; marcaEhTitulo?: boolean; cena?: boolean; children: ReactNode }) {
  // a imagem da cena é carregada quando a tela abre: quem chega pelo link do login e entra logo depois já a tem
  useEffect(() => preparar(), []);
  const Nome = marcaEhTitulo ? 'h1' : 'p';
  const Titulo = marcaEhTitulo ? 'h2' : 'h1';
  return (
    <main data-cena={cena ? 'tocando' : undefined} className="cenario-login">
      <figure className="cenario-login__fundo">
        <img src="/quartel.jpg" alt="" />
      </figure>

      <div className={`${DESFAZ} cenario-login__marca`}>
        <img src="/brasao-2gb.png" alt="Brasão do 2º GB" />
        <Nome className="nome">
          Sistema de Gestão <span className="whitespace-nowrap">- 2º GB</span>
        </Nome>
        <p className="linha">2º Grupamento de Bombeiros · Corpo de Bombeiros Militar de Pernambuco</p>
      </div>

      <div className={`${DESFAZ} cenario-login__cartao`}>
        <header className="px-5.5 pt-6 lg:bg-vinho lg:px-6 lg:py-4.5 lg:text-white">
          <Titulo className="font-cond text-2xl font-semibold">{titulo}</Titulo>
          <p className="text-sm text-apagado lg:text-white/80">{descricao}</p>
          {aviso}
        </header>
        {children}
      </div>
    </main>
  );
}
