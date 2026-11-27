-- A marca de teste (6.58): o que é de teste é dito por esta coluna, nunca pela matrícula (a matrícula 990xxx-x é de militar real).
-- Quem grava `true`: só a carga do espelho (schema `laboratorio`) e o passo `--marcar` do script `separar-teste`, que marca quem a auditoria prova
-- que nasceu com o nome da carga de exemplo. A API e a importação não leem nem gravam esta coluna: militar criado ou editado por elas fica `false`.
alter table militar add column de_teste boolean not null default false;
