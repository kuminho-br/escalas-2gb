import type { EdicaoMilitar } from 'contratos';

/** Os campos que o bloco "Identificação" da ficha edita, já como o servidor os guarda. */
export type ValoresIdentificacao = {
  postoGradId: string;
  nomeCompleto: string;
  nomeGuerra: string;
  sexo: 'M' | 'F' | null;
  antiguidade: number | null;
  voluntarioJes: boolean;
  ativo: boolean;
};

/** O nome é comparado como o servidor o guarda: em maiúsculas e sem espaços nas pontas. */
const nomeNormalizado = (nome: string) => nome.trim().toUpperCase();

/**
 * Só o que mudou entre o último gravado (`antes`) e o que está na tela (`depois`). Sem diferença, objeto vazio.
 * A antiguidade apagada sai como `null` (é o que a API entende como "sem antiguidade").
 */
export function alteracoesDaIdentificacao(antes: ValoresIdentificacao, depois: ValoresIdentificacao): EdicaoMilitar {
  const mudou: EdicaoMilitar = {};
  if (depois.postoGradId !== antes.postoGradId) mudou.postoGradId = depois.postoGradId;
  // o nome completo vai como está escrito (só sem espaços nas pontas); apagá-lo não é uma alteração (a ficha pede que continue preenchido)
  if (depois.nomeCompleto.trim() !== antes.nomeCompleto.trim() && depois.nomeCompleto.trim() !== '') mudou.nomeCompleto = depois.nomeCompleto.trim();
  if (depois.sexo !== antes.sexo) mudou.sexo = depois.sexo;
  if (nomeNormalizado(depois.nomeGuerra) !== nomeNormalizado(antes.nomeGuerra)) mudou.nomeGuerra = nomeNormalizado(depois.nomeGuerra);
  if (depois.antiguidade !== antes.antiguidade) mudou.antiguidade = depois.antiguidade;
  if (depois.voluntarioJes !== antes.voluntarioJes) mudou.voluntarioJes = depois.voluntarioJes;
  if (depois.ativo !== antes.ativo) mudou.ativo = depois.ativo;
  return mudou;
}
