-- Entrega 6.18: (1) o nome de serviço, escala, guarnição, função e equipe é único na unidade sem diferenciar a caixa, e o banco é quem garante (a conferência
-- do site e da API fica no mesmo comando da gravação: dois pedidos ao mesmo tempo, o segundo é recusado). (2) o e-mail pessoal do militar, opcional.
-- Se uma unidade já tem dois nomes que só diferem na caixa, o índice dela não é criado (a migração não derruba o sistema): a conferência da API continua valendo,
-- e o aviso diz qual tabela ficou sem o índice, para quem migra desfazer a repetição e rodar de novo o bloco.
do $$
declare
  alvo text;
  repetidos int;
begin
  foreach alvo in array array['servico', 'escala', 'guarnicao', 'funcao', 'equipe'] loop
    if exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = alvo) then
      if exists (select 1 from pg_indexes where schemaname = current_schema() and indexname = alvo || '_unidade_nome_sem_caixa') then
        continue;
      end if;
      execute format('select count(*) from (select 1 from %I group by unidade_id, lower(nome) having count(*) > 1) d', alvo) into repetidos;
      if repetidos > 0 then
        raise warning 'Migração 0038: % tem nomes repetidos que só diferem na caixa; o índice de nome único sem caixa não foi criado.', alvo;
      else
        execute format('create unique index %I on %I (unidade_id, lower(nome))', alvo || '_unidade_nome_sem_caixa', alvo);
      end if;
    end if;
  end loop;
end $$;

alter table militar add column if not exists email_pessoal text;

-- (3) a auditoria de uma tabela sem `id` (chave própria, como o `codigo` do tipo de unidade antigo) usa o `codigo` como identificador do registro, em vez de quebrar a gravação
-- (corpo da 0027, com o `codigo` a mais no identificador)
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
    coalesce(r ->> 'id', r ->> 'codigo', (r ->> 'escala_id') || ':' || (r ->> 'servico_id')),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end $$;
