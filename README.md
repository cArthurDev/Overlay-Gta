# Vice City Overlay

Painel web e overlay transparente para controlar o contador de missões e o tempo total jogado durante uma transmissão. A overlay não mostra o tempo da sessão atual.

## Publicar na Vercel

### 1. Preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e execute.
3. Em **Project Settings → API Keys**, copie a URL do projeto e crie/ copie uma chave **Secret** (`sb_secret_...`). Ela ignora as políticas RLS; mantenha-a somente no servidor, como variável de ambiente da Vercel. O nome antigo `service_role` também é aceito.

Se já configurou o banco anteriormente, execute novamente o SQL atualizado para habilitar as ações de adicionar tempo ao cronômetro. A criação da tabela e do estado inicial é idempotente.

### 2. Publicar o projeto

Importe este repositório na Vercel. O projeto é estático e a pasta `api` contém a função serverless; não é necessário configurar comando de build.

Em **Project Settings → Environment Variables**, adicione:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...` do Supabase (ou use `SUPABASE_SERVICE_ROLE_KEY` para a chave antiga `service_role`) |
| `OVERLAY_SECRET` | Uma chave longa e aleatória, criada por você |

No PowerShell, gere a chave da overlay sem enviá-la a nenhum serviço:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Depois de salvar as variáveis, faça um novo deploy para aplicá-las.

### 3. Conectar o painel e o OBS

1. Abra o endereço do projeto na Vercel e informe o mesmo valor definido em `OVERLAY_SECRET`.
2. Clique em **Copiar URL** no painel.
3. No OBS, adicione uma **Fonte de navegador**, cole a URL e configure a fonte com **420 × 90** pixels.

A URL copiada contém a chave privada no fragmento (`#...`) para que ela não seja enviada como parte da requisição da página. Trate essa URL como uma senha: quem a tiver pode ver e controlar o painel. Se ela vazar, gere outro `OVERLAY_SECRET` na Vercel e faça novo deploy.

O painel começa com 0 missões de 23 e cronômetro pausado. O tempo continua contando entre atualizações da página; pausar preserva o total. As alterações da overlay sincronizam em até alguns segundos.
