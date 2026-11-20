// Efetivo do dia: o painel das guarnições do dia (a meta de ativação, quem está nelas, o que falta) e as cotas restantes do mês.

/** Cota restante de um serviço no mês: a soma das cotas (interna e externa) e das alocações já distribuídas nelas. */
export type CotaRestante = { servicoId: string; servico: string; cor: string; quantidade: number; usadas: number };

export type MilitarNoEfetivo = {
  militarId: string;
  posto: string;
  nomeGuerra: string;
  funcaoId: string;
  funcao: string;
  /** HH:MM; o horário do turno da alocação */
  inicio: string;
  fim: string;
  servico: { id: string; nome: string; cor: string };
  /** true quando ele ocupa esta função por acúmulo (já está escalado em outra vaga no mesmo turno) */
  acumulo: boolean;
};

export type FaltaNoEfetivo = {
  funcao: string;
  faltam: number;
  /** HH:MM; o fim depois da meia-noite já volta ao relógio (08:00) */
  inicio: string;
  fim: string;
  /** a primeira escala, pelo nome, que vincula a guarnição nesse horário (o atalho "Abrir na Escala do mês") */
  escalaId: string | null;
};

export type GuarnicaoNoEfetivo = {
  guarnicaoId: string;
  nome: string;
  viatura: string | null;
  /** a posição na meta do dia (1, 2…); null fora da meta */
  ordem: number | null;
  ativada: boolean;
  /** onde a guarnição está vinculada no dia (a união, em HH:MM); vazio = "Sem horário vinculado neste dia" */
  horarios: { inicio: string; fim: string }[];
  faltas: FaltaNoEfetivo[];
  militares: MilitarNoEfetivo[];
};

export type EfetivoDoDia = {
  data: string;
  meta: { origem: 'padrao' | 'dia'; total: number; ativadas: number };
  guarnicoes: GuarnicaoNoEfetivo[];
  cotas: CotaRestante[];
};
