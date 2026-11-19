-- Fase 4.2.2: a disponibilidade do voluntariado passa de turno padrão A/B para faixas de horário por dia (design de 19/11/2026).
-- O militar diz quando pode, sem escolher operação; a tela desenha os blocos tirados dos horários dos serviços que pedem voluntariado.
-- Guarda-se o horário (minutos do dia, de 0 a 1440), não a letra do bloco: trocar a tela no futuro não exige refazer dados.

create table disponibilidade (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  data date not null,
  inicio_min int not null,
  fim_min int not null,
  origem text not null check (origem in ('manual', 'importacao', 'militar')),
  check (inicio_min >= 0 and inicio_min < fim_min and fim_min <= 1440),
  unique (militar_id, data, inicio_min)
);
create index disponibilidade_militar_data on disponibilidade (militar_id, data);

-- o que já foi lançado: A (08h às 20h) vira 480–1200; B (20h às 08h) vira 1200–1440 no dia e 0–480 no dia seguinte (que pode ser do mês seguinte)
insert into disponibilidade (militar_id, data, inicio_min, fim_min, origem)
select militar_id, data, 480, 1200, origem from voluntariado where turno_padrao = 'A'
union all
select militar_id, data, 1200, 1440, origem from voluntariado where turno_padrao = 'B'
union all
select militar_id, data + 1, 0, 480, origem from voluntariado where turno_padrao = 'B';

drop table voluntariado;

create trigger auditoria_registro after insert or update or delete on disponibilidade
  for each row execute function registrar_auditoria();
