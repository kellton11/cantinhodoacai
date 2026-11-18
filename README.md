# 🍇 Cantinho do Açaí – Sistema de vendas

Caixa com balança, estoque, lista de compras e relatórios.
Feito com **Vite + React + TypeScript**. Funciona agora com os dados salvos no navegador
e passa para o **Supabase** só preenchendo o arquivo `.env.local`.

## O que o sistema faz

- **Caixa:** balança, itens de preço fixo, desconto (R$ ou %), cortesia, Dinheiro/Pix/Cartão, abrir e fechar o caixa do dia.
- **Cancelar venda:** na lista "Vendas deste caixa". Pede a senha, devolve o item ao estoque e tira o valor do caixa.
  Só vale para vendas do caixa que está aberto (caixas já fechados não mudam).
- **Estoque** e **O que comprar**, com imagem PNG das listas.
- **Produtos e preços:** preço e **custo** de cada item (editáveis na tabela). O custo do açaí é por kg.
- **Despesas:** aluguel, luz, fornecedores etc. e o **resultado do mês** (vendas − custo − despesas), com imagem.
- **Relatórios:** vendas por período, mais vendidos, vendas por dia, **lucro e margem**, descontos dados, vendas canceladas.
- **Backup automático:** ao fechar o caixa o sistema baixa um arquivo de backup sozinho (dá para desligar em Produtos e preços).

## 1. Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) (versão 18 ou mais nova).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173) no **Google Chrome** ou **Microsoft Edge**.

Para gerar a versão final: `npm run build` (a pasta `dist` é o site pronto).

## 2. Balança

- A conexão usa a Web Serial API, que só existe no **Chrome/Edge**.
- Só funciona em **localhost** ou em endereço **https**.
- Em Produtos e preços > Configuração da balança, ajuste a velocidade (baud rate) e se ela envia kg ou gramas.
- Sem balança conectada, digite o peso em gramas.

## 3. Ligar no Supabase (opcional)

1. Crie um projeto em https://supabase.com.
2. Abra **SQL Editor > New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   (Se você já tinha rodado a versão anterior, rode de novo: o arquivo atualiza as tabelas sem apagar nada.)
3. Em **Authentication > Users > Add user**, crie o seu usuário (e-mail e senha).
4. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**
   (assim só você entra).
5. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.
6. Copie `.env.example` para `.env.local` e preencha:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

7. Reinicie com `npm run dev`. O sistema passa a pedir e-mail e senha e grava tudo no Supabase.
   O selo no topo mostra **☁ Supabase** ou **💾 Neste computador**.

> A chave `anon` pode ficar no site, pois quem protege os dados são as regras (RLS) do `schema.sql`:
> só usuário logado lê e grava. Nunca coloque a chave `service_role` neste projeto.

### Passando os dados do computador para o Supabase
1. Com o `.env.local` **vazio**, abra o sistema e em Produtos e preços clique em **Baixar backup**.
2. Configure o Supabase, abra o sistema, entre e clique em **Restaurar backup** com esse arquivo.

Backups de versões anteriores deste sistema e do arquivo HTML antigo (`cantinho-do-acai.html`) também podem ser restaurados.
Nesse caso a senha das abas é zerada e você cria uma nova.

## 4. Colocar na internet (opcional)

Publique a pasta `dist` em Vercel, Netlify ou Cloudflare Pages (todos têm plano grátis) e
configure as duas variáveis `VITE_SUPABASE_*`. Como o endereço é https, a balança funciona normalmente.

## Estrutura

```
src/
  pages/        Caixa, Estoque, Compras, Produtos, Despesas, Relatorios
  components/   CashBar (abrir/fechar caixa), AuthGate (login), Modal
  store/        Estado do sistema e todas as ações (vender, estoque, caixa...)
  data/         Repository (contrato) + LocalRepository + SupabaseRepository
  lib/          balança, imagens PNG, relatórios, backup, senha
supabase/schema.sql   Tabelas e regras de segurança
```

Para trocar de banco no futuro, basta criar outra classe que siga `src/data/repository.ts`.

## Limites conhecidos

- A baixa do estoque ao vender e o registro da venda são feitos em chamadas separadas.
  Se a internet cair bem nesse momento, o estoque pode ficar desatualizado (corrija em Estoque).
- No modo Supabase é preciso internet para vender. O modo local funciona sem internet.
- A senha das abas é uma trava de uso no balcão, guardada nos dados do sistema.
  Quem protege de verdade os dados na nuvem é o login do Supabase.
- O lucro só considera o custo que estava cadastrado na hora da venda. Vendas feitas antes de informar o custo aparecem com lucro maior que o real.
- O backup automático depende do navegador permitir downloads. O Chrome pode perguntar na primeira vez.
