-- Entrega 3.1 (17/11/2026): não existe "sem limite" no sistema novo; máximo vazio vale o mínimo.
update composicao set maximo = minimo where maximo is null;
alter table composicao alter column maximo set not null;
