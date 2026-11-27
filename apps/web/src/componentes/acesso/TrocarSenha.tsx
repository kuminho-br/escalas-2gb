import { MSG_SENHA_ATUAL_ERRADA, MSG_SENHA_TROCADA } from 'contratos';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authCliente } from '@/auth-cliente';
import { Campo } from '@/componentes/Campo';
import { RequisitosDaSenha, senhaCumpreOsRequisitos } from '@/componentes/acesso/RequisitosDaSenha';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';

const MSG_FALHOU = 'Não foi possível trocar a senha. Tente de novo.';

/** O bloco "Senha" da Minha ficha: o botão que abre a janela de trocar a senha estando logado (a rota `change-password` do better-auth) e, depois da troca, o aviso. */
export function TrocarSenha() {
  const [aberta, setAberta] = useState(false);
  const [trocada, setTrocada] = useState(false);
  return (
    <div className="grid justify-items-start gap-3">
      <p className="text-sm text-apagado">A senha que você usa para entrar no sistema.</p>
      <Button type="button" variant="secundario" onClick={() => { setTrocada(false); setAberta(true); }}>Trocar senha</Button>
      {trocada && <p role="status" className="text-sm text-tinta">{MSG_SENHA_TROCADA}</p>}
      {aberta && <JanelaDeTroca aoFechar={() => setAberta(false)} aoTrocar={() => { setAberta(false); setTrocada(true); }} />}
    </div>
  );
}

function JanelaDeTroca({ aoFechar, aoTrocar }: { aoFechar: () => void; aoTrocar: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repita, setRepita] = useState('');
  const [erroAtual, setErroAtual] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const atualRef = useRef<HTMLInputElement>(null);
  // a cada recusa da senha atual, o foco volta ao campo (num efeito, porque o campo só recebe foco depois de desenhado)
  const [recusas, setRecusas] = useState(0);
  useEffect(() => {
    if (recusas) atualRef.current?.focus();
  }, [recusas]);

  async function trocar(e: FormEvent) {
    e.preventDefault();
    if (!atual || !senhaCumpreOsRequisitos(nova, repita)) return;
    setErro(null);
    setErroAtual(undefined);
    setEnviando(true);
    try {
      const { error } = await authCliente.changePassword({ currentPassword: atual, newPassword: nova, revokeOtherSessions: true });
      if (!error) {
        aoTrocar();
        return;
      }
      if (error.code === 'INVALID_PASSWORD') {
        setErroAtual(MSG_SENHA_ATUAL_ERRADA);
        setRecusas((n) => n + 1);
      } else setErro(MSG_FALHOU);
    } catch {
      setErro(MSG_FALHOU);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar senha</DialogTitle>
          <DialogDescription>Ao trocar, as outras sessões abertas com a sua conta são encerradas. Esta continua.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void trocar(e)} className="grid gap-3" noValidate>
          <Campo id="ts-atual" rotulo="Senha atual" erro={erroAtual}>
            <Input ref={atualRef} id="ts-atual" type="password" autoComplete="current-password" autoFocus value={atual} onChange={(e) => setAtual(e.target.value)} />
          </Campo>
          <Campo id="ts-nova" rotulo="Senha nova">
            <Input id="ts-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
          </Campo>
          <Campo id="ts-repita" rotulo="Repita a senha nova">
            <Input id="ts-repita" type="password" autoComplete="new-password" value={repita} onChange={(e) => setRepita(e.target.value)} />
          </Campo>
          <RequisitosDaSenha senha={nova} confirmacao={repita} />
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={enviando || !atual || !senhaCumpreOsRequisitos(nova, repita)}>Trocar senha</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
