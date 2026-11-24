-- Fase 6.21 (P1): a remoção guarda a vaga de onde o militar saiu (guarnição, função e as vagas acumuladas), para o "Desfazer" devolvê-lo ao mesmo lugar.
-- `devolvivel` só é verdadeiro nas remoções feitas daqui em diante: as antigas não guardam a vaga e continuam só com "Permitir de novo".

alter table remocao
  add column guarnicao_id uuid references guarnicao (id),
  add column funcao_id uuid references funcao (id),
  add column acumulos jsonb not null default '[]'::jsonb,
  add column devolvivel boolean not null default false;
