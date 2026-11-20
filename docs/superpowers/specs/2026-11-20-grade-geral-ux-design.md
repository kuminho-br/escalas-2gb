# Grade geral — ajustes de UI/UX (retorno da validação da entrega 4)

Data: 20/11/2026. Origem: validação manual da entrega 4 (Grade geral) pelo usuário, na sessão de validação.
Só tela, mais um campo novo na resposta do painel do dia. Sem migração.

## Por quê

A grade funcionou, mas está difícil de ler: dias espremidos, nome do grupo rolando junto e sem destaque, fim de semana com fundo cinza
(que não faz sentido para quem trabalha por escala). O "Adicionar serviço" do painel do dia lista cada combinação turno × guarnição × função
como um botão, com o aviso de voluntariado repetido em cada uma: fica uma lista longa e bagunçada.

## Parte A — a grade (`TabelaDaGrade.tsx`, `CelulaDaGrade.tsx`, `routes/_app/index.tsx`)

1. **Nome do grupo fixo à esquerda.** Hoje o `sticky left-0` está na célula de grupo (`colSpan` da linha inteira), que é larga como a tabela
   e por isso não fica presa. O texto vai num `<span>` `sticky left-4 inline-block` dentro dela.
2. **Mais ênfase no grupo:** 15px, negrito, cor do texto principal (`text-tinta`), uma barrinha vinho de 3px à esquerda e o total em cinza
   ao lado ("ALFA  12 militares"). Mesma linguagem da barra do dia na Escala do mês.
3. **Dias com o dobro da largura:** a coluna do dia passa de `min-w-6` para `min-w-12` (48px).
4. **Linhas:** cada dia com `border-r` clara (`#EEF0F3`); a coluna dos nomes com uma linha mais forte (`border-r-2 border-linha`), no
   cabeçalho e no corpo. Antes de cada segunda-feira, uma linha um pouco mais forte que a dos outros dias (separa as semanas).
5. **Fim de semana e feriado:** sai o fundo cinza (`bg-[#F6F7F9]`) do cabeçalho e das células. Número e sigla do dia em vinho
   (`text-vinho`) no fim de semana e no feriado (o feriado deixa de usar `text-alerta`). O feriado ganha um pontinho vinho embaixo da
   sigla e mantém o nome no `title`.
6. **Sigla do dia:** `Dom, Seg, Ter, Qua, Qui, Sex, Sáb` (no lugar da inicial).
7. **Militar:** posto e nome na mesma linha (posto em peso normal, nome em negrito, `whitespace-nowrap`) e a matrícula embaixo
   (`text-xs text-apagado`). A coluna passa a ter uns 13rem de largura mínima. O nome acessível da célula não muda.
8. **Blocos de tamanho fixo, espaçados por igual:** cada bloco com largura fixa (≈20px; o bloco não estica nem encolhe para caber) e o
   espaço que sobra na coluna dividido igualmente entre eles (`justify-evenly`). Um bloco sozinho fica centralizado.
9. **Filtro de equipes com várias escolhas:** cada equipe liga e desliga. No endereço, `equipe` (texto) vira `equipes` (lista); equipes
   que não existem no mês são descartadas; lista vazia = "Todas". "Todas" limpa a seleção e fica marcado quando nada está escolhido; ligar
   todas uma a uma volta para "Todas". Um endereço antigo com `?equipe=x` continua valendo como lista de uma.
10. **Cabeçalho dos dias fixo** (era o problema conhecido adiado na entrega 4): a área da grade rola nos dois sentidos (`overflow-auto`)
    com altura máxima `calc(100dvh - <altura do topo>)`, para o cabeçalho e a coluna dos nomes ficarem presos ao mesmo tempo.
11. **PJES, Diárias e Voluntariado fixas na borda direita** (`sticky right-0`, como os nomes na esquerda), em telas a partir de 1440px;
    em telas menores rolam com o resto.
12. **Destaque da linha** ao passar o mouse (fundo leve no `tr` inteiro, incluindo a coluna do nome).
13. **Célula visível ao abrir o painel:** ao escolher uma célula, a grade rola só o necessário para ela continuar à vista ao lado do
    painel (`scrollIntoView({ inline: 'nearest', block: 'nearest' })`).

Rejeitado pelo usuário: destaque do dia de hoje e da coluna do dia aberto.

## Parte B — "Adicionar serviço neste dia" em abas (`AdicionarServico.tsx`, API do painel do dia)

**Abas:** `Ordinário (n)` e `Operações (n)`, onde `n` é o número de turnos com opção.
- **Ordinário:** as opções dos serviços fixos do Ordinário (`SERVICOS_FIXOS`: Pronto, JES, Saldo, Expediente). **Operações:** todo o resto
  (Bioma, PE Seguro, Defensoria, CPRH…). A escala ordinária é fixa por enquanto (decisão do usuário).
- A tela não sabe hoje de qual tipo é a opção: `OpcaoDeServico` ganha `ordinario: boolean`, preenchido pela API.
- Abre na aba que tiver opções (Ordinário primeiro, se as duas tiverem). Aba sem opções fica apagada, com "(0)". Sem opção nenhuma,
  continua a frase "Nenhum serviço disponível para ele neste dia."

**Grupos e itens:** dentro da aba, um grupo por escala (título com o nome da escala); cada item é **um turno** (a faixa de horário).
As funções do mesmo turno não viram itens separados: a vaga é escolhida numa lista.

```
[ Ordinário (2) ] [ Operações (3) ]

Bioma
  00h–08h  [Motorista        ▾]          [Escalar]
  16h–00h  [Combatente       ▾]          [Escalar]  não marcou
PE Seguro
  08h–16h  [Sem guarnição    ▾]          [Escalar]

Ordinário
  08h–20h  [Resgate · Chefe   ▾] [Pronto ▾] [Escalar]
```

- **Lista da vaga:** "Guarnição · Função" quando a escala tem mais de uma guarnição no turno (caso do Ordinário); só a função quando há uma
  guarnição só (caso do Bioma). "Sem guarnição" fica por último. Vem marcada a primeira, na ordem que a API manda. *(chamada minha)*
- **Lista do serviço** (Pronto/JES/Saldo): continua como hoje, só aparece quando há mais de um serviço possível na faixa.
- **Botão "Escalar"** em cada linha (com duas listas, a linha não pode mais ser o botão). *(chamada minha)*
- **Voluntariado:** em vez da frase repetida embaixo de cada opção, uma etiqueta curta "não marcou" na linha, na cor de pendência, valendo
  pelo serviço escolhido na lista. Continua dando para escalar. *(chamada minha)*

## Também entram no bloco (problemas conhecidos adiados da entrega 4)

- A recusa da troca não diz de qual dos dois militares é o problema.
- A célula escolhida com choque mostra só o contorno vermelho (o destaque de escolhida some).
- Uma busca extra antes de o diálogo da troca fechar.

## Fora

- Destaque do dia de hoje e da coluna do dia aberto (rejeitado).
- Escala ordinária configurável (fica fixa por enquanto).

## Para o planejamento

Bloco só de tela (mais o `ordinario` na opção do painel do dia). Não depende das entregas 4.1, 4.2 e 4.3 e nenhuma delas depende dele;
encaixar onde houver menos carga, sem subdividir etapa futura de forma irresponsável.
