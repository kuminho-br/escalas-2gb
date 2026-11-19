// Nome de uma vaga como a tela o mostra: "Chefe ABT" (função e guarnição) ou só o nome da guarnição quando a composição dela tem uma função só ("Graduado de dia").
export function nomeDaVaga(guarnicao: string, funcao: string, funcoesNaComposicao: number): string {
  return funcoesNaComposicao <= 1 ? guarnicao : `${funcao} ${guarnicao}`;
}
