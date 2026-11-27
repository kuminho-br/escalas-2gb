-- Entrar no Laboratório (6.59): a ligação entre a conta real e o perfil de teste que ela escolheu. A conta é do real (`usuario_id`); o perfil é um usuário do
-- espelho (schema `laboratorio`), de outro mundo, e por isso `perfil_id` não tem chave estrangeira. A tabela existe também no espelho, sem uso lá.
create table laboratorio_sessao (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  perfil_id uuid not null,
  desde timestamptz not null default now()
);
