# Protótipo (Google Apps Script + Google Sheets)

Referência das regras do sistema de escalas. O sistema novo está em `apps/`, `pacotes/` e `docs/`. Este arquivo só vale ao mexer em `prototipo/`.

- Planilha sandbox: https://docs.google.com/spreadsheets/d/1mnXU3SBS7hUGrLpLIDLYnf1TWyGQqIxIVHm5T4rXglQ
- **Quem faz o `clasp push` e valida na sandbox é o usuário.** A equipe de programação testa só em ambiente virtual (`prototipo/testes/`, rodando em Node).

## Regras do clasp e do Apps Script

- `clasp push` roda a partir de `C:\projetos\escalas-2gb`, com `C:\` em maiúscula (`c:\` dá "Security Error: Content directory is a symlink").
- `.clasp.json` usa `"rootDir": "prototipo"`: o push envia só o que está em `prototipo/`. `.claspignore` deixa de fora `testes/`, `docs/`, `casos/`, `*.md` e `node_modules/`. Para conferir: `clasp show-file-status`.
- O Apps Script carrega todos os `.js`/`.gs` em **escopo global único**: não usar `require()` nem sintaxe Node nesses arquivos.
- Não montar fórmulas do Sheets como texto via Apps Script: usar condições nativas (independem do idioma da planilha).
- Testes do protótipo: `node scripts/testes-prototipo.mjs` (da raiz).

## Abas da planilha

| Aba | Descrição |
|---|---|
| CONFIGURAÇÕES | Parâmetros do sistema (CHAVE, VALOR, VIGÊNCIA, DESCRIÇÃO) |
| MILITARES | Cadastro dos militares (matrícula, posto, equipe, jornada, CNH, voluntário JES…) |
| VOLUNTARIADO | Formulário mensal (DATA `dd/mm/aaaa`, MATRÍCULA, TURNO, SERVIÇO ACEITO) |
| GUARNIÇÕES | Composição: função, mín., máx., CNH, viatura (opcional), prioridade |
| GUARNIÇÕES POR ESCALA | Vínculo ESCALA/TURNO → GUARNIÇÃO (uma linha por vínculo) |
| ESCALAS | Cadastro das escalas e seus serviços |
| TURNOS | Turnos de cada serviço (início, fim, duração) |
| COTAS | Cotas mensais de operações por SB |
| ALOCAÇÕES | Alocações efetivas (MATRÍCULA, DATA, SERVIÇO, TURNO, FUNÇÃO, UNIDADE) |
| GRADE GERAL | Grade visual da escala do mês |
| FERIADOS | Feriados cadastrados |

Nomes antigos (não usar): ALOCAÇÕES TABULADAS, ESCALA DO MÊS, GUARNIÇÃO, ESCALA OPERACIONAL, VIATURAS, MODELOS DE GUARNIÇÃO.

## Parâmetros (aba CONFIGURAÇÕES)

| Chave | Padrão | Descrição |
|---|---|---|
| `CARGA_MENSAL_HORAS` | 160 | Horas mensais de cada militar |
| `SALDOS_ADM_POR_MILITAR` | 6 | Saldos por militar do Adm no mês |
| `ADM_CUMPRE_CARGA` | false | Se false, o Adm só cumpre saldos; se true, cumpre também as 160 h |
| `SECAO_PADRAO` | `1ª SB` | Seção sugerida ao abrir os painéis |
| `LINHAS_POR_MILITAR` | 3 | Linhas por militar na grade geral |

Regra: serviço Diária não exige o status de voluntário JES (basta o formulário mensal); JES e PJES exigem o atributo "voluntário JES" no cadastro do militar.
