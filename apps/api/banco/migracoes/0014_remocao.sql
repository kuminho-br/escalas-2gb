-- Fase 4.1: militar tirado pelo escalante de um dia, serviço e turno (adendo de 17/11/2026 do design).
-- A pré-escala e as distribuições não o colocam de volta nessa combinação; escalá-lo de novo à mão apaga a remoção.

create table remocao (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  escala_id uuid not null references escala (id),
  servico_id uuid not null references servico (id),
  turno_id uuid not null references turno (id),
  data date not null,
  removida_por uuid references usuario (id),
  removida_em timestamptz not null default now(),
  unique (militar_id, data, servico_id, turno_id)
);
create index remocao_escala_data on remocao (escala_id, data);

-- uma alocação nova com a mesma chave desfaz a remoção (também serve de "Desfazer remoção")
create function alocacao_desfaz_remocao() returns trigger language plpgsql as $$
begin
  delete from remocao where militar_id = new.militar_id and data = new.data and servico_id = new.servico_id and turno_id = new.turno_id;
  return new;
end $$;

create trigger alocacao_apaga_remocao after insert on alocacao
  for each row execute function alocacao_desfaz_remocao();
