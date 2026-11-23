-- Entrega 6.28: os dias vermelhos (dias ruins, que ninguém quer tirar). O escalante marca no calendário do mês; todos têm o mesmo peso. Ligados à escala (e não
-- ao mês dos oficiais), para servirem às outras escalas depois. O `id` só serve à auditoria.
create table if not exists dia_vermelho (
  id uuid not null default gen_random_uuid() unique,
  escala_id uuid not null references escala (id) on delete cascade,
  dia date not null,
  primary key (escala_id, dia)
);
drop trigger if exists auditoria_registro on dia_vermelho;
create trigger auditoria_registro after insert or update or delete on dia_vermelho
  for each row execute function registrar_auditoria();
