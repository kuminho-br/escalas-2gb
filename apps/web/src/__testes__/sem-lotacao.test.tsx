import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { abrir, EU_EXEMPLO, simularApi } from './apoio';

// Entrega 6.16, Task 2, item 7: a tela de quem não tem unidade para trabalhar.
const SEM_UNIDADE = { ...EU_EXEMPLO, papeis: [], unidades: [], lotacao: null };

describe('Sem lotação', () => {
  it('sem nível de acesso e sem lotação: manda procurar o auxiliar da seção', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: SEM_UNIDADE } });
    abrir('/sem-lotacao');
    expect(await screen.findByText('Sua lotação não está cadastrada. Procure o auxiliar administrativo da sua seção.')).toBeInTheDocument();
  });

  it('nível de acesso só em unidade extinta: diz que a unidade não existe mais e manda procurar o gestor do grupamento', async () => {
    simularApi({ '/api/eu': { status: 200, corpo: { ...SEM_UNIDADE, papeis: [{ papel: 'escalante', unidadeId: 'u-ext', unidadeSigla: 'EXT' }], nivelSoEmUnidadeExtinta: true } } });
    abrir('/sem-lotacao');
    expect(await screen.findByText('Seu nível de acesso é de uma unidade que não existe mais. Procure o gestor do seu grupamento.')).toBeInTheDocument();
    expect(screen.queryByText(/Sua lotação não está cadastrada/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});
