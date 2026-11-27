// O código de acesso por e-mail: o sorteio, o resumo que fica no banco e o texto do e-mail.
import { createHmac } from 'node:crypto';

// só valem os sorteios abaixo do maior múltiplo de 1.000.000: assim nenhum código sai mais que os outros
const LIMITE = 2 ** 32 - (2 ** 32 % 1_000_000);

/** Seis dígitos (com zeros à esquerda), sorteados com `crypto.getRandomValues`, sem viés. */
export function sortearCodigo(): string {
  const sorteio = new Uint32Array(1);
  do crypto.getRandomValues(sorteio);
  while (sorteio[0]! >= LIMITE);
  return String(sorteio[0]! % 1_000_000).padStart(6, '0');
}

/** HMAC-SHA-256 em hexadecimal: é o que o banco guarda do código, do e-mail digitado e da origem do pedido. */
export function resumir(valor: string, segredo: string): string {
  return createHmac('sha256', segredo).update(valor).digest('hex');
}

/** O e-mail do código: texto e HTML simples, sem link e sem imagem. */
export function mensagemDoCodigo(codigo: string): { assunto: string; texto: string; html: string } {
  const texto = `Seu código é ${codigo}. Ele vale por 15 minutos e serve uma vez. Se você não pediu este código, ignore este e-mail: sua senha não muda.`;
  return {
    assunto: 'Seu código de acesso ao Sistema de Gestão - 2º GB',
    texto,
    html: `<p>Seu código é <strong style="font-size:1.4em;letter-spacing:0.15em">${codigo}</strong>.</p><p>Ele vale por 15 minutos e serve uma vez. Se você não pediu este código, ignore este e-mail: sua senha não muda.</p>`,
  };
}
