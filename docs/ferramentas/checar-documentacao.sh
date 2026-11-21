#!/usr/bin/env bash
# Checagem da documentação (régua em docs/LEIAME.md). Roda da raiz do repositório e imprime o relatório em Markdown.
# Uso: bash docs/ferramentas/checar-documentacao.sh > docs/relatorio-documentacao.md
# Limites conhecidos: cercas de código indentadas e nomes de arquivo com espaço ou acento não são tratados.
set -u
export LC_ALL=C.UTF-8
cd "$(git rev-parse --show-toplevel)"
LIM_KB=25; CRIT_KB=50; LIM_PAR=400; LIM_ADENDOS=3; LIM_CLAUDE=120
mds=$( { git ls-files -co --exclude-standard 'docs/*.md' 'docs/**/*.md' '*.md' | sort -u; } | grep -v '^pr_' )
# planos de fase e de revisão são temporários e se dividem por entrega: ficam fora da medida de tamanho e de parágrafo (decisão do usuário, 20/11/2026)
lidos=$(echo "$mds" | grep -vE '^docs/superpowers/plans/' ; echo "$mds" | grep -E '^docs/superpowers/plans/.*roadmap')
claude_falhas=0
cont=$(mktemp); corpo=$(mktemp)
alerta() { echo x >> "$cont"; echo "- $*"; }
secao() { echo; echo "## $1"; echo; }

# 1. Tamanho
{
secao "Documentos grandes (acima de ${LIM_KB} KB)"
achou=0
for f in $lidos; do
  b=$(wc -c < "$f"); kb=$((b/1024))
  if [ "$b" -gt $((CRIT_KB*1024)) ]; then alerta "**crítico** \`$f\`: ${kb} KB"; achou=1
  elif [ "$b" -gt $((LIM_KB*1024)) ]; then alerta "\`$f\`: ${kb} KB"; achou=1; fi
done
[ $achou = 0 ] && echo "Nenhum."
} >> "$corpo"

# 2. Parágrafos longos (fora de tabela e de bloco de código)
{
secao "Parágrafos com mais de ${LIM_PAR} caracteres"
n=$(for f in $lidos; do awk -v L=$LIM_PAR -v F="$f" '/^```/{c=!c;next} !c && !/^\|/ && length($0)>L {n++} END{if(n>0) print n"\t"F}' "$f"; done | sort -rn)
if [ -z "$n" ]; then echo "Nenhum."; else echo "$n" | while IFS=$'\t' read -r q f; do alerta "\`$f\`: $q parágrafo(s)"; done; fi
} >> "$corpo"

# 3. Adendos
{
secao "Documentos com mais de ${LIM_ADENDOS} adendos"
achou=0
for f in $mds; do
  q=$(grep -ciE '^#{1,4} adendo' "$f"); [ "$q" -gt $LIM_ADENDOS ] && { alerta "\`$f\`: $q adendos (consolidar)"; achou=1; }
done
[ $achou = 0 ] && echo "Nenhum."
} >> "$corpo"

# 4. CLAUDE.md
{
secao "CLAUDE.md"
linhas=$(wc -l < CLAUDE.md); echo "- Linhas: $linhas (limite $LIM_CLAUDE)"
[ "$linhas" -gt $LIM_CLAUDE ] && claude_falhas=$((claude_falhas+1))
env='Estado atual|[0-9]+ ok\b|[0-9]+ (arquivos|testes|migra)'
if grep -qiE "$env" CLAUDE.md; then echo "- Tem \"estado atual\" ou número que envelhece: $(grep -ciE "$env" CLAUDE.md) linha(s)"; claude_falhas=$((claude_falhas+1)); else echo "- Sem \"estado atual\" nem número que envelhece."; fi
quebrados=$(grep -ohE '`(apps|pacotes|docs|prototipo|casos|scripts)/[^` ]*`' CLAUDE.md prototipo/CLAUDE.md | tr -d '`' | sort -u | while read -r p; do [ -e "$p" ] || echo "$p"; done)
if [ -n "$quebrados" ]; then echo "- Caminhos que não existem:"; echo "$quebrados" | sed 's/^/  - `/;s/$/`/'; claude_falhas=$((claude_falhas+1)); else echo "- Todos os caminhos citados existem."; fi
if [ $claude_falhas -eq 0 ]; then nota="bom"; elif [ $claude_falhas -eq 1 ]; then nota="regular"; else nota="insatisfatório"; fi
echo "- **Nota: $nota**"
echo "$nota" > "$corpo.nota"
for _ in $(seq $claude_falhas); do echo x >> "$cont"; done
} >> "$corpo"

# 5. Esquema do banco x migrações
{
secao "Esquema do banco × migrações"
f=docs/superpowers/specs/2026-11-16-esquema-banco.md
falta=$(grep -hoiE 'create table (if not exists )?[a-z0-9_."]+' apps/api/banco/migracoes/*.sql | awk '{print $NF}' | tr -d '"' | sed 's/.*\.//' | sort -u | while read -r t; do grep -qE "^### .*\b$t\b" "$f" || echo "$t"; done)
ult=$(ls apps/api/banco/migracoes | tail -1)
echo "Última migração: \`$ult\`."
if [ -z "$falta" ]; then echo "Toda tabela tem título no esquema."; else echo "$falta" | while read -r t; do alerta "tabela sem título no esquema: \`$t\`"; done; fi
grep -q "${ult%.sql}" "$f" || alerta "o esquema não cita a última migração (\`$ult\`)"
} >> "$corpo"

# 6. Índice x arquivos e links de todos os documentos
{
secao "Índice e links"
achou=0
for f in $(git ls-files -co --exclude-standard 'docs/*.md' 'docs/*.html' 'docs/**/*.md' 'docs/**/*.html'); do
  rel=${f#docs/}; [ "$rel" = LEIAME.md ] && continue
  grep -qF "$rel" docs/LEIAME.md && continue
  d=$(dirname "$f")
  if [ "$d" != docs ] && [ -f "$d/LEIAME.md" ] && grep -qF "$(basename "$f")" "$d/LEIAME.md"; then continue; fi
  alerta "fora do índice: \`$f\`"; achou=1
done
for m in $mds; do
  d=$(dirname "$m")
  sed 's/`[^`]*`//g' "$m" | grep -oE '\]\([^)#]+' | sed 's/^](//' | grep -vE '^(http|mailto)' | while read -r p; do [ -e "$d/$p" ] || echo "$m: $p"; done
done > "$corpo.q"
if [ -s "$corpo.q" ]; then achou=1; while read -r l; do alerta "link quebrado em $l"; done < "$corpo.q"; fi
[ $achou = 0 ] && echo "Todos os documentos estão no índice (ou no LEIAME da pasta) e os links funcionam."
rm -f "$corpo.q"
} >> "$corpo"

# 7. Branches de documentação paradas
{
secao "Branches \`docs-*\` e \`documentacao-*\` não mescladas"
git fetch origin -q 2>/dev/null || echo "_Aviso: não consegui atualizar o \`origin\`; esta lista pode estar desatualizada._"
atual=$(git branch --show-current)
achou=0
for b in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/docs-*' 'refs/remotes/origin/documentacao-*'); do
  git merge-base --is-ancestor "$b" origin/main 2>/dev/null && continue
  [ "${b#origin/}" = "$atual" ] && continue
  dias=$(( ( $(date +%s) - $(git log -1 --format=%ct "$b") ) / 86400 ))
  achou=1
  if [ "$dias" -gt 3 ]; then alerta "\`${b#origin/}\`: sem merge, parada há $dias dia(s)"; else echo "- \`${b#origin/}\`: sem merge, recente ($dias dia(s))"; fi
done
[ $achou = 0 ] && echo "Nenhuma."
} >> "$corpo"

alertas=$(wc -l < "$cont" | tr -d ' ')
nota=$(cat "$corpo.nota" 2>/dev/null)
echo "# Relatório da documentação"
echo
echo "Gerado em $(date +%Y-%m-%d) pelo script \`docs/ferramentas/checar-documentacao.sh\`, sobre o commit \`$(git rev-parse --short HEAD)\`."
echo
echo "**Resumo:** $alertas alerta(s). CLAUDE.md: $nota."
ant=$(git show origin/main:docs/relatorio-documentacao.md 2>/dev/null | grep -m1 '^\*\*Resumo' | sed 's/\*\*//g')
[ -n "$ant" ] && { echo; echo "Relatório anterior: $ant"; }
cat "$corpo"
rm -f "$corpo" "$corpo.nota" "$cont"
