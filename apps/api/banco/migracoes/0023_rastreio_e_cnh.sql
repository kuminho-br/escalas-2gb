-- Fase 5, entrega 1: "lotação" passa a ser só a unidade. A tabela que guardava lotação + equipe + jornada no tempo
-- vira o RASTREIO do militar (mesmas colunas, mesmas regras, mesmos períodos), e a CNH deixa de depender do quadro de motoristas.
-- Cada passo confere antes de mudar: o arquivo pode rodar de novo num ambiente que já foi migrado à mão.

do $$
declare
  c record;
begin
  if to_regclass('lotacao') is not null and to_regclass('rastreio') is null then
    alter table lotacao rename to rastreio;
  end if;
  -- restrições (a de não sobrepor e as de chave arrastam o índice junto) com o nome novo
  for c in select conname from pg_constraint where conrelid = to_regclass('rastreio') and conname like 'lotacao%' loop
    execute format('alter table rastreio rename constraint %I to %I', c.conname, 'rastreio' || substr(c.conname, length('lotacao') + 1));
  end loop;
  if exists (select 1 from pg_trigger where tgrelid = to_regclass('rastreio') and tgname = 'lotacao_equipe') then
    alter trigger lotacao_equipe on rastreio rename to rastreio_equipe;
  end if;
  if to_regprocedure('lotacao_equipe_da_unidade()') is not null then
    alter function lotacao_equipe_da_unidade() rename to rastreio_equipe_da_unidade;
  end if;
  -- a CNH é do militar, esteja ou não no quadro de motoristas: sai "motorista or cardinality(cnh) = 0"
  for c in select conname from pg_constraint where conrelid = 'militar'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%cardinality%' loop
    execute format('alter table militar drop constraint %I', c.conname);
  end loop;
end $$;

-- a auditoria acha a unidade de um registro do militar pelo rastreio mais recente (o corpo da função citava a tabela antiga)
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

-- as sete seções do 2º GB (a 1ª SB já existe): 2ª a 7ª, no mesmo mês de criação do 2º GB, só as que ainda não existem
insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'secao', v.sigla, v.nome, g.id, g.desde
  from unidade g,
       (values ('2ª SB', '2ª Seção de Bombeiros'), ('3ª SB', '3ª Seção de Bombeiros'), ('4ª SB', '4ª Seção de Bombeiros'),
               ('5ª SB', '5ª Seção de Bombeiros'), ('6ª SB', '6ª Seção de Bombeiros'), ('7ª SB', '7ª Seção de Bombeiros')) as v (sigla, nome)
 where g.sigla = '2º GB'
   and not exists (select 1 from unidade x where x.sigla = v.sigla);
