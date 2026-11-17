-- Carga base: estrutura de unidades e postos/graduações (dados institucionais, não pessoais)
insert into unidade (tipo, sigla, nome, desde)
values ('corporacao', 'CBMPE', 'Corpo de Bombeiros Militar de Pernambuco', '2026-11-01');

insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'diretoria_geral', 'DGO', 'Diretoria Geral de Operações', id, '2026-11-01' from unidade where sigla = 'CBMPE';

insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'diretoria_integrada', v.sigla, v.nome, u.id, '2026-11-01'
  from unidade u,
       (values ('DIM', 'Diretoria Integrada Metropolitana'),
               ('DInter/1', 'Diretoria Integrada do Interior 1'),
               ('DInter/2', 'Diretoria Integrada do Interior 2')) as v (sigla, nome)
 where u.sigla = 'DGO';

insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'grupamento', '2º GB', '2º Grupamento de Bombeiros', id, '2026-11-01' from unidade where sigla = 'DInter/1';

insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'secao', '1ª SB', '1ª Seção de Bombeiros', id, '2026-11-01' from unidade where sigla = '2º GB';

insert into posto_grad (sigla, nome, ordem) values
  ('SD BM', 'Soldado', 1),
  ('CB BM', 'Cabo', 2),
  ('3º SGT BM', '3º Sargento', 3),
  ('2º SGT BM', '2º Sargento', 4),
  ('1º SGT BM', '1º Sargento', 5),
  ('ST BM', 'Subtenente', 6),
  ('ASP OF BM', 'Aspirante a Oficial', 7),
  ('2º TEN BM', '2º Tenente', 8),
  ('1º TEN BM', '1º Tenente', 9),
  ('CAP BM', 'Capitão', 10),
  ('MAJ BM', 'Major', 11),
  ('TEN CEL BM', 'Tenente-Coronel', 12),
  ('CEL BM', 'Coronel', 13);
