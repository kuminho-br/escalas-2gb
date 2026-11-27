// O envio de e-mail: a interface que `criarApp` recebe, o envio pela API do Brevo e o que roda depois que a resposta sai.
// A chave do Brevo (`BREVO_API_KEY`) e o remetente (`EMAIL_REMETENTE`) vêm do ambiente e nunca vão para log, auditoria, teste ou mensagem de erro.
import { waitUntil } from '@vercel/functions';

export type EmailParaEnviar = { para: string; assunto: string; texto: string; html: string };
/** Lança se o envio falhar. A mensagem do erro nunca leva a chave, o código nem o corpo do pedido. */
export type EnviarEmail = (m: EmailParaEnviar) => Promise<void>;

export const NOME_DO_REMETENTE = 'Sistema de Gestão - 2º GB';

export function enviarPeloBrevo(cfg: { chave: string; remetente: string; fetch?: typeof fetch }): EnviarEmail {
  const buscar = cfg.fetch ?? fetch;
  return async (m) => {
    let resposta: Response;
    try {
      resposta = await buscar('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': cfg.chave, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: NOME_DO_REMETENTE, email: cfg.remetente }, to: [{ email: m.para }], subject: m.assunto, textContent: m.texto, htmlContent: m.html }),
      });
    } catch {
      // a causa da rede pode citar o endereço ou o cabeçalho: o erro leva só o que aconteceu
      throw new Error('Brevo: a conexão falhou.');
    }
    // o corpo da resposta pode repetir o pedido: não entra na mensagem
    if (!resposta.ok) throw new Error(`Brevo: resposta ${resposta.status}.`);
  };
}

/** Só no servidor local (`servidor.ts`, com `ENVIO_DE_TESTE=terminal`): escreve a mensagem no terminal, para conferir o fluxo com e-mails fictícios. */
export function enviarNoTerminal(): EnviarEmail {
  return async (m) => {
    console.log(`\n[e-mail de teste] para ${m.para}\n${m.assunto}\n${m.texto}\n`);
  };
}

/**
 * O envio do servidor local: sem `ENVIO_DE_TESTE`, fora do ar (null); com `terminal`, escreve a mensagem no terminal. Com `DATABASE_URL` (um banco de verdade) o terminal é recusado:
 * o código de um militar real sairia na tela.
 */
export function escolherEnvio(env: Record<string, string | undefined>): EnviarEmail | null {
  if (env.ENVIO_DE_TESTE !== 'terminal') return null;
  if (env.DATABASE_URL) throw new Error('ENVIO_DE_TESTE=terminal só vale no banco local: com DATABASE_URL, o código de um militar real sairia no terminal. Tire uma das duas variáveis.');
  return enviarNoTerminal();
}

/** Roda a tarefa depois de a resposta sair: com `waitUntil` na Vercel; no servidor local e nos testes, a promessa corre sozinha, com o erro tratado. */
export function aposResponder(tarefa: Promise<void>): void {
  const tratada = tarefa.catch((e: unknown) => console.error('Tarefa depois da resposta falhou:', e instanceof Error ? e.message : 'erro'));
  if (process.env.VERCEL) waitUntil(tratada);
}
