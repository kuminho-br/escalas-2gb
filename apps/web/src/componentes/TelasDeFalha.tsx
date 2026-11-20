import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { ErroApi } from '@/api/cliente';
import { Button } from '@/componentes/ui/button';

/** Falha ao abrir uma tela (sessão, rede, resposta fora do esperado): em português, com a saída à mão. */
export function ErroAoAbrir({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  // o servidor disse o que houve (503: banco desatualizado): a tela repete a mensagem em vez do conselho genérico da conexão
  const doServidor = error instanceof ErroApi && error.status === 503 ? error.message : null;
  return (
    <div role="alert" className="grid min-h-dvh place-content-center justify-items-center gap-3 p-6 text-center">
      <h1 className="font-cond text-2xl font-semibold">Não foi possível abrir o sistema.</h1>
      <p className="max-w-sm text-apagado">{doServidor ?? 'Confira a conexão e tente de novo. Se continuar, avise quem cuida do sistema.'}</p>
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
