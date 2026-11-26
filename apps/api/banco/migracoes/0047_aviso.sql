-- Fase 6.56: o quadro de avisos da tela inicial. Um aviso é de uma unidade: os militares lotados nela e nas de baixo o veem. Quem o publicou fica em `autor_id`; o aviso retirado
-- não some do banco (sai das telas), e `vale_ate` é o último dia em que ele aparece (sem data, vale até alguém retirar).
create table aviso (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  autor_id uuid not null references usuario (id),
  titulo text not null check (char_length(titulo) between 1 and 80),
  texto text not null check (char_length(texto) between 1 and 400),
  fixado boolean not null default false,
  vale_ate date,
  publicado_em timestamptz not null default now(),
  retirado_em timestamptz,
  retirado_por uuid references usuario (id),
  check ((retirado_em is null) = (retirado_por is null))
);
create index aviso_da_unidade on aviso (unidade_id) where retirado_em is null;
create trigger auditoria_registro after insert or update or delete on aviso
  for each row execute function registrar_auditoria();
