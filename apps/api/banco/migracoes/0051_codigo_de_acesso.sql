-- Fase 6.68: o código de acesso por e-mail (primeiro acesso, "Esqueci minha senha"). Escrita sem nome de schema e sem consultar o catálogo fora de current_schema(): vale para o banco real e para o espelho.
--
-- `pedido_de_codigo` é o registro do pedido (com a auditoria de sempre) e serve aos limites e à cota do dia: guarda só o resumo (HMAC) do e-mail e da origem, nunca o código.
-- `codigo_de_acesso` guarda o resumo do código vivo de cada militar e fica FORA da auditoria (como `conta` e `sessao`): o pedido novo substitui o anterior.
create table pedido_de_codigo (
  id uuid primary key default gen_random_uuid(),
  email_resumo text not null,
  origem_resumo text,
  -- só quando o e-mail é de uma ficha que pode receber o código
  militar_id uuid references militar (id) on delete set null,
  -- nao_enviado: o e-mail não é de ninguém que possa receber (a resposta é a mesma)
  situacao text not null check (situacao in ('enviado', 'nao_enviado', 'falhou', 'concluido')),
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  check ((situacao = 'concluido') = (concluido_em is not null))
);
create index pedido_de_codigo_do_email on pedido_de_codigo (email_resumo, criado_em);
create index pedido_de_codigo_da_origem on pedido_de_codigo (origem_resumo, criado_em);
create index pedido_de_codigo_do_dia on pedido_de_codigo (criado_em) where situacao in ('enviado', 'concluido');
create trigger auditoria_registro after insert or update or delete on pedido_de_codigo
  for each row execute function registrar_auditoria();

create table codigo_de_acesso (
  militar_id uuid primary key references militar (id) on delete cascade,
  pedido_id uuid not null references pedido_de_codigo (id),
  codigo_resumo text not null,
  vale_ate timestamptz not null,
  tentativas int not null default 0 check (tentativas >= 0)
);
