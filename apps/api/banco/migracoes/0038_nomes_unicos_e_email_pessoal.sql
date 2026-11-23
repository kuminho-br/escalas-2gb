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
