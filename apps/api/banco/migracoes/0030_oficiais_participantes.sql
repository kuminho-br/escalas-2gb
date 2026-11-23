-- P1.5: ser QOC ou QOA torna o oficial elegível; quem participa da rodada do mês é quem o gestor marca.
-- Pode rodar de novo: a tabela e a carga conferem antes de mudar.

-- quem o gestor marcou para o mês; o id só serve à auditoria
create table if not exists oficiais_participante (
  id uuid not null default gen_random_uuid() unique,
  mes_id uuid not null references oficiais_mes (id) on delete cascade,
  militar_id uuid not null references militar (id),
  primary key (mes_id, militar_id)
);

-- os meses que já existem continuam como estavam: participa quem tem cota; no mês ainda sem cotas, todo elegível
-- (QOC ou QOA, com situação que deixa escalar e período na unidade ou abaixo dela no mês), que era a regra até aqui
insert into oficiais_participante (mes_id, militar_id)
select m.id, c.militar_id
  from oficiais_mes m join oficiais_cota c on c.mes_id = m.id
 where not exists (select 1 from oficiais_participante p where p.mes_id = m.id)
on conflict do nothing;
insert into oficiais_participante (mes_id, militar_id)
select distinct m.id, r.militar_id
  from oficiais_mes m
  join unidade alvo on alvo.id = m.unidade_id
  join rastreio r on r.desde <= (m.mes + interval '1 month' - interval '1 day')::date and (r.ate is null or r.ate >= m.mes)
  join unidade un on un.id = r.unidade_id and un.caminho <@ alvo.caminho
  join quadro q on q.id = r.quadro_id and q.sigla in ('QOC', 'QOA')
  join situacao_militar sm on sm.id = r.situacao_id and sm.escalavel
 where m.cotas_em is null
   and not exists (select 1 from oficiais_participante p where p.mes_id = m.id)
on conflict do nothing;

drop trigger if exists auditoria_registro on oficiais_participante;
create trigger auditoria_registro after insert or update or delete on oficiais_participante
  for each row execute function registrar_auditoria();
