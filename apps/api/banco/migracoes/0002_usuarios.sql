-- Usuários e papéis (esquema v0.1, seção 2). Tabelas de login do Better Auth com nomes em português.
create table usuario (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  email_verificado boolean not null default false,
  imagem text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  militar_id uuid not null unique references militar (id),
  ativo boolean not null default true
);

create table sessao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  token text not null unique,
  expira_em timestamptz not null,
  ip text,
  agente text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index sessao_usuario on sessao (usuario_id);

create table conta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  conta_id text not null,
  provedor_id text not null,
  senha text,
  token_acesso text,
  token_renovacao text,
  token_id text,
  expira_token_acesso timestamptz,
  expira_token_renovacao timestamptz,
  escopo text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index conta_usuario on conta (usuario_id);

create table verificacao (
  id uuid primary key default gen_random_uuid(),
  identificador text not null,
  valor text not null,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table papel_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id),
  unidade_id uuid not null references unidade (id),
  papel text not null check (papel in ('administrador', 'chefe', 'escalante')),
  desde date not null,
  ate date check (ate is null or ate >= desde)
);
create index papel_usuario_usuario on papel_usuario (usuario_id);

create table convite (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  militar_id uuid not null references militar (id),
  unidade_id uuid not null references unidade (id),
  papel text not null check (papel in ('administrador', 'chefe', 'escalante')),
  enviado_por uuid not null references usuario (id),
  expira_em timestamptz not null,
  aceito_em timestamptz
);
