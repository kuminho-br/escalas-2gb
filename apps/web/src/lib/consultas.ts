import { QueryClient } from '@tanstack/react-query';
import { ErroApi } from '@/api/cliente';

/**
 * Uma consulta que falhou tenta de novo? Erro 4xx (a ficha não existe mais, sem permissão, pedido recusado) não, fora o 408 e o 429: tentar não muda a resposta e a
 * tela ficaria na espera até as tentativas acabarem. Sem conexão (status 0), erro 5xx e qualquer outra falha tentam mais duas vezes.
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

/**
 * O cliente de consultas do site (os testes usam o próprio, sem tentativas). Quando a conta de `['eu']` muda para outra pessoa (outra entra na mesma aba, depois do Sair
 * ou de uma sessão que terminou), as consultas da conta anterior são descartadas na hora: a tela inicial e a Minha escala nunca mostram, nem por um instante, o que era dela.
 * A mesma conta de novo não descarta nada.
 */
export function criarQueryClient(): QueryClient {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: deveTentarDeNovo } } });
  let ultimaConta: string | null = null;
  cliente.getQueryCache().subscribe((evento) => {
    if (evento.type !== 'updated' || evento.action.type !== 'success' || evento.query.queryKey[0] !== 'eu') return;
    const id = (evento.query.state.data as { usuario?: { id?: string } } | null | undefined)?.usuario?.id;
    if (!id) return; // sem sessão: o Sair já limpa tudo, e quem entrar depois é conferido contra a última conta
    if (ultimaConta && ultimaConta !== id) void cliente.resetQueries({ predicate: (q) => q.queryKey[0] !== 'eu' });
    ultimaConta = id;
  });
  return cliente;
}
