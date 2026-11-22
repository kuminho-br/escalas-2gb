-- P1.1: quadros QOC, QOA e QBMG. O posto-graduação pertence a quadros (o mesmo posto pode estar em mais de um) e todo militar tem um quadro.
-- Os quadros são fixos aqui, como a hierarquia de CNH; o cadastro deles nas Configurações fica para quando o QOD for modelado.
-- Pode rodar de novo: tabelas com "if not exists", inserções sem duplicar, restrição recriada.

create table if not exists quadro (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  ordem int not null unique
);

insert into quadro (sigla, nome, ordem) values
  ('QOC', 'Quadro de Oficiais Combatentes', 1),
  ('QOA', 'Quadro de Oficiais da Administração', 2),
  ('QBMG', 'Qualificação Bombeiro Militar Geral', 3)
on conflict (sigla) do nothing;

create table if not exists quadro_posto_grad (
  quadro_id uuid not null references quadro (id),
  posto_grad_id uuid not null references posto_grad (id),
  primary key (quadro_id, posto_grad_id)
);

-- Postos por quadro, do QOD. O ASP OF não aparece no QOD; entra no QOC.
insert into quadro_posto_grad (quadro_id, posto_grad_id)
select q.id, p.id
  from (values
    ('QOC', 'ASP OF BM'), ('QOC', '2º TEN BM'), ('QOC', '1º TEN BM'), ('QOC', 'CAP BM'), ('QOC', 'MAJ BM'), ('QOC', 'TEN CEL BM'), ('QOC', 'CEL BM'),
    ('QOA', '2º TEN BM'), ('QOA', '1º TEN BM'), ('QOA', 'CAP BM'), ('QOA', 'MAJ BM'),
    ('QBMG', 'SD BM'), ('QBMG', 'CB BM'), ('QBMG', '3º SGT BM'), ('QBMG', '2º SGT BM'), ('QBMG', '1º SGT BM'), ('QBMG', 'ST BM')
  ) as v (quadro, posto)
  join quadro q on q.sigla = v.quadro
  join posto_grad p on p.sigla = v.posto
on conflict do nothing;

alter table militar add column if not exists quadro_id uuid;

-- quadro nulo passa (MATCH SIMPLE); com quadro, o posto do militar precisa estar nele
alter table militar drop constraint if exists militar_posto_no_quadro;
alter table militar add constraint militar_posto_no_quadro
  foreign key (quadro_id, posto_grad_id) references quadro_posto_grad (quadro_id, posto_grad_id);

-- quem já está no banco recebe o quadro quando o posto só existe em um; os demais ficam sem, com a pendência "Sem quadro" na ficha
update militar m
   set quadro_id = (select qp.quadro_id from quadro_posto_grad qp where qp.posto_grad_id = m.posto_grad_id)
 where m.quadro_id is null
   and (select count(*) from quadro_posto_grad qp where qp.posto_grad_id = m.posto_grad_id) = 1;
