-- Entrega 6.27: a escala dos oficiais passa a ser uma escala comum. Cada lançamento vira uma alocação de uma escala com `distribuicao = 'rodada_de_cotas'`
-- (serviços JES, lançado à mão, e Saldo, distribuído pela rodada de cotas); a rodada (`oficiais_*`) liga-se à escala, e não mais a um serviço.
-- Nenhum lançamento, cobertura ou saldo dos meses gravados se perde. Pode rodar de novo: nada é duplicado.

-- 1. o jeito de distribuir de uma escala: as de hoje são pré-escala; a dos oficiais é uma rodada de cotas
alter table escala add column if not exists distribuicao text not null default 'pre_escala';
alter table escala drop constraint if exists escala_distribuicao_check;
alter table escala add constraint escala_distribuicao_check check (distribuicao in ('pre_escala', 'rodada_de_cotas'));

-- 2. o mês da rodada fica ligado a uma escala
alter table oficiais_mes add column if not exists escala_id uuid references escala (id);

-- 3. a troca de nome depois de fechada a escala (cobertura): quem saiu do lugar; o id só serve à auditoria
create table if not exists oficiais_cobertura (
  id uuid not null default gen_random_uuid() unique,
  alocacao_id uuid primary key references alocacao (id) on delete cascade,
  saiu_militar_id uuid not null references militar (id)
);
drop trigger if exists auditoria_registro on oficiais_cobertura;
create trigger auditoria_registro after insert or update or delete on oficiais_cobertura
  for each row execute function registrar_auditoria();

-- 4. os meses gravados passam para a escala nova (só enquanto a tabela antiga dos turnos existe)
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = current_schema() and table_name = 'oficiais_turno') then
    return;
  end if;

  -- a escala "Oficiais de operações" de cada unidade com mês gravado, com os serviços que os meses usavam (o do mês mais recente primeiro: é o serviço de Saldo)
  insert into escala (unidade_id, nome, titulo, militares_doc, dias_doc, ativa, monta_blocos_voluntariado, distribuicao)
  select distinct unidade_id, 'Oficiais de operações', 'ESCALA OFICIAIS DE OPERAÇÕES', 'escalados', 'com_escalados', true, false, 'rodada_de_cotas'
    from oficiais_mes
  on conflict (unidade_id, nome) do update set distribuicao = 'rodada_de_cotas';

  insert into escala_servico (escala_id, servico_id, ordem)
  select e.id, x.servico_id,
         coalesce((select max(es.ordem) from escala_servico es where es.escala_id = e.id), 0) + row_number() over (partition by e.id order by x.ultimo_mes desc, x.servico_id)
    from (select unidade_id, servico_id, max(mes) as ultimo_mes from oficiais_mes where servico_id is not null group by unidade_id, servico_id) x
    join escala e on e.unidade_id = x.unidade_id and e.nome = 'Oficiais de operações'
  on conflict do nothing;

  update oficiais_mes m set escala_id = e.id
    from escala e where e.unidade_id = m.unidade_id and e.nome = 'Oficiais de operações' and m.escala_id is null;

  -- cada turno com nome vira uma alocação da rodada; o lugar vazio deixa de existir (todo dia tem um lugar por letra)
  insert into alocacao (militar_id, escala_id, servico_id, turno_id, data, origem)
  select t.militar_id, m.escala_id, m.servico_id, t.turno_id, t.dia, 'distribuicao'
    from oficiais_turno t join oficiais_mes m on m.id = t.mes_id
   where t.militar_id is not null and m.servico_id is not null
  on conflict (militar_id, data, servico_id, turno_id) do nothing;

  insert into oficiais_cobertura (alocacao_id, saiu_militar_id)
  select a.id, t.saiu_militar_id
    from oficiais_turno t
    join oficiais_mes m on m.id = t.mes_id
    join alocacao a on a.escala_id = m.escala_id and a.servico_id = m.servico_id and a.turno_id = t.turno_id and a.data = t.dia and a.militar_id = t.militar_id
   where t.saiu_militar_id is not null
  on conflict do nothing;

  drop table oficiais_turno;

  -- "Calcular cotas" vira "Abrir o mês": os meses com cotas viram abertos
  alter table oficiais_mes drop constraint if exists oficiais_mes_unidade_id_mes_key;
  alter table oficiais_mes drop column servico_id;
  alter table oficiais_mes rename column cotas_em to aberto_em;
  alter table oficiais_mes alter column escala_id set not null;
  alter table oficiais_mes add constraint oficiais_mes_escala_id_mes_key unique (escala_id, mes);
end $$;
