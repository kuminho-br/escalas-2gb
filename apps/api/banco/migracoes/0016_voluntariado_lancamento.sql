-- Fase 4.2: o escalante lança o voluntariado de cada militar à mão, mês a mês (telas: "Voluntariado" › "Lançar à mão").
-- Um lançamento sem nenhuma marcação também conta ("já lançado, 0 dias"); por isso o registro é à parte das marcações.

create table voluntariado_lancamento (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  mes date not null check (extract(day from mes) = 1),
  lancado_por uuid references usuario (id),
  lancado_em timestamptz not null default now(),
  unique (militar_id, mes)
);

create trigger auditoria_registro after insert or update or delete on voluntariado_lancamento
  for each row execute function registrar_auditoria();
