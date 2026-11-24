-- 6.40: a pré-escala lança o expediente do Adm, que não entra em nenhuma escala publicada. A alocação (e a remoção dela) passa a aceitar escala vazia, só para o serviço
-- Expediente (o serviço fixo de nome "Expediente").
alter table alocacao alter column escala_id drop not null;
alter table remocao alter column escala_id drop not null;

create or replace function alocacao_coerente() returns trigger language plpgsql as $$
begin
  if new.escala_id is null then
    if not exists (select 1 from servico where id = new.servico_id and lower(btrim(nome)) = 'expediente') then
      raise exception 'Só o serviço Expediente pode ficar sem escala';
    end if;
  elsif not exists (select 1 from escala_servico where escala_id = new.escala_id and servico_id = new.servico_id) then
    raise exception 'O serviço não faz parte desta escala';
  end if;
  if not exists (select 1 from turno where id = new.turno_id and servico_id = new.servico_id) then
    raise exception 'O turno não é deste serviço';
  end if;
  return new;
end $$;
