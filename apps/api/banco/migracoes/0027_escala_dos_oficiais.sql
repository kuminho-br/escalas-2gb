-- P1.2: escala dos oficiais (QOC e QOA). Um mês por unidade, as cotas calculadas, os turnos de 12 h e o saldo de cada oficial.
-- O arquivo pode rodar de novo: cada tabela confere antes de criar.

create table if not exists oficiais_mes (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  mes date not null check (extract(day from mes) = 1),
  ordem_manual uuid[] not null default '{}',
  cotas_em timestamptz,
  fechada_em timestamptz,
  encerrada_em timestamptz,
  unique (unidade_id, mes),
  check (fechada_em is null or cotas_em is not null),
  check (encerrada_em is null or fechada_em is not null)
);

-- a cota gravada com a presença do último "Calcular cotas"; o id só serve à auditoria
create table if not exists oficiais_cota (
  id uuid not null default gen_random_uuid() unique,
  mes_id uuid not null references oficiais_mes (id) on delete cascade,
  militar_id uuid not null references militar (id),
  ordem int not null,
  dias int not null check (dias >= 0),
  devido numeric(12, 6) not null,
  cota int not null check (cota >= 0),
  sobra boolean not null default false,
  primary key (mes_id, militar_id),
  unique (mes_id, ordem)
);

create table if not exists oficiais_turno (
  id uuid primary key default gen_random_uuid(),
  mes_id uuid not null references oficiais_mes (id) on delete cascade,
  dia date not null,
  turno text not null check (turno in ('dia', 'noite')),
  militar_id uuid references militar (id),
  saiu_militar_id uuid references militar (id),
  check (saiu_militar_id is null or (militar_id is not null and saiu_militar_id <> militar_id)),
  unique (mes_id, dia, turno)
);

create table if not exists oficiais_saldo (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  militar_id uuid not null references militar (id),
  mes_id uuid references oficiais_mes (id),
  tipo text not null check (tipo in ('mes', 'entrada', 'ajuste')),
  valor numeric(12, 6) not null,
  tirado int,
  devido numeric(12, 6),
  turnos_dia int,
  turnos_noite int,
  motivo text,
  usuario_id uuid references usuario (id),
  criado_em timestamptz not null default now(),
  check (tipo = 'ajuste' or mes_id is not null),
  check (tipo <> 'ajuste' or (btrim(coalesce(motivo, '')) <> '' and char_length(motivo) <= 200))
);
create unique index if not exists oficiais_saldo_mes_militar_tipo
  on oficiais_saldo (mes_id, militar_id, tipo) where mes_id is not null;
create index if not exists oficiais_saldo_unidade on oficiais_saldo (unidade_id, militar_id);

-- a auditoria acha a unidade pelo mês quando o registro só tem mes_id (corpo da 0023, com um ramo a mais)
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
  if unidade is null and r ? 'mes_id' then
    select m.unidade_id into unidade from oficiais_mes m where m.id = (r ->> 'mes_id')::uuid;
  end if;
  if unidade is null then
    militar := case when tg_table_name = 'militar' then (r ->> 'id')::uuid else (r ->> 'militar_id')::uuid end;
    if militar is not null then
      -- rastreio mais recente do militar
      select l.unidade_id into unidade from rastreio l
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

drop trigger if exists auditoria_registro on oficiais_mes;
create trigger auditoria_registro after insert or update or delete on oficiais_mes
  for each row execute function registrar_auditoria();
drop trigger if exists auditoria_registro on oficiais_cota;
create trigger auditoria_registro after insert or update or delete on oficiais_cota
  for each row execute function registrar_auditoria();
drop trigger if exists auditoria_registro on oficiais_turno;
create trigger auditoria_registro after insert or update or delete on oficiais_turno
  for each row execute function registrar_auditoria();
drop trigger if exists auditoria_registro on oficiais_saldo;
create trigger auditoria_registro after insert or update or delete on oficiais_saldo
  for each row execute function registrar_auditoria();
