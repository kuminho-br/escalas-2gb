-- Fase 4.2.3: o gestor escolhe quais escalas montam os blocos do dia no voluntariado (adendo de 19/11/2026 ao design do voluntariado
-- por faixa). Por padrão todas entram, que é o comportamento de antes: os cortes vinham de todos os serviços que pedem voluntariado.
alter table escala add column monta_blocos_voluntariado boolean not null default true;
