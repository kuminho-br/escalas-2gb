-- Fase 4.3.2.1: todo serviço conta para a meta de ativação (design de 20/11/2026): o campo da cota deixa de existir.
alter table cota drop column conta_meta;
