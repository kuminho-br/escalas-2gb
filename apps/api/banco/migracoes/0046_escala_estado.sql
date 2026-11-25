-- Fase 7.3.1: os estados da escala. A tabela `escala_previa` (7.3: existir a linha era estar com a prévia lançada) vira `escala_estado`, com uma linha por escala e mês: sem linha a escala é rascunho;
-- com linha, `estado` diz se é prévia, publicada, retificada ou remessada (decisões 9 a 17 do design de 25/11/2026). `em_retificacao` acende sozinho na primeira mudança de uma escala
-- publicada ou retificada, e apaga quando o gestor republica. A coluna `id` existe só para a auditoria gravar o registro (a chave é escala e mês).
create table escala_estado (
  id uuid not null unique default gen_random_uuid(),
  escala_id uuid not null references escala (id),
  mes date not null check (extract(day from mes) = 1),
  estado text not null check (estado in ('previa', 'publicada', 'retificada', 'remessada')),
  em_retificacao boolean not null default false check (not em_retificacao or estado in ('publicada', 'retificada')),
  mudou_por uuid references usuario (id),
  mudou_em timestamptz not null default now(),
  primary key (escala_id, mes)
);
create trigger auditoria_registro after insert or update or delete on escala_estado
  for each row execute function registrar_auditoria();

-- as prévias já lançadas continuam prévias, com quem lançou e quando
insert into escala_estado (escala_id, mes, estado, mudou_por, mudou_em)
select escala_id, mes, 'previa', lancada_por, lancada_em from escala_previa;
drop table escala_previa;
