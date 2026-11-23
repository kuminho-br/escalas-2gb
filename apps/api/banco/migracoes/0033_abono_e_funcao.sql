-- Entrega 6.15: o abono de permanência (sim ou não) e a função do militar. A função vem de um catálogo das Configurações (até o QOD ser modelado);
-- não é a função da guarnição (tabela `funcao`, que não muda). A função pode ficar vazia até ser preenchida, como o e-mail.
-- Pode rodar de novo: tabela e colunas só são criadas se faltarem.
create table if not exists funcao_militar (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);
-- o nome é único sem diferenciar maiúsculas
create unique index if not exists funcao_militar_nome_unico on funcao_militar (lower(nome));

alter table militar add column if not exists funcao_militar_id uuid references funcao_militar (id);
alter table militar add column if not exists abono_permanencia boolean not null default false;

drop trigger if exists auditoria_registro on funcao_militar;
create trigger auditoria_registro after insert or update or delete on funcao_militar
  for each row execute function registrar_auditoria();
