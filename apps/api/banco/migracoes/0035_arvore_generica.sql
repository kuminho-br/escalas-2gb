-- Entrega 6.25: a árvore de unidades fica genérica. O tipo da unidade (grupamento, divisão, seção…) vira só um nome: qualquer tipo fica abaixo de qualquer
-- tipo, a ordem dos tipos serve só para ordenar listas, e o quinto nível de acesso (antes "chefe de divisão") passa a valer em qualquer unidade.
-- Pode rodar de novo: nada é duplicado nem perdido.

-- 1. tipo_unidade: ganha "id" (a auditoria exige), "nivel" vira "ordem" e deixa de ser único
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'tipo_unidade' and column_name = 'nivel') then
    alter table tipo_unidade rename column nivel to ordem;
  end if;
end $$;
alter table tipo_unidade drop constraint if exists tipo_unidade_nivel_key;
alter table tipo_unidade add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists tipo_unidade_id_key on tipo_unidade (id);

-- a auditoria dos tipos fica ligada (a 0031 a desligava na troca de ordem, porque o tipo não tinha id)
drop trigger if exists auditoria_registro on tipo_unidade;
create trigger auditoria_registro after insert or update or delete on tipo_unidade
  for each row execute function registrar_auditoria();

-- 2. a unidade fica abaixo de qualquer tipo: sai a regra do nível; fica a do ciclo
create or replace function unidade_montar_caminho() returns trigger language plpgsql as $$
declare
  mae record;
  rotulo text := replace(new.id::text, '-', '_');
begin
  if new.mae_id is null then
    new.caminho := rotulo::ltree;
    return new;
  end if;
  select u.caminho into mae from unidade u where u.id = new.mae_id;
  if mae.caminho ~ ('*.' || rotulo || '.*')::lquery then
    raise exception 'Uma unidade não pode ficar abaixo de si mesma';
  end if;
  new.caminho := mae.caminho || rotulo::ltree;
  return new;
end $$;

-- 3. a sigla não se repete entre irmãs ativas (mesma unidade de cima), sem diferenciar maiúsculas
do $$
declare
  repetidas text;
begin
  select string_agg(distinct sigla, ', ') into repetidas from (
    select min(sigla) as sigla from unidade where ate is null and mae_id is not null group by mae_id, lower(sigla) having count(*) > 1
  ) x;
  if repetidas is not null then
    raise exception 'Há unidades ativas com a mesma sigla debaixo da mesma unidade (%). Renomeie ou extinga uma delas e rode a migração de novo.', repetidas;
  end if;
end $$;
create unique index if not exists unidade_sigla_entre_irmas on unidade (mae_id, lower(sigla)) where ate is null;

-- 4. o quinto nível de acesso: chefe_divisao -> gestor_lateral, em qualquer unidade menos a raiz
alter table papel_usuario drop constraint if exists papel_usuario_papel_check;
update papel_usuario set papel = 'gestor_lateral' where papel = 'chefe_divisao';
alter table papel_usuario add constraint papel_usuario_papel_check check (papel in ('administrador', 'gestor', 'gestor_lateral', 'escalante'));

drop trigger if exists papel_chefe_divisao on papel_usuario;
drop function if exists papel_chefe_na_divisao();

create or replace function papel_gestor_lateral_fora_da_raiz() returns trigger language plpgsql as $$
begin
  if new.papel = 'gestor_lateral'
     and exists (select 1 from unidade where id = new.unidade_id and mae_id is null) then
    raise exception 'O nível não existe na unidade raiz.';
  end if;
  return new;
end $$;

drop trigger if exists papel_gestor_lateral on papel_usuario;
create trigger papel_gestor_lateral before insert or update on papel_usuario
  for each row execute function papel_gestor_lateral_fora_da_raiz();

-- 5. a camada da borda de "Quem vê o quê" muda de nome junto
alter table visao_bloco drop constraint if exists visao_bloco_camada_check;
update visao_bloco set camada = 'gestor_lateral' where camada = 'chefe_divisao';
alter table visao_bloco add constraint visao_bloco_camada_check check (camada in ('todos', 'oficial', 'gestor_lateral'));
