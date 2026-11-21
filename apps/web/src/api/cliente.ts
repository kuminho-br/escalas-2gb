import { descartarPendencias } from '@/componentes/AlteracoesPendentes';

// Chamadas à API: devolvem o JSON ou lançam ErroApi com a mensagem para mostrar na tela.
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly campos?: Record<string, string>,
    /** a API não disse nada (resposta sem mensagem): o texto é o padrão da tela, e quem chama pode trocá-lo por um que diga o que fazer */
    readonly padrao = false,
  ) {
    super(mensagem);
  }
}

export const SEM_CONEXAO = 'Sem conexão com o servidor. Tente de novo.';

/** Troca de página inteira (o `window.location.assign` do jsdom não navega: os testes trocam este objeto). */
export const navegador = { ir: (destino: string) => window.location.assign(destino) };

let saindo = false;
/**
 * A pessoa clicou em "Sair": o 401 de um pedido que ainda estava no ar é o próprio Sair, não uma sessão que terminou. A marca fica em memória, é
 * desligada se o Sair falhar (a sessão continua valendo) e quando a pessoa entra de novo.
 */
export const saida = { marcar: (v: boolean) => { saindo = v; } };

/**
 * A sessão terminou no meio do uso (401 de uma consulta ou gravação): vai para a tela de entrar, com o aviso e o caminho de volta. O que não
 * foi salvo se perde, e o aviso "Sair do site?" do navegador não aparece. O `/api/eu` não passa por aqui (quem nunca entrou vai para entrar sem
 * o aviso) e a própria tela de entrar não se manda de novo. Depois de "Sair", o 401 de um pedido atrasado não faz nada: o Sair já leva para entrar.
 */
function sessaoTerminou(caminho: string) {
  if (caminho === '/api/eu' || window.location.pathname === '/entrar' || saindo) return;
  descartarPendencias();
  navegador.ir(`/entrar?sessao=terminou&voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}

async function resposta<T>(r: Response): Promise<T> {
  const dados = (await r.json().catch(() => null)) as { erro?: string; campos?: Record<string, string> } | null;
  // a hospedagem recusa envio grande demais com texto puro, antes de a API ser chamada
  if (r.status === 413 && !dados?.erro) throw new ErroApi('O envio é grande demais. Confira os dados e tente de novo.', 413);
  if (!r.ok) throw new ErroApi(dados?.erro ?? `Erro inesperado (${r.status}). Tente de novo.`, r.status, dados?.campos, !dados?.erro);
  return dados as T;
}

export async function pedir<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(caminho, {
      method: metodo,
      credentials: 'include',
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  if (r.status === 401) sessaoTerminou(caminho);
  return resposta<T>(r);
}

export async function enviarArquivo<T>(caminho: string, arquivo: File): Promise<T> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  let r: Response;
  try {
    r = await fetch(caminho, { method: 'POST', credentials: 'include', body: corpo });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  // a importação também: com a sessão terminada, vai para entrar com o aviso, como qualquer outro pedido
  if (r.status === 401) sessaoTerminou(caminho);
  return resposta<T>(r);
}

/** Mensagem de um erro qualquer, para mostrar na tela. */
export function mensagemDe(e: unknown): string {
  return e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.';
}

/** A mensagem da API mais a do primeiro campo recusado ("Confira os campos destacados. Use no máximo 120 caracteres."). */
export function mensagemComCampo(e: unknown): string {
  const primeiro = e instanceof ErroApi && e.campos ? Object.values(e.campos)[0] : undefined;
  return primeiro ? `${mensagemDe(e)} ${primeiro}` : mensagemDe(e);
}

/** O que a API recusou, campo a campo (vazio quando o erro não é de campos). */
export function camposDe(e: unknown): Record<string, string> {
  return e instanceof ErroApi ? (e.campos ?? {}) : {};
}
