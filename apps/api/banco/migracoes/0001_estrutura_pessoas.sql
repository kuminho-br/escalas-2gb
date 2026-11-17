-- Estrutura e pessoas (esquema v0.1, seção 1)
create extension if not exists ltree;
create extension if not exists btree_gist;

create table tipo_unidade (
  codigo text primary key,
  nome text not null,
  nivel int not null unique
);
insert into tipo_unidade (codigo, nome, nivel) values
  ('corporacao', 'Corporação', 0),
  ('diretoria_geral', 'Diretoria Geral', 1),
  ('diretoria_integrada', 'Diretoria Integrada', 2),
  ('grupamento', 'Grupamento', 3),
  ('secao', 'Seção', 4);

create table unidade (
  id uuid primary key default gen_random_uuid(),
  tipo text not null references tipo_unidade (codigo),
  sigla text not null,
  nome text not null,
  mae_id uuid references unidade (id),
  caminho ltree not null unique,
  desde date not null check (extract(day from desde) = 1),
  ate date check (ate is null or ate >= desde)
);
create index unidade_caminho_gist on unidade using gist (caminho);
-- uma única raiz
create unique index unidade_uma_raiz on unidade ((mae_id is null)) where mae_id is null;

create function unidade_montar_caminho() returns trigger language plpgsql as $$
declare
  mae record;
  rotulo text := replace(new.id::text, '-', '_');
begin
  if new.mae_id is null then
    new.caminho := rotulo::ltree;
    return new;
  end if;
  select u.caminho, t.nivel into mae
    from unidade u join tipo_unidade t on t.codigo = u.tipo
   where u.id = new.mae_id;
  if (select nivel from tipo_unidade where codigo = new.tipo) <= mae.nivel then
    raise exception 'A unidade mãe precisa ser de nível acima do da filha';
  end if;
  if mae.caminho ~ ('*.' || rotulo || '.*')::lquery then
    raise exception 'Uma unidade não pode ficar abaixo de si mesma';
  end if;
  new.caminho := mae.caminho || rotulo::ltree;
  return new;
end $$;

create trigger unidade_caminho before insert or update of mae_id, tipo on unidade
  for each row execute function unidade_montar_caminho();

create function unidade_mover_descendentes() returns trigger language plpgsql as $$
begin
  update unidade
     set caminho = new.caminho || subpath(caminho, nlevel(old.caminho))
   where caminho <@ old.caminho and id <> new.id;
  return null;
end $$;

-- sem lista de colunas: o caminho muda pelo gatilho "before", não pelo SET
create trigger unidade_descendentes after update on unidade
  for each row when (old.caminho is distinct from new.caminho)
  execute function unidade_mover_descendentes();

create table posto_grad (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  ordem int not null unique
);

create table militar (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique check (matricula ~ '^\d{6}-\d$'),
  posto_grad_id uuid not null references posto_grad (id),
  nome_guerra text not null,
  antiguidade int,
  motorista boolean not null default false,
  cnh text[] not null default '{}' check (cnh <@ array['A', 'B', 'C', 'D', 'E']),
  voluntario_jes boolean not null default false,
  ativo boolean not null default true,
  check (motorista or cardinality(cnh) = 0)
);

create table equipe (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  ordem_ciclo int not null,
  unique (unidade_id, nome),
  unique (unidade_id, ordem_ciclo)
);

create table lotacao (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  unidade_id uuid not null references unidade (id),
  equipe_id uuid references equipe (id),
  jornada text not null check (jornada in ('pronto', 'adm')),
  desde date not null check (extract(day from desde) = 1),
  ate date check (ate is null or ate >= desde),
  exclude using gist (militar_id with =, daterange(desde, ate, '[]') with &&)
);

create function lotacao_equipe_da_unidade() returns trigger language plpgsql as $$
begin
  if new.equipe_id is not null
     and not exists (select 1 from equipe where id = new.equipe_id and unidade_id = new.unidade_id) then
    raise exception 'A equipe precisa ser da mesma unidade da lotação';
  end if;
  return new;
end $$;

create trigger lotacao_equipe before insert or update on lotacao
  for each row execute function lotacao_equipe_da_unidade();

create table vinculo_externo (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  unidade_id uuid not null references unidade (id),
  desde date not null,
  ate date check (ate is null or ate >= desde),
  observacao text,
  exclude using gist (militar_id with =, unidade_id with =, daterange(desde, ate, '[]') with &&)
);

create table afastamento (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  tipo text not null check (tipo in ('ferias', 'licenca', 'outro')),
  inicio date not null,
  fim date not null check (fim >= inicio),
  exclude using gist (militar_id with =, daterange(inicio, fim, '[]') with &&)
);
