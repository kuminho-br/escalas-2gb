-- Entrega 6.64: as equipes como cadastro. Cada equipe tem tipo (pronto, adm ou externa) e, no Pronto, a posição no ciclo (1 a 4); as padrão são da corporação (unidade raiz)
-- e as unidades as herdam; a unidade pode criar equipes do tipo adm. `unidade_id` passa a dizer onde a equipe foi criada.
-- Roda numa transação só (a do migrador): se algo não casar, falha inteira. Sem `public.` (vale para o real e para o espelho) e idempotente.
-- A única coluna que aponta para `equipe` é `rastreio.equipe_id` (conferido no catálogo; o teste da migração o vigia): voluntariado, pré-escala e alocação não guardam a equipe.

-- 1. a tabela: tipo, posição do ciclo (a coluna `ordem_ciclo` renomeada) e ativa
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'equipe' and column_name = 'tipo') then
    alter table equipe add column tipo text;
    alter table equipe alter column ordem_ciclo drop not null;
    alter table equipe rename column ordem_ciclo to posicao_ciclo;
    alter table equipe add column ativa boolean not null default true;
  end if;
end $$;

-- 2. o rastreio aceita a equipe da própria unidade ou de uma acima (a mesma herança dos feriados), nunca a Externa, e só ativa quando a equipe entra ou muda.
-- Vem antes do dado: reapontar o rastreio para a equipe da corporação passa por esta regra.
create or replace function rastreio_equipe_da_unidade() returns trigger language plpgsql as $$
declare
  e record;
begin
  if new.equipe_id is null then
    return new;
  end if;
  select q.tipo, q.ativa, q.unidade_id into e from equipe q where q.id = new.equipe_id;
  if not exists (select 1 from unidade a join unidade u on u.id = new.unidade_id where a.id = e.unidade_id and a.caminho @> u.caminho) then
    raise exception 'A equipe precisa ser da unidade da lotação ou de uma acima dela';
  end if;
  if e.tipo = 'externa' then
    raise exception 'A Externa só se põe pelo botão Trazer.';
  end if;
  if (tg_op = 'INSERT' or new.equipe_id is distinct from old.equipe_id) and not e.ativa then
    raise exception 'Esta equipe está desativada.';
  end if;
  return new;
end $$;

-- 3. os dados: as seis padrão na corporação; o rastreio das equipes antigas das unidades vai para a padrão da mesma posição; as que sobram ficam desativadas
do $$
declare
  raiz uuid;
  padrao record;
  antiga record;
  unidade_atual text;
  sobras text;
  renomeadas text;
begin
  select id into raiz from unidade where mae_id is null limit 1;
  if raiz is null then
    return; -- banco sem unidades (o espelho vazio): nada a migrar; a carga cria as padrão
  end if;

  -- as da raiz que já estavam no ciclo viram as padrão do Pronto, com o nome que tinham
  update equipe set tipo = 'pronto' where tipo is null and unidade_id = raiz and posicao_ciclo between 1 and 4;
  -- as demais da raiz (posição maior que 4) sobram, desativadas
  update equipe set tipo = 'adm', posicao_ciclo = null, ativa = false where tipo is null and unidade_id = raiz;

  -- as que faltam entre as seis padrão (um nome que já exista na raiz derruba a migração inteira: a unique do nome avisa)
  insert into equipe (unidade_id, nome, tipo, posicao_ciclo)
  select raiz, v.nome, v.tipo, v.posicao
    from (values ('Alfa', 'pronto', 1), ('Bravo', 'pronto', 2), ('Charlie', 'pronto', 3), ('Delta', 'pronto', 4), ('ADM', 'adm', null::int), ('Externa', 'externa', null::int)) as v(nome, tipo, posicao)
   where not exists (
     select 1 from equipe e where e.unidade_id = raiz and e.tipo = v.tipo and (v.tipo <> 'pronto' or e.posicao_ciclo = v.posicao) and (v.tipo <> 'adm' or e.ativa)
   );

  -- cada equipe antiga de unidade, na posição de 1 a 4: o rastreio dela vai para a padrão da mesma posição, e a linha antiga sai
  for antiga in select e.id, e.nome, e.posicao_ciclo, e.unidade_id from equipe e where e.tipo is null and e.unidade_id <> raiz and e.posicao_ciclo between 1 and 4 order by e.unidade_id, e.posicao_ciclo loop
    select id, nome into padrao from equipe where unidade_id = raiz and tipo = 'pronto' and posicao_ciclo = antiga.posicao_ciclo;
    if padrao.id is null then
      raise exception 'Falta a equipe padrão da posição % na corporação', antiga.posicao_ciclo;
    end if;
    if lower(padrao.nome) <> lower(antiga.nome) then
      select sigla into unidade_atual from unidade where id = antiga.unidade_id;
      renomeadas := coalesce(renomeadas || '; ', '') || format('%s: "%s" (posição %s) agora é "%s"', unidade_atual, antiga.nome, antiga.posicao_ciclo, padrao.nome);
    end if;
    update rastreio set equipe_id = padrao.id where equipe_id = antiga.id;
    delete from equipe where id = antiga.id;
  end loop;

  -- as que sobram (posição maior que 4): desativadas, e o rastreio delas continua apontando para elas (histórico)
  update equipe set tipo = 'adm', posicao_ciclo = null, ativa = false where tipo is null;

  -- o relatório de quem migra: casar as linhas é dele (decisão de 21/11)
  for unidade_atual, sobras in
    select u.sigla, string_agg(e.nome, ', ' order by e.nome) from equipe e join unidade u on u.id = e.unidade_id where e.unidade_id <> raiz and not e.ativa group by u.sigla order by u.sigla
  loop
    raise notice 'Equipes que sobraram na unidade % (desativadas, com o histórico): %', unidade_atual, sobras;
  end loop;
  if renomeadas is not null then
    raise notice 'Equipes com nome diferente do padrão: %', renomeadas;
  end if;
end $$;

-- 4. as regras da tabela
alter table equipe alter column tipo set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = to_regclass(current_schema() || '.equipe') and conname = 'equipe_tipo_valido') then
    alter table equipe add constraint equipe_tipo_valido check (tipo in ('pronto', 'adm', 'externa'));
    alter table equipe add constraint equipe_posicao_do_pronto check ((tipo = 'pronto') = (posicao_ciclo is not null) and (posicao_ciclo is null or posicao_ciclo between 1 and 4));
  end if;
end $$;
-- a Externa é uma só, da corporação
create unique index if not exists equipe_uma_externa on equipe (tipo) where tipo = 'externa';
