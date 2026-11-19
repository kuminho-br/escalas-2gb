-- Fase 4.1.1: acúmulo de funções (design de 18/11/2026, Parte 2).
-- Quando falta gente, um militar já escalado numa faixa ocupa também outra vaga (inclusive de outra guarnição).
-- O acúmulo não é uma segunda alocação: o banco já impede duas alocações do mesmo militar no mesmo turno,
-- e assim as horas e o serviço contam uma vez só. Apagar a alocação apaga os acúmulos dela.

create table alocacao_acumulo (
  id uuid primary key default gen_random_uuid(),
  alocacao_id uuid not null references alocacao (id) on delete cascade,
  guarnicao_id uuid not null references guarnicao (id),
  funcao_id uuid not null references funcao (id),
  unique (alocacao_id, guarnicao_id, funcao_id)
);
create index alocacao_acumulo_alocacao on alocacao_acumulo (alocacao_id);

create trigger auditoria_registro after insert or update or delete on alocacao_acumulo
  for each row execute function registrar_auditoria();
