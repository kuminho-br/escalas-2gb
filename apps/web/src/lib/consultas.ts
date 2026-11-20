import { QueryClient } from '@tanstack/react-query';
import { ErroApi } from '@/api/cliente';

/**
 * Uma consulta que falhou tenta de novo? Erro 4xx (a ficha não existe mais, sem permissão, pedido recusado) não: tentar não muda a resposta e a
 * tela ficaria em "Carregando…" até as tentativas acabarem. Sem conexão (status 0), erro 5xx e qualquer outra falha tentam mais duas vezes.
 */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  if (erro instanceof ErroApi && erro.status >= 400 && erro.status <= 499) return false;
  return falhas < 2;
}

/** O cliente de consultas do site (os testes usam o próprio, sem tentativas). */
export function criarQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: deveTentarDeNovo } } });
}
