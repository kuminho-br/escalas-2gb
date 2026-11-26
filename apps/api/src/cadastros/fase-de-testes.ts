// A chave da fase de testes do rastreio (decisão do usuário de 26/11/2026, em docs/decisoes.md).
//
// Enquanto for `true`, o administrador cancela e edita QUALQUER período do histórico de rastreio de um militar, inclusive o que já vale ou já passou
// (o sistema mantém a linha do tempo coerente). Quando a fase de testes acabar, troque para `false`: só a mudança que ainda não vale (início depois de hoje)
// pode ser cancelada ou editada, por quem tem o mesmo nível de acesso de "Alterar situação". É a única linha a mudar.
export const ADMINISTRADOR_MEXE_EM_QUALQUER_PERIODO = true;
