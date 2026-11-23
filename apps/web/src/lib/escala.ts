/** "Ficaram de fora: 3 afastados, 2 sem a CNH exigida, 1 com choque de horário" — o motivo da API em frase corrida. */
const COMO_SE_LE: Record<string, [singular: string, plural: string]> = {
  Afastado: ['afastado', 'afastados'],
  Desativado: ['desativado', 'desativados'],
  'Sem a CNH exigida': ['sem a CNH exigida', 'sem a CNH exigida'],
  'Fora do quadro de motoristas': ['fora do quadro de motoristas', 'fora do quadro de motoristas'],
  'Choque de horário': ['com choque de horário', 'com choque de horário'],
  'Já escalado neste horário': ['já escalado neste horário', 'já escalados neste horário'],
  'Não é voluntário JES': ['sem ser voluntário JES', 'sem ser voluntários JES'],
  'Não marcou voluntariado neste horário': ['sem voluntariado neste horário', 'sem voluntariado neste horário'],
  'Não está lotado na seção neste dia': ['fora da seção neste dia', 'fora da seção neste dia'],
};

export function frasesDeFora(fora: { motivo: string; quantidade: number }[]): string {
  return fora
    .map(({ motivo, quantidade }) => {
      const [um, varios] = COMO_SE_LE[motivo] ?? [motivo.toLowerCase(), motivo.toLowerCase()];
      return `${quantidade} ${quantidade === 1 ? um : varios}`;
    })
    .join(', ');
}

/** "Chefe ABT" (função e guarnição) ou só o nome da guarnição quando ela tem uma função só ("Graduado de dia"); a mesma regra da API. */
export function nomeDaVaga(guarnicao: string, funcao: string, funcoesNaComposicao: number): string {
  return funcoesNaComposicao <= 1 ? guarnicao : `${funcao} ${guarnicao}`;
}

/** "A", "A e B", "A, B e C". */
export function listaComE(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}
