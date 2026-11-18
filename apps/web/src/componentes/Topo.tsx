import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Menu } from 'lucide-react';
import { useState } from 'react';
import { consultaEu, type Eu } from '@/api/eu';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { authCliente } from '@/auth-cliente';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu';

export function Topo({ eu, aoAbrirMenu }: { eu: Eu; aoAbrirMenu: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nome = `${eu.militar.postoGrad} ${eu.militar.nomeGuerra}`;
  const [erroSair, setErroSair] = useState<string | null>(null);

  // Só sai da tela quando o servidor confirmou: num computador compartilhado, a sessão não pode ficar válida.
  async function sair() {
    // pergunta antes de encerrar a sessão: se a pessoa desistir, ela continua logada e com as alterações
    if (!podeDescartar()) return;
    setErroSair(null);
    try {
      const { error } = await authCliente.signOut();
      if (error) throw error;
    } catch {
      setErroSair('Não foi possível sair. Verifique a conexão e tente de novo.');
      return;
    }
    queryClient.clear();
    queryClient.setQueryData(consultaEu.queryKey, null);
    await navigate({ to: '/entrar', ignoreBlocker: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-linha bg-superficie px-4 md:px-8">
      <button type="button" onClick={aoAbrirMenu} className="-ml-1 rounded p-1.5 text-tinta md:hidden" aria-label="Abrir menu">
        <Menu className="size-5" aria-hidden />
      </button>
      {/* no celular só a seção atual cabe; o caminho inteiro vale do computador em diante */}
      <p className="min-w-0 flex-1 truncate font-cond text-[15px] text-apagado">
        <span data-caminho-curto className="md:hidden">{eu.unidade.caminho.at(-1)}</span>
        <span className="max-md:hidden">{eu.unidade.caminho.join(' › ')}</span>
      </p>
      {erroSair && (
        <p role="alert" className="absolute top-full right-4 mt-2 max-w-[calc(100%-2rem)] rounded-md border border-linha bg-superficie px-3 py-2 text-sm text-alerta shadow-sm md:right-8">
          {erroSair}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 font-cond text-[15px] font-medium hover:bg-accent">
          {nome}
          <ChevronDown className="size-4 text-apagado" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuLabel className="font-normal text-apagado">{eu.usuario.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={sair}>Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
