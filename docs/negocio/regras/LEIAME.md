# Catálogo de regras de negócio (RN-XX)

Referência única das regras de negócio do sistema de escalas. Quem cuida: DOCUMENTAÇÃO.

Origem: catálogo do claude.ai (rev. 160, 15/11/2026), feito para o protótipo. Em 21/11/2026 cada regra foi conferida contra o sistema novo (design, specs da fase 4 e código da `main` depois da entrega 4.6), e entraram as regras novas da fase 4 (RN-102 em diante).

| Arquivo | O que tem |
|---|---|
| [servicos-e-guarnicoes.md](servicos-e-guarnicoes.md) | Serviços e escalas, modelos de guarnição, meta de ativação, ordem de escalação e acúmulo |
| [carga-expediente-choques.md](carga-expediente-choques.md) | Carga horária, saldos, expediente do Adm, pré-escala e choques |
| [cotas-voluntariado-permutas.md](cotas-voluntariado-permutas.md) | Cotas, voluntariado por faixa de horário, distribuição dos extras, situações boas e ruins, permutas |
| [sistema-e-interface.md](sistema-e-interface.md) | Escopo, cadastros, configurações, interface e requisitos RS-XX |
| [normativo-a-validar.md](normativo-a-validar.md) | Regras do normativo (a validar), pendências P-XX e regras que saíram |

Regra de negócio (RN) é como o serviço funciona no quartel: valeria mesmo sem sistema. Requisito de sistema (RS) é o que o sistema tem de oferecer para dar conta delas.

## Como ler cada regra

| Coluna | O que diz |
|---|---|
| Situação | Se a regra está decidida: `Confirmada`, `A esclarecer` (falta informação ou há divergência) ou `Substituída por RN-XX` (fica para quem procurar o ID antigo) |
| No sistema novo | Onde a regra está hoje: `Funciona` (já vale nas telas e na API), `Em parte` (o que falta vem dito na regra), `No motor` (a regra está pronta em `pacotes/dominio`, falta ligar às telas) ou a fase do roadmap em que entra |
| Barreira | Em qual frente a regra trabalha (abaixo) |

O andamento do trabalho (planejado, em execução) é do roadmap, não deste catálogo. "No sistema novo" diz só se a regra já vale e onde.

## Como mudar o catálogo

- O ID nunca é reaproveitado. A próxima regra nova é a **RN-117**; o próximo requisito, o **RS-08**.
- Regra que deixa de valer vai para "Regras que saíram", em [normativo-a-validar.md](normativo-a-validar.md), com o motivo. Regra trocada por outra fica no lugar, como `Substituída por RN-XX`.
- Decisão do usuário que cria ou muda uma regra ganha uma linha em [decisoes.md](../../decisoes.md), no mesmo PR (sem adendos).
- O código deve citar o ID da regra que implementa (ex.: `// RN-36`).

## Barreiras de implementação

| Barreira | O que mede | Meta |
|---|---|---|
| Barreira de suporte | Até onde o sistema ajuda o escalante a não errar (validações, alertas, ferramentas) | Cobrir todo o processo que está sendo descoberto |
| Barreira de automação | Até onde o sistema faz as coisas sozinho, ao receber as entradas corretas | Alcançar a barreira de suporte |

| Valor | Significado |
|---|---|
| Base | Cadastro, modelo de dados ou configuração que sustenta as duas barreiras; vem primeiro |
| Suporte | Validação, alerta ou ferramenta para o escalante |
| Automação | O sistema executa sozinho |
| Ambas | O sistema valida o lançamento manual e também respeita a regra ao automatizar |

## Metas do sistema (RN-49 a RN-51)

Todo o sistema serve a duas metas; cada regra existe para atingir uma delas ou as duas. As regras de automação nunca impedem o escalante de fechar a escala: onde a automação para, o escalante decide à mão, com o apoio do sistema.

| ID | Regra | Situação | No sistema novo | Barreira |
|---|---|---|---|---|
| RN-49 | Meta 1: ativar as guarnições da meta de ativação de cada dia (RN-108, RN-109). | Confirmada | Funciona (Efetivo por dia mostra quantas foram ativadas) | Ambas |
| RN-50 | Meta 2: escalar as cotas recebidas, internas e externas (RN-33, RN-34). | Confirmada | Em parte: as cotas restantes aparecem; a distribuição automática é da fase 8 | Ambas |
| RN-51 | Para cada cota, o sistema mostra quanto foi recebido, quanto foi escalado e quanto resta (RN-114), e a quantidade por militar, como faz hoje a planilha de cotas. | Confirmada | Em parte: recebido e restante funcionam; a quantidade por militar, não | Suporte |
