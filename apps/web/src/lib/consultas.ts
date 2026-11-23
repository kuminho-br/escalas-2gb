import { QueryClient } from '@tanstack/react-query';
import { ErroApi } from '@/api/cliente';

/**
 * Uma consulta que falhou tenta de novo? Erro 4xx (a ficha não existe mais, sem permissão, pedido recusado) não, fora o 408 e o 429: tentar não muda a resposta e a
 * tela ficaria em "Carregando…" até as tentativas acabarem. Sem conexão (status 0), erro 5xx e qualquer outra falha tentam mais duas vezes.
 */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  // 408 (o pedido demorou) e 429 (muitos pedidos) passam sozinhos: tentar de novo ajuda
  if (erro instanceof ErroApi && erro.status >= 400 && erro.status <= 499 && erro.status !== 408 && erro.status !== 429) return false;
  return falhas < 2;
}

/** A busca de militares tem limite de pedidos por minuto (429): tentar de novo só gasta a janela, então o 429 vai direto para a tela. O resto segue `deveTentarDeNovo`. */
export function deveTentarDeNovoNaBusca(falhas: number, erro: Error): boolean {
  if (erro instanceof ErroApi && erro.status === 429) return false;
  return deveTentarDeNovo(falhas, erro);
}

/** O cliente de consultas do site (os testes usam o próprio, sem tentativas). */
export function criarQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: deveTentarDeNovo } } });
}
