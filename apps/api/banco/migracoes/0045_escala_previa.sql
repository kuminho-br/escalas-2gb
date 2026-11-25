-- Fase 7.3: a prévia de uma escala num mês. Existir a linha é estar lançada: a corporação passa a ler essa escala, e mexer num turno que já começou
-- passa a pedir gestor, coordenador ou administrador, com justificativa e registro (decisões 9 a 14 do design de 25/11/2026). Recolher a prévia é apagar a linha.
-- A coluna `id` existe só para a auditoria gravar o registro (a chave é escala e mês).
create table escala_previa (
  id uuid not null unique default gen_random_uuid(),
  escala_id uuid not null references escala (id),
  mes date not null check (extract(day from mes) = 1),
  lancada_por uuid references usuario (id),
  lancada_em timestamptz not null default now(),
  primary key (escala_id, mes)
);
create trigger auditoria_registro after insert or update or delete on escala_previa
  for each row execute function registrar_auditoria();
