import { useEffect, useRef } from 'react';
import { MARCA_DA_FAIXA, registrarPintor, useTransicao, type QuadroDaCamada } from '@/lib/transicao-login/armazem';
import { desenhar } from '@/lib/transicao-login/cena';

/** A densidade de pixels do `canvas` é limitada a 2, para o celular fraco. */
const DENSIDADE_MAXIMA = 2;

/**
 * A camada da transição do login (as mangueiras): um `canvas` fixo por cima das telas, montado fora das rotas para continuar enquanto o site
 * troca /entrar por /. Fica fora da leitura de tela e nunca recebe cliques; "Entrando…" é um aviso lido.
 */
export function TransicaoDoLogin() {
  const { fase, entrando } = useTransicao();
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    function pintar(q: QuadroDaCamada) {
      const canvas = tela.current;
      if (!canvas) return;
      if (!q) {
        canvas.hidden = true;
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      const largura = window.innerWidth;
      const altura = window.innerHeight;
      const densidade = Math.min(window.devicePixelRatio || 1, DENSIDADE_MAXIMA);
      const cw = Math.round(largura * densidade);
      const ch = Math.round(altura * densidade);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx || !largura || !altura) return;
      canvas.hidden = false;
      canvas.style.opacity = String(q.some);
      const faixa = document.querySelector(`[${MARCA_DA_FAIXA}]`)?.getBoundingClientRect() ?? null;
      desenhar(ctx, { t: q.t, resposta: q.resposta, largura, altura, faixa, imagem: q.imagem, botao: q.botao });
    }
    registrarPintor(pintar);
    return () => registrarPintor(null);
  }, []);

  return (
    <>
      <canvas ref={tela} aria-hidden hidden className="pointer-events-none fixed inset-0 z-[100] block h-dvh w-screen" />
      {/* o aviso só existe durante a cena: nasce vazio no clique e ganha o texto se o servidor demorar, para o leitor de tela anunciar */}
      {fase !== 'parada' && (
        <p
          role="status"
          className={`pointer-events-none fixed inset-x-0 bottom-[11%] z-[101] m-0 text-center font-cond text-xl font-semibold tracking-wide text-white transition-opacity duration-300 [text-shadow:0_0_14px_rgba(255,170,80,.75)] ${entrando ? 'opacity-100' : 'opacity-0'}`}
        >
          {entrando ? 'Entrando…' : ''}
        </p>
      )}
    </>
  );
}
