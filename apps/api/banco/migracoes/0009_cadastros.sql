-- Cadastros (fase 3; adendo de 17/11/2026): catálogos do sistema, atividade da guarnição,
-- feriado fixo e atores (chefe vira gestor; administrador só na raiz).

create table tipo_afastamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  ativo boolean not null default true
);
create unique index tipo_afastamento_nome on tipo_afastamento (lower(nome));
insert into tipo_afastamento (nome) values ('Férias'), ('LTS'), ('Curso'), ('Outro');

create table atividade (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  ativo boolean not null default true
);
create unique index atividade_nome on atividade (lower(nome));
insert into atividade (nome) values ('Incêndio'), ('APH'), ('Salvamento'), ('Apoio operacional');

create trigger auditoria_registro after insert or update or delete on tipo_afastamento
  for each row execute function registrar_auditoria();
create trigger auditoria_registro after insert or update or delete on atividade
  for each row execute function registrar_auditoria();

-- afastamento: o tipo fixo vira referência ao catálogo
alter table afastamento add column tipo_afastamento_id uuid references tipo_afastamento (id);
update afastamento a
   set tipo_afastamento_id = t.id
  from tipo_afastamento t
 where t.nome = case a.tipo when 'ferias' then 'Férias' when 'licenca' then 'LTS' else 'Outro' end;
alter table afastamento alter column tipo_afastamento_id set not null;
alter table afastamento drop column tipo;

alter table guarnicao add column atividade_id uuid references atividade (id);
alter table feriado add column fixo boolean not null default true;

-- atores: chefe vira gestor
alter table papel_usuario drop constraint papel_usuario_papel_check;
update papel_usuario set papel = 'gestor' where papel = 'chefe';
alter table papel_usuario add constraint papel_usuario_papel_check check (papel in ('administrador', 'gestor', 'escalante'));

alter table convite drop constraint convite_papel_check;
update convite set papel = 'gestor' where papel = 'chefe';
alter table convite add constraint convite_papel_check check (papel in ('administrador', 'gestor', 'escalante'));

create function papel_administrador_na_raiz() returns trigger language plpgsql as $$
begin
  if new.papel = 'administrador'
     and exists (select 1 from unidade where id = new.unidade_id and mae_id is not null) then
    raise exception 'O papel de administrador só existe na unidade raiz';
  end if;
  return new;
end $$;

create trigger papel_administrador before insert or update on papel_usuario
  for each row execute function papel_administrador_na_raiz();
create trigger convite_administrador before insert or update on convite
  for each row execute function papel_administrador_na_raiz();
