// A senha provisória: 12 letras e números, em três grupos de quatro, fáceis de ler e ditar (sem 0, o, 1, l e i).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';
// só valem os bytes abaixo do maior múltiplo do alfabeto: assim nenhum caractere sai mais que os outros
const LIMITE = 256 - (256 % ALFABETO.length);

/** Ex.: `k7mq-3tav-p9xe`. Sorteada com `crypto.getRandomValues`. */
export function gerarSenhaProvisoria(): string {
  const caracteres: string[] = [];
  while (caracteres.length < 12) {
    for (const byte of crypto.getRandomValues(new Uint8Array(24))) {
      if (byte < LIMITE && caracteres.length < 12) caracteres.push(ALFABETO[byte % ALFABETO.length]!);
    }
  }
  return [0, 4, 8].map((i) => caracteres.slice(i, i + 4).join('')).join('-');
}
