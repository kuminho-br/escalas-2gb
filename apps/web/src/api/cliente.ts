import { descartarPendencias } from '@/componentes/AlteracoesPendentes';
import { cabecalhosDoModo, caminhoDoModo, sairDoModo } from '@/laboratorio/modo';

// Chamadas à API: devolvem o JSON ou lançam ErroApi com a mensagem para mostrar na tela.
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly campos?: Record<string, string>,
    /** a API não disse nada (resposta sem mensagem): o texto é o padrão da tela, e quem chama pode trocá-lo por um que diga o que fazer */
    readonly padrao = false,
    /** a API diz que a recusa tem decisão do escalante (6.39): "expediente" = pôr o serviço por cima do expediente, depois de confirmar */
    readonly resolvivel?: 'expediente',
    /** a recusa da troca diz quem impede (6.70): a tela marca a linha desse militar */
    readonly militarId?: string,
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
  // a sessão da conta acabou: a tela de entrar e o código por e-mail são do real
  sairDoModo();
  navegador.ir(`/entrar?sessao=terminou&voltar=${encodeURIComponent(window.location.pathname + window.location.search)}`);
}

/**
 * O único `fetch` do site para a API: aplica o modo Laboratório (6.59), o endereço `/api/lab/…` e o cabeçalho. Fora do modo, o pedido sai como sempre foi.
 * Nenhum outro lugar chama `fetch` com um endereço da API: é assim que um pedido do Laboratório nunca sai sem o prefixo, e um do real nunca sai com ele.
 */
export function buscar(caminho: string, init: RequestInit = {}): Promise<Response> {
  const final = caminhoDoModo(caminho);
  const extra = cabecalhosDoModo(final);
  if (!Object.keys(extra).length) return fetch(final, init);
  return fetch(final, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...extra } });
}

async function resposta<T>(r: Response): Promise<T> {
  const dados = (await r.json().catch(() => null)) as { erro?: string; campos?: Record<string, string>; resolvivel?: 'expediente'; militarId?: string } | null;
  // a hospedagem recusa envio grande demais com texto puro, antes de a API ser chamada
  if (r.status === 413 && !dados?.erro) throw new ErroApi('O envio é grande demais. Confira os dados e tente de novo.', 413);
  if (!r.ok) throw new ErroApi(dados?.erro ?? `Erro inesperado (${r.status}). Tente de novo.`, r.status, dados?.campos, !dados?.erro, dados?.resolvivel, dados?.militarId);
  return dados as T;
}

/** A pessoa desistiu do diálogo do motivo: a mudança não foi feita. As telas ignoram em silêncio (`foiCancelado`). */
export class Cancelado extends Error {
  constructor() {
    super('Cancelado.');
  }
}
export const foiCancelado = (e: unknown): boolean => e instanceof Cancelado;

/**
 * Quem pede o motivo de uma alteração no passado (7.4): o diálogo da casca. Quando a API recusa uma mudança com 400 no campo `justificativa` (o turno já começou e quem muda é gestor),
 * `pedir` entrega ao diálogo a mensagem e a função que repete a chamada com o texto; o diálogo a chama, mostra o erro do campo se a API recusar o texto, e resolve ou rejeita com `Cancelado`.
 */
export type PedirJustificativa = <T>(mensagem: string, tentar: (justificativa: string) => Promise<T>) => Promise<T>;
let justificador: PedirJustificativa | null = null;
let ultimoMotivo: { n: number; texto: string } | null = null;
export const justificativa = {
  /** O diálogo avisa o motivo que a API aceitou: quem encadeia duas chamadas da mesma ação (o "Trocar militar") leva o texto adiante em vez de pedir de novo. */
  aceito(texto: string): void {
    ultimoMotivo = { n: (ultimoMotivo?.n ?? 0) + 1, texto };
  },
  /** O último motivo aceito, com um número que sobe a cada um (quem compara antes e depois de uma chamada sabe se ela pediu o motivo). */
  ultimo(): { n: number; texto: string } | null {
    return ultimoMotivo;
  },
  /** A casca registra o diálogo ao montar e o tira ao desmontar; devolve a função que desfaz o registro. */
  registrar(fn: PedirJustificativa): () => void {
    justificador = fn;
    return () => {
      if (justificador === fn) justificador = null;
    };
  },
};

export async function pedir<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  try {
    return await pedirUma<T>(metodo, caminho, corpo);
  } catch (e) {
    // só as mudanças: a API pede o motivo de alterar o passado com 400 no campo `justificativa`, e o diálogo repete a chamada com o texto
    if (metodo !== 'GET' && e instanceof ErroApi && e.status === 400 && e.campos?.justificativa && justificador) {
      const base = corpo !== null && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
      return justificador<T>(e.campos.justificativa, (texto) => pedirUma<T>(metodo, caminho, { ...base, justificativa: texto }));
    }
    throw e;
  }
}

async function pedirUma<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await buscar(caminho, {
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
    r = await buscar(caminho, { method: 'POST', credentials: 'include', body: corpo });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  // a importação também: com a sessão terminada, vai para entrar com o aviso, como qualquer outro pedido
  if (r.status === 401) sessaoTerminou(caminho);
  return resposta<T>(r);
}

/**
 * Baixa o arquivo que a API devolve a um POST (a exportação para Excel, 6.54): lê o corpo como arquivo e o entrega ao navegador com o nome dado. Erro da API (JSON) vira `ErroApi`,
 * como em qualquer outro pedido.
 */
export async function baixarArquivo(caminho: string, corpo: unknown, nome: string): Promise<void> {
  let r: Response;
  try {
    r = await buscar(caminho, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  return entregarArquivo(r, caminho, nome);
}

/** Como `baixarArquivo`, para um pedido que envia um arquivo (a planilha das linhas com problema da importação, 6.57): reenvia o arquivo e baixa o que a API devolve. */
export async function baixarEnvio(caminho: string, arquivo: File, nome: string): Promise<void> {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  let r: Response;
  try {
    r = await buscar(caminho, { method: 'POST', credentials: 'include', body: corpo });
  } catch {
    throw new ErroApi(SEM_CONEXAO, 0);
  }
  return entregarArquivo(r, caminho, nome);
}

async function entregarArquivo(r: Response, caminho: string, nome: string): Promise<void> {
  if (r.status === 401) sessaoTerminou(caminho);
  if (!r.ok) return resposta<void>(r);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // adiar o revogar: alguns navegadores cancelam o download se a URL some logo depois do clique
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
