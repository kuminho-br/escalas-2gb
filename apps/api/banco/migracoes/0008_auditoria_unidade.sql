-- Auditoria: unidade do registro também pelo militar, serviço, guarnição, versão e alocação
-- (esquema v0.1, seção 8: "direta ou pela escala/militar").
create or replace function registrar_auditoria() returns trigger language plpgsql as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  unidade uuid := (r ->> 'unidade_id')::uuid;
  militar uuid;
begin
  if unidade is null and tg_table_name = 'unidade' then
    unidade := (r ->> 'id')::uuid;
  end if;
  if unidade is null and r ? 'escala_id' then
    select e.unidade_id into unidade from escala e where e.id = (r ->> 'escala_id')::uuid;
  end if;
  if unidade is null and r ? 'alocacao_id' then
    select e.unidade_id into unidade
      from alocacao a join escala e on e.id = a.escala_id where a.id = (r ->> 'alocacao_id')::uuid;
  end if;
  if unidade is null and r ? 'versao_id' then
    select e.unidade_id into unidade
      from escala_vinculo_versao v join escala e on e.id = v.escala_id where v.id = (r ->> 'versao_id')::uuid;
  end if;
  if unidade is null and r ? 'guarnicao_versao_id' then
    select g.unidade_id into unidade
      from guarnicao_versao v join guarnicao g on g.id = v.guarnicao_id where v.id = (r ->> 'guarnicao_versao_id')::uuid;
  end if;
  if unidade is null and r ? 'guarnicao_id' then
    select g.unidade_id into unidade from guarnicao g where g.id = (r ->> 'guarnicao_id')::uuid;
  end if;
  if unidade is null and r ? 'servico_id' then
    select s.unidade_id into unidade from servico s where s.id = (r ->> 'servico_id')::uuid;
  end if;
  if unidade is null then
    militar := case when tg_table_name = 'militar' then (r ->> 'id')::uuid else (r ->> 'militar_id')::uuid end;
    if militar is not null then
      -- lotação mais recente do militar
      select l.unidade_id into unidade from lotacao l
       where l.militar_id = militar order by l.desde desc limit 1;
    end if;
  end if;

  insert into auditoria (usuario_id, unidade_id, tabela, registro_id, acao, antes, depois)
  values (
    nullif(current_setting('app.usuario_id', true), '')::uuid,
    unidade,
    tg_table_name,
    coalesce(r ->> 'id', (r ->> 'escala_id') || ':' || (r ->> 'servico_id')),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end $$;
