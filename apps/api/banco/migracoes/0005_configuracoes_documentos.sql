-- Configurações e documentos (esquema v0.1, seção 7)
create table parametro (
  id uuid primary key default gen_random_uuid(),
  chave text not null,
  unidade_id uuid not null references unidade (id),
  vigencia_desde date not null check (extract(day from vigencia_desde) = 1),
  valor jsonb not null,
  norma_referencia text,
  unique (chave, unidade_id, vigencia_desde)
);

create table feriado (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  data date not null,
  descricao text not null,
  unique (unidade_id, data)
);

create table modelo_impressao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  documento text not null check (documento in ('escala_publicada', 'efetivo_dia', 'escala_executada')),
  versao int not null,
  arquivo bytea not null,
  marcadores jsonb not null default '[]',
  enviado_por uuid references usuario (id),
  enviado_em timestamptz not null default now(),
  unique (unidade_id, documento, versao)
);

create table documento_gerado (
  id uuid primary key default gen_random_uuid(),
  documento text not null check (documento in ('escala_publicada', 'efetivo_dia', 'escala_executada')),
  unidade_id uuid not null references unidade (id),
  escala_id uuid references escala (id),
  referencia date not null,
  modelo_id uuid not null references modelo_impressao (id),
  xlsx bytea not null,
  pdf bytea,
  gerado_por uuid references usuario (id),
  gerado_em timestamptz not null default now()
);
