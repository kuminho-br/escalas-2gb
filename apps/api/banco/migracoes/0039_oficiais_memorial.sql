-- Entrega 6.30: o memorial de cálculo da escala dos oficiais. Cada recálculo das cotas acrescenta um registro (o motivo, quem fez e a conta inteira do
-- momento). Nunca é apagado nem editado: o histórico é a própria tabela.
create table if not exists oficiais_memorial (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references oficiais_mes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  usuario_id uuid references usuario (id),
  motivo text not null,
  conta jsonb not null
);
create index if not exists oficiais_memorial_mes on oficiais_memorial (mes_id, criado_em desc);
drop trigger if exists auditoria_registro on oficiais_memorial;
create trigger auditoria_registro after insert or update or delete on oficiais_memorial
  for each row execute function registrar_auditoria();
