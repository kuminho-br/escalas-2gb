// Máscaras dos campos de contato (6.18): o telefone e o e-mail institucional. A API e a planilha seguem a regra de antes; a máscara só ajuda a digitar.
export const DOMINIO_DO_EMAIL = '@bombeiros.pe.gov.br';
export const MSG_TELEFONE = 'Use o DDD e o número: 10 ou 11 dígitos.';
export const MSG_USUARIO_DO_EMAIL = 'Use só o usuário do e-mail institucional.';

const soDigitos = (v: string) => v.replace(/\D/g, '');

/** Só números na digitação: "81996681232" → "(81) 99668-1232" (11 dígitos) e "8133334444" → "(81) 3333-4444" (10). Vai mascarando enquanto se digita; passa de 11 dígitos, não. */
export function mascararTelefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const meio = d.length > 10 ? 5 : 4;
  const numero = d.length <= 2 + meio ? d.slice(2) : `${d.slice(2, 2 + meio)}-${d.slice(2 + meio)}`;
  return `(${d.slice(0, 2)}) ${numero}`;
}

/** null se o telefone vale (vazio limpa; 10 ou 11 dígitos); senão a frase da tela. */
export function erroDoTelefone(v: string): string | null {
  const n = soDigitos(v).length;
  return n === 0 || n === 10 || n === 11 ? null : MSG_TELEFONE;
}

/**
 * O que a pessoa digitou ou colou no campo do e-mail institucional, que só recebe o usuário (o domínio fica fixo à direita): um e-mail inteiro do domínio fica só com o
 * usuário; de outro domínio (ou com "@" solto), o texto fica como está e vem a frase de erro.
 */
export function usuarioDoEmail(v: string): { usuario: string; erro: string | null } {
  const texto = v.trim();
  if (!texto.includes('@')) return { usuario: texto, erro: null };
  if (texto.toLowerCase().endsWith(DOMINIO_DO_EMAIL)) {
    const usuario = texto.slice(0, texto.length - DOMINIO_DO_EMAIL.length);
    if (usuario && !usuario.includes('@')) return { usuario, erro: null };
  }
  return { usuario: texto, erro: MSG_USUARIO_DO_EMAIL };
}

/** O e-mail gravado sem o domínio (o que o campo mostra). */
export function usuarioGravado(email: string | null | undefined): string {
  const e = email ?? '';
  return e.toLowerCase().endsWith(DOMINIO_DO_EMAIL) ? e.slice(0, e.length - DOMINIO_DO_EMAIL.length) : e;
}
