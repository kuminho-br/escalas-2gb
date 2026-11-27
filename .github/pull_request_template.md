## Resumo


## Migração
- [ ] Este PR **não** tem migração nova (`apps/api/banco/migracoes/`).
- [ ] Este PR **tem** migração: depois do merge, rodar `pnpm --filter api db:migrar:teste` no ambiente de teste (as migrações valem para o real e para o espelho do Laboratório, no mesmo passo). Até lá, a API responde 503 com "banco desatualizado".

## Testes
- [ ] `pnpm test`
- [ ] `pnpm typecheck`
