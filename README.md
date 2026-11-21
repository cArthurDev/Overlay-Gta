# Vice City Overlay

Painel web e overlay transparente para controlar o contador de missões e o tempo total jogado durante uma transmissão. A overlay não mostra o tempo da sessão atual.

## Publicar na Vercel

### 1. Preparar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e execute. O script mantém o estado atual como o primeiro perfil e cria o estado independente do segundo.
3. Em **Project Settings → API Keys**, copie a URL do projeto e crie/ copie uma chave **Secret** (`sb_secret_...`). Ela ignora as políticas RLS; mantenha-a somente no servidor, como variável de ambiente da Vercel. O nome antigo `service_role` também é aceito.

Se já configurou o banco anteriormente, execute o SQL para criar os estados separados por perfil e habilitar as ações atuais do cronômetro. O estado existente é copiado para o primeiro perfil; o segundo começa com 0 missões de 23 e cronômetro pausado. O script pode ser executado novamente sem apagar o progresso.

### 2. Publicar o projeto

Importe este repositório na Vercel. O projeto é estático e a pasta `api` contém a função serverless; não é necessário configurar comando de build.

Em **Project Settings → Environment Variables**, adicione:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...` do Supabase (ou use `SUPABASE_SERVICE_ROLE_KEY` para a chave antiga `service_role`) |
| `OVERLAY_SECRET` | Uma chave longa e aleatória, criada por você |
| `OVERLAY_SECRET_2` | Uma segunda chave longa e aleatória para o outro usuário |
| `OVERLAY_SECRET_3` | Chave do terceiro usuário |
| `OVERLAY_SECRET_4` | Chave do quarto usuário |
| `OVERLAY_SECRET_5` | Chave do quinto usuário |
| `TWITCH_CLIENT_ID` | Client ID do aplicativo Twitch usado para buscar as fotos de perfil |
| `TWITCH_CLIENT_SECRET` | Client Secret do aplicativo Twitch (somente no servidor) |

No PowerShell, gere a chave da overlay sem enviá-la a nenhum serviço:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Configure uma chave longa e diferente em cada variável e compartilhe apenas a chave correspondente a cada usuário. Cada chave tem seu próprio progresso, cronômetro e URL da overlay; até cinco pessoas podem usar o sistema ao mesmo tempo sem misturar os dados. Depois de salvar as variáveis, faça um novo deploy para aplicá-las.

Para carregar as fotos de perfil dos colaboradores, crie um aplicativo no [Twitch Developer Console](https://dev.twitch.tv/console/apps), configure `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET` como variáveis de ambiente da Vercel e faça um novo deploy. O Client Secret é usado apenas pela função serverless e nunca é enviado ao navegador.

### 3. Conectar o painel e o OBS

1. Abra o endereço do projeto na Vercel e cada usuário informa sua chave de acesso (`OVERLAY_SECRET`, `OVERLAY_SECRET_2`, `OVERLAY_SECRET_3`, `OVERLAY_SECRET_4` ou `OVERLAY_SECRET_5`).
2. Clique em **Copiar URL** no painel.
3. No OBS, adicione uma **Fonte de navegador**, cole a URL e configure a fonte com **420 × 90** pixels.

A URL copiada contém a chave privada no fragmento (`#...`) para que ela não seja enviada como parte da requisição da página. Trate essa URL como uma senha: quem a tiver pode ver e controlar o painel. Se ela vazar, gere outro `OVERLAY_SECRET` na Vercel e faça novo deploy.

O painel começa com o template Vice City, 0 missões de 23 e cronômetro pausado. O tempo continua contando entre atualizações da página; pausar preserva o total. As alterações da overlay sincronizam em até alguns segundos.

### Adicionar templates

Coloque as imagens de fundo em `templates/` (recomendado: **640 × 126 px**) e registre cada uma em `overlay-templates.js`, incluindo um `id`, nome, descrição e caminho da imagem. A aba já inclui Vice City, Neon Boulevard, Marina Sunset e Sunset District; `template-1` é o padrão. Ao selecionar outro no painel, a URL da overlay muda; copie a URL atualizada e substitua a da fonte de navegador no OBS.

### Adicionar colaboradores

Abra `overlay-collaborators.js` e adicione um item para cada streamer:

```javascript
Object.freeze({
  name: "Nome do streamer",
  platform: "Twitch",
  url: "https://www.twitch.tv/usuario",
}),
```

Depois, faça o deploy para publicar a nova lista. Cada colaborador aparecerá na coluna **Colaboradores** do Painel com um botão para abrir a live.
