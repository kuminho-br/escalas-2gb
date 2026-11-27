import { Check, Circle } from 'lucide-react';

/** O mínimo da senha (as regras da API e do better-auth: `NovaSenha`, `minPasswordLength`). */
export const MINIMO_DA_SENHA = 10;

/** Os requisitos da senha que a pessoa está digitando, na ordem em que aparecem na lista. */
export function requisitosDaSenha(senha: string, confirmacao: string) {
  return [
    { texto: `Pelo menos ${MINIMO_DA_SENHA} caracteres`, cumprido: senha.length >= MINIMO_DA_SENHA },
    { texto: 'As duas senhas iguais', cumprido: senha.length > 0 && senha === confirmacao },
  ];
}

export const senhaCumpreOsRequisitos = (senha: string, confirmacao: string) => requisitosDaSenha(senha, confirmacao).every((r) => r.cumprido);

/** A lista dos requisitos da senha, cada um marcado quando cumprido; o leitor de tela diz "cumprido" ou "falta". As regras são as que já existem, só ficam à vista. */
export function RequisitosDaSenha({ senha, confirmacao }: { senha: string; confirmacao: string }) {
  return (
    <ul aria-label="Requisitos da senha" className="grid gap-1 text-apoio">
      {requisitosDaSenha(senha, confirmacao).map((r) => (
        <li key={r.texto} className={r.cumprido ? 'flex items-center gap-2 text-tinta' : 'flex items-center gap-2 text-apagado'}>
          {r.cumprido ? <Check aria-hidden className="size-4 shrink-0 text-tinta" strokeWidth={2.25} /> : <Circle aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />}
          <span>{r.texto}</span>
          <span className="sr-only">{r.cumprido ? ': cumprido' : ': falta'}</span>
        </li>
      ))}
    </ul>
  );
}
