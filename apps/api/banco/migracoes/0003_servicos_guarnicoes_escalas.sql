-- Serviços, turnos, funções, guarnições e escalas (esquema v0.1, seções 3 a 5)
create table servico (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  tipo text not null check (tipo in ('ordinario', 'pjes', 'diaria')),
  operacao text,
  rotulo_impressao text,
  cor text not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean not null default true,
  unique (unidade_id, nome),
  check (operacao is null or tipo = 'diaria')
);

create table turno (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servico (id),
  letra text not null check (letra in ('A', 'B', 'C', 'U')),
  inicio time not null,
  fim time not null,
  unique (servico_id, letra)
);

create table funcao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  unique (unidade_id, nome)
);

create table guarnicao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  unique (unidade_id, nome)
);

create table guarnicao_versao (
  id uuid primary key default gen_random_uuid(),
  guarnicao_id uuid not null references guarnicao (id),
  vigencia_desde date not null check (extract(day from vigencia_desde) = 1),
  viatura text,
  tipo_viatura text,
  prioridade int,
  ativa boolean not null default true,
  unique (guarnicao_id, vigencia_desde)
);

create table composicao (
  id uuid primary key default gen_random_uuid(),
  guarnicao_versao_id uuid not null references guarnicao_versao (id),
  funcao_id uuid not null references funcao (id),
  minimo int not null check (minimo >= 0),
  maximo int check (maximo is null or maximo >= minimo),
  cnh_exigida text check (cnh_exigida in ('A', 'B', 'C', 'D', 'E')),
  ordem int not null default 0,
  unique (guarnicao_versao_id, funcao_id)
);

create table escala (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  nome text not null,
  titulo text not null,
  militares_doc text not null check (militares_doc in ('todos', 'escalados')),
  dias_doc text not null check (dias_doc in ('todos', 'com_escalados')),
  ativa boolean not null default true,
  unique (unidade_id, nome)
);

create table escala_servico (
  escala_id uuid not null references escala (id),
  servico_id uuid not null references servico (id),
  ordem int not null,
  primary key (escala_id, servico_id),
  unique (escala_id, ordem)
);

create table escala_vinculo_versao (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escala (id),
  vigencia_desde date not null check (extract(day from vigencia_desde) = 1),
  unique (escala_id, vigencia_desde)
);

create table escala_guarnicao (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references escala_vinculo_versao (id),
  guarnicao_id uuid not null references guarnicao (id),
  turno_letra text check (turno_letra in ('A', 'B', 'C', 'U')),
  unique nulls not distinct (versao_id, guarnicao_id, turno_letra)
);
