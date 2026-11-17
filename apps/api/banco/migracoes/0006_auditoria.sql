-- Auditoria gravada pelo banco, só de acréscimo (esquema v0.1, seção 8)
create table auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid,
  unidade_id uuid,
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('insert', 'update', 'delete')),
  antes jsonb,
  depois jsonb
);
create index auditoria_unidade_em on auditoria (unidade_id, em);
create index auditoria_registro on auditoria (tabela, registro_id);

create function registrar_auditoria() returns trigger language plpgsql as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  unidade uuid := (r ->> 'unidade_id')::uuid;
begin
  if unidade is null and r ? 'escala_id' then
    select e.unidade_id into unidade from escala e where e.id = (r ->> 'escala_id')::uuid;
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

-- toda tabela de negócio existente, menos as de sessão/senha do login e a de controle
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
     where schemaname = current_schema()
       and tablename not in ('auditoria', 'migracao_aplicada', 'sessao', 'verificacao', 'conta')
  loop
    execute format(
      'create trigger auditoria_registro after insert or update or delete on %I for each row execute function registrar_auditoria()',
      t);
  end loop;
end $$;

create function auditoria_imutavel() returns trigger language plpgsql as $$
begin
  raise exception 'A auditoria é só de acréscimo: não se altera nem se apaga';
end $$;

create trigger auditoria_sem_alteracao before update or delete on auditoria
  for each row execute function auditoria_imutavel();
create trigger auditoria_sem_truncate before truncate on auditoria
  for each statement execute function auditoria_imutavel();
