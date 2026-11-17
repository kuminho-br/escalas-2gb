// Chamadas à API: devolvem o JSON ou lançam ErroApi com a mensagem para mostrar na tela.
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly campos?: Record<string, string>,
  ) {
    super(mensagem);
  }
}

const SEM_CONEXAO = 'Sem conexão com o servidor. Tente de novo.';

async function resposta<T>(r: Response): Promise<T> {
  const dados = (await r.json().catch(() => null)) as { erro?: string; campos?: Record<string, string> } | null;
  if (!r.ok) throw new ErroApi(dados?.erro ?? `Erro inesperado (${r.status}). Tente de novo.`, r.status, dados?.campos);
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
  return resposta<T>(r);
}

/** Mensagem de um erro qualquer, para mostrar na tela. */
export function mensagemDe(e: unknown): string {
  return e instanceof ErroApi ? e.message : 'Algo deu errado. Tente de novo.';
}
