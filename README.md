# Banquinha SquadHub

App web interno para controle de lojinha de snacks e bebidas da SquadHub.

## Requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Conta na [Vercel](https://vercel.com) (para deploy)

## Instalação local

```bash
# Instalar dependências
npm install

# Copiar e preencher variáveis de ambiente
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais do Supabase.

## Configuração do Supabase

### 1. Criar projeto

Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto.

### 2. Rodar o schema SQL

No painel do Supabase, vá em **SQL Editor** e execute o conteúdo de `supabase/schema.sql`.

Isso irá:
- Criar as tabelas: `usuarios`, `produtos`, `compras`, `estoque_movimentacoes`
- Configurar RLS policies
- Inserir os 23 produtos iniciais
- Criar o admin inicial (senha: `admin123`)

### 3. Criar bucket de storage

No painel do Supabase, vá em **Storage** → **New bucket**:
- Nome: `produtos`
- Marcar como **Public**

### 4. Obter as chaves

No painel do Supabase, vá em **Settings** → **API**:
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave anon/public
- `SUPABASE_SERVICE_ROLE_KEY`: chave service_role (usada apenas server-side para geração de PDF)

## Rodando localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Primeiro acesso admin

1. Acesse a tela de identificação
2. Clique em "Acesso administrativo"
3. Digite a senha: `admin123`
4. Você será redirecionado para o dashboard

**Recomendado:** após o primeiro acesso, crie um novo admin com senha forte e desative o padrão.

## Adicionar usuários

1. Faça login como admin
2. Vá em **Usuários** → **Novo usuário**
3. Preencha o nome e perfil "Usuário"
4. O usuário aparecerá na tela de seleção

## Deploy na Vercel

1. Faça push do código para um repositório GitHub
2. No painel da Vercel, importe o repositório
3. Configure as variáveis de ambiente (as mesmas do `.env.local`)
4. Deploy!

## Stack

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript
- **Banco de dados:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage
- **PDF:** @react-pdf/renderer
- **UI:** Tailwind CSS + shadcn/ui
- **Hospedagem:** Vercel
