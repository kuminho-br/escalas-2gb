import { Link, type LinkProps } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Moldura } from '@/componentes/Moldura';
import { cn } from '@/lib/utils';

/**
 * Padrão dos cadastros: lista à esquerda e detalhe à direita (especificação de telas, "Cadastros").
 * No celular, mostra um de cada vez: o detalhe quando há item escolhido.
 */
export function ListaDetalhe({
  titulo,
  acoes,
  lista,
  detalhe,
  temDetalhe,
}: {
  titulo: string;
  acoes?: ReactNode;
  lista: ReactNode;
  detalhe: ReactNode;
  temDetalhe: boolean;
}) {
  return (
    <Moldura titulo={titulo} acaoPrincipal={acoes}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
        {/* a lista fica parada e só os itens dela rolam (a lista marca a área com data-lista-rolavel); o detalhe rola com a página. 10rem = o que está acima da coluna ao abrir a página, para o rodapé da lista caber à vista */}
        <div
          className={cn(
            'flex min-w-0 flex-col rounded-xl border border-linha bg-superficie lg:sticky lg:top-20 lg:max-h-[calc(100dvh-10rem)] lg:overflow-hidden',
            temDetalhe && 'max-lg:hidden',
          )}
        >
          {lista}
        </div>
        <div className={cn('min-w-0', !temDetalhe && 'max-lg:hidden')}>{detalhe}</div>
      </div>
    </Moldura>
  );
}

/** O item aberto na lista: fundo rosado e uma barra vinho à esquerda (esboço telas-v12). */
export const classeItemEscolhido = 'bg-passa shadow-[inset_3px_0_0_var(--color-tinta)]';

/**
 * A ficha de um cadastro: um painel só, com os blocos separados por uma linha fina.
 * O cabeçalho tem o título, o resumo de uma linha e, à direita, as ações da ficha (ex.: Desativar).
 */
export function FichaPainel({
  titulo,
  complemento,
  voltarPara,
  voltarBusca,
  voltarSempre = false,
  semVoltar = false,
  etiqueta,
  resumo,
  aviso,
  acoes,
  children,
}: {
  titulo: ReactNode;
  /** ao lado do título (ex.: a matrícula) */
  complemento?: ReactNode;
  voltarPara: LinkProps['to'];
  /** a busca do endereço de volta (ex.: a aba de Configurações) */
  voltarBusca?: LinkProps['search'];
  /** a ficha sem a lista ao lado (a do Pecúlio Geral): a seta de voltar aparece também no computador */
  voltarSempre?: boolean;
  /** a ficha numa janela por cima de outra tela (a Grade): não há para onde voltar, a janela fecha */
  semVoltar?: boolean;
  etiqueta?: string;
  resumo: string;
  /** faixa sob o resumo (ex.: cadastro incompleto) */
  aviso?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article data-ficha className="divide-y divide-linha rounded-xl border border-linha bg-superficie">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {!semVoltar && (
              <Link to={voltarPara} search={voltarBusca} className={voltarSempre ? undefined : 'lg:hidden'} aria-label={voltarSempre ? 'Voltar' : 'Voltar para a lista'}>
                <ArrowLeft className="size-5" aria-hidden />
              </Link>
            )}
            <h2 className="font-cond text-2xl font-semibold">{titulo}</h2>
            {complemento}
            {etiqueta && <span className="rounded border border-linha px-1.5 text-xs">{etiqueta}</span>}
          </div>
          <p className="mt-1 text-sm text-apagado">{resumo}</p>
          {aviso}
        </div>
        {acoes && <div className="flex flex-wrap items-center justify-end gap-2">{acoes}</div>}
      </header>
      {children}
    </article>
  );
}
