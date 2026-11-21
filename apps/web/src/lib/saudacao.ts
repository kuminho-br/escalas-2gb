const FUSO = 'America/Recife';

/** "Bom dia" até 11h59, "Boa tarde" até 17h59 e "Boa noite" depois, pela hora de Recife (e não a do computador). */
export function saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: FUSO }).format(agora));
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** "Quinta-feira, 19 de novembro de 2026", no dia de Recife. */
export function dataPorExtenso(agora: Date): string {
  const texto = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO }).format(agora);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
