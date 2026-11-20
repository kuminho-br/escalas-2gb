-- Fase 4.3.2.2: meta de ativação (design de 20/11/2026). A meta é a lista de modelos de guarnição que a seção quer ativar num dia, na
-- ordem de ativação. Há a meta padrão, que vale de uma data em diante (uma versão por data), e os dias diferentes, cada um com a
-- lista própria (que pode ser vazia: dia sem meta). O dia diferente vale no lugar do padrão.

create table meta_padrao_versao (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  desde date not null,
  unique (unidade_id, desde)
);

create table meta_padrao_item (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references meta_padrao_versao (id) on delete cascade,
  guarnicao_id uuid not null references guarnicao (id),
  ordem int not null check (ordem >= 1),
  unique (versao_id, guarnicao_id),
  unique (versao_id, ordem)
);

create table meta_dia (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  data date not null,
  unique (unidade_id, data)
);

create table meta_dia_item (
  id uuid primary key default gen_random_uuid(),
  meta_dia_id uuid not null references meta_dia (id) on delete cascade,
  guarnicao_id uuid not null references guarnicao (id),
  ordem int not null check (ordem >= 1),
  unique (meta_dia_id, guarnicao_id),
  unique (meta_dia_id, ordem)
);

create trigger auditoria_registro after insert or update or delete on meta_padrao_versao
  for each row execute function registrar_auditoria();
create trigger auditoria_registro after insert or update or delete on meta_padrao_item
  for each row execute function registrar_auditoria();
create trigger auditoria_registro after insert or update or delete on meta_dia
  for each row execute function registrar_auditoria();
create trigger auditoria_registro after insert or update or delete on meta_dia_item
  for each row execute function registrar_auditoria();
