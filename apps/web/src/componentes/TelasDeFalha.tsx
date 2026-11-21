import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { ErroApi } from '@/api/cliente';
import { Button } from '@/componentes/ui/button';

/**
 * O conselho de cada falha: o que o servidor disse (503: banco desatualizado) vale mais; sem conexão, conferir a internet; qualquer outro
 * erro é do sistema, e repetir em alguns minutos é o que a pessoa pode fazer.
 */
function conselhoDaFalha(error: unknown): string {
  if (error instanceof ErroApi && error.status === 503) return error.message;
  if (error instanceof ErroApi && error.status === 0) return 'Sem conexão com o sistema. Confira a internet e tente de novo.';
  return 'O sistema encontrou um erro. Tente de novo em alguns minutos.';
}

/** Falha ao abrir uma tela (sessão, rede, resposta fora do esperado): em português, com a saída à mão e o foco no título. */
export function ErroAoAbrir({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const titulo = useRef<HTMLHeadingElement>(null);
  // quem usa o teclado ou o leitor de tela cai direto no que houve, em vez de ficar numa tela que já sumiu
  useEffect(() => titulo.current?.focus(), []);
  return (
    <div role="alert" className="grid min-h-dvh place-content-center justify-items-center gap-3 p-6 text-center">
      <h1 ref={titulo} tabIndex={-1} className="font-cond text-2xl font-semibold outline-none">Não foi possível abrir o sistema.</h1>
      <p className="max-w-sm text-apagado">{conselhoDaFalha(error)}</p>
      <Button
        type="button"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        Tentar de novo
      </Button>
    </div>
  );
}

/** Endereço que não existe. */
export function PaginaNaoEncontrada() {
  return (
    <div className="grid min-h-dvh place-content-center justify-items-center gap-3 p-6 text-center">
      <h1 className="font-cond text-2xl font-semibold">Esta página não existe.</h1>
      <p className="max-w-sm text-apagado">O endereço pode ter mudado ou estar digitado errado.</p>
      <Link to="/" className="font-medium text-vinho hover:underline">Voltar para o início</Link>
    </div>
  );
}
