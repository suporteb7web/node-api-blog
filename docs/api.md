# Contrato de implementação — API de Blog

Documento de contrato derivado do [PRD](./project-prd.md). Define visão geral, stack, arquitetura de camadas e o contrato HTTP de cada endpoint (método, path, autenticação, inputs, respostas e erros).

---

## 1. Visão geral

API de blog com autenticação de usuários, gestão de posts, likes, replies, mídia e notificação por e-mail.

- Cadastro e login geram um **token de sessão** persistido no banco e retornado ao cliente.
- Rotas protegidas exigem `Authorization: Bearer <token>`.
- Usuários autenticados podem criar, editar e excluir **apenas os próprios posts**.
- Listagem e consulta individual de posts são **públicas** para posts não premium. As duas aceitam token **opcional**. Na consulta por id, o token preenche `likedByMe`. Na listagem e na consulta, token inválido é **401**; usuário premium vê também os posts premium.
- Usuário autenticado pode curtir/descurtir um post (incluindo o próprio) e responder um post.
- Só o **autor da reply** pode apagá-la (o autor do post não apaga reply de outra pessoa).
- Usuário autenticado consulta os próprios dados em `GET /api/me` e atualiza o **avatar** em `PUT /api/me/avatar`.
- Usuário autenticado inicia a compra de acesso premium em `POST /api/me/checkout`: o endpoint cria uma Checkout Session de pagamento único no Stripe e devolve somente a URL. Não concede o acesso. Se o usuário já é premium, responde **409** e não cria a sessão.
- O Stripe notifica `POST /api/webhook/stripe` no evento `checkout.session.completed`. O endpoint verifica a assinatura com `STRIPE_WEBHOOK_SECRET`, lê `client_reference_id` e, quando o id corresponde a um usuário, marca `users.premium` como `true`. O acesso não expira. Reenvio do evento mantém `true`. Id desconhecido não altera nada. Voltar da `success_url` não concede o acesso.
- O autor do post atualiza a **imagem** do post em `PUT /api/posts/:id/image` (arquivo em disco, path no banco).
- Nova reply em um post **de outra pessoa** dispara e-mail ao autor do post. Responder o próprio post **não** gera e-mail.
- Escopo limitado a **auth + posts + likes + replies + mídia + e-mail de reply + checkout Stripe de acesso premium + webhook que marca o usuário como premium** (sem perfil completo, logout, papéis de admin, soft delete, threads, like em reply, expiração ou reembolso de premium, etc.).

### Relacionamentos

| Recurso | Campos principais | Observações |
|--------|-------------------|-------------|
| `users` | `id`, `name`, `email`, `password` (hash), `token` (sessão), `avatarPath`, `premium` | `email` único; `avatarPath` é o path relativo do arquivo em disco (nullable); `premium` boolean, default `false` |
| `posts` | `id`, `title`, `content`, `createdAt`, `authorId`, `photoPath`, `premium` | Relação 1:N com `users`; `photoPath` é o path relativo do arquivo em disco (nullable); `premium` boolean, default `false` |
| `likes` | `userId`, `postId` | Um like por par usuário+post; o autor do post **pode** curtir o próprio post |
| `replies` | `id`, `content`, `createdAt`, `authorId`, `postId` | Relação 1:N com `posts` e com `users`; sem thread (reply só no post) |

Um usuário pode ter vários posts; cada post pertence a um único usuário. Um post pode ter vários likes e várias replies. Hard delete de um post **remove em cascade** likes e replies daquele post.

---

## 2. Stack (alto nível)

| Camada | Tecnologia |
|--------|------------|
| Linguagem / bundling | TypeScript com Vite (template vanilla-ts) |
| HTTP | Express |
| Upload (borda) | Multer (`memoryStorage`) — só na rota |
| Imagem | Sharp (processar e gravar em disco) |
| E-mail | Nodemailer; Mailpit (SMTP + UI) em dev/teste |
| Validação de input | Zod |
| ORM | Drizzle |
| Banco | PostgreSQL 17 |
| Hash de senha | bcrypt |
| Testes | Vitest |
| Infra local | Docker Compose (app DB + test DB, volumes separados; Redis; Mailpit) |

---

## 3. Arquitetura de implementação

A implementação **deve** seguir a separação:

```
Route → Controller → Service → (Drizzle / DB)
              ↑
         Zod (input)
```

| Camada | Responsabilidade |
|--------|------------------|
| **Controller** | Receber a request HTTP, validar input com Zod, chamar o service, mapear o resultado para status/JSON de resposta. |
| **Service** | Regras de negócio (hash de senha, geração/persistência de token, ownership de posts, paginação, etc.). |
| **Zod** | Validar e tipar **todos** os inputs de entrada (`body`, `params`, `query`) antes de chegar ao service. |

Regras:

- Controllers não acessam o banco diretamente.
- Services não conhecem detalhes de Express (`req`/`res`).
- Inputs inválidos retornam **400** com detalhes de validação (falha no Zod), sem chamar o service.
- Autenticação/autorização é resolvida antes ou no limiar do controller/service conforme o endpoint; falhas de auth retornam **401** / **403** conforme a seção de erros.
- Upload: Multer só na rota; o service recebe o buffer da imagem. Persistência no banco é só o path. E-mail de reply é efeito colateral do service de criar reply: depois de persistir, enfileira um job; o worker envia.

---

## 4. Convenções gerais

### 4.1 Base URL

Prefixo sugerido: `/api`

### 4.2 Autenticação

Header obrigatório em rotas protegidas:

```http
Authorization: Bearer <session_token>
```

O token é o valor de sessão persistido na tabela de usuários (ou equivalente). Token ausente, malformado ou inválido → **401**.

### 4.3 Formato de erro

Todas as respostas de erro usam o mesmo envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição legível do erro",
    "details": []
  }
}
```

- `details` é opcional; em erros de validação Zod, lista campos e mensagens.
- Exemplo de `details` (400):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "path": "email", "message": "Invalid email" },
      { "path": "password", "message": "String must contain at least 6 character(s)" }
    ]
  }
}
```

### 4.4 Códigos de erro comuns

| HTTP | `code` | Quando |
|------|--------|--------|
| 400 | `VALIDATION_ERROR` | Body/params/query inválidos (Zod) |
| 401 | `UNAUTHORIZED` | Token ausente, inválido ou credenciais incorretas no login |
| 403 | `FORBIDDEN` | Autenticado, mas sem permissão (ex.: editar/excluir post de outro autor; atualizar imagem de post de outro autor; apagar reply de outro autor; usuário não premium marcando post como premium) |
| 404 | `NOT_FOUND` | Recurso não encontrado |
| 409 | `CONFLICT` | Violação de unicidade (ex.: e-mail já cadastrado) |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

### 4.5 Paginação

- Query `page` (inteiro ≥ 1). Default: `1`.
- Convertida internamente em `offset` + `limit`.
- `limit` fixo da implementação: **10** itens por página.
- Fórmula: `offset = (page - 1) * limit`.

### 4.6 IDs

- Identificadores de `users`, `posts` e `replies` são inteiros positivos (gerados pelo banco), a menos que a implementação opte por UUID — neste contrato as respostas usam `number` como referência.

### 4.7 Datas

- `createdAt` em ISO 8601 (string), ex.: `"2026-08-07T21:00:00.000Z"`.

### 4.8 Senha

- Nunca retornada em nenhuma resposta (nem hash).
- Persistida apenas como hash bcrypt.

### 4.9 Shape de post nas respostas

`likesCount` e `replies` **não** entram em `POST /api/posts`, `PUT /api/posts/:id` nem em `PUT /api/posts/:id/image`.

| Endpoint | `likesCount` | `likedByMe` | `replies` |
|----------|--------------|-------------|-----------|
| `GET /api/posts` | sim | não | não |
| `GET /api/posts/:id` | sim | sim | sim (array completo, sem paginação, `createdAt` asc) |
| `POST /api/posts` / `PUT /api/posts/:id` / `PUT /api/posts/:id/image` | não | não | não |

`image` (path público da foto do post, ou `null`) e `premium` (boolean) entram em **todas** as respostas de post acima. O objeto `author` continua `{ id, name }`, sem `premium`. `PUT /api/posts/:id` não altera a imagem — só título, conteúdo e/ou `premium`.

### 4.10 Upload de imagem

Rotas de arquivo usam `multipart/form-data`. O restante da API continua `application/json`.

| Endpoint | Campo do arquivo | Obrigatório |
|----------|------------------|-------------|
| `PUT /api/posts/:id/image` | `image` | Sim |
| `PUT /api/me/avatar` | `image` | Sim |

- Tipos aceitos: `image/jpeg`, `image/png`, `image/webp`.
- Arquivo ausente, tipo não permitido ou imagem inválida (não decodificável) → **400** `VALIDATION_ERROR`.
- O arquivo é processado e gravado em disco; o banco guarda só o **path relativo**. A resposta expõe o path público (ex.: `/uploads/posts/...`, `/uploads/avatars/...`), nunca o binário.
- Substituir a imagem apaga o arquivo anterior no disco depois de persistir o path novo.

### 4.11 E-mail de reply

- Após persistir uma reply em `POST /api/posts/:id/replies`, se o autor da reply **não** for o autor do post, o sistema **enfileira** o envio de e-mail ao **autor do post**.
- Responder o próprio post **não** dispara e-mail.
- O job carrega os dados prontos (destinatário, título/id do post, autor e conteúdo da reply). O worker monta o corpo (trecho do conteúdo e identificação do post) e envia. Não inclui senha nem token.
- Falha ao enfileirar ou de SMTP **não** desfaz a reply já gravada: a request ainda retorna **201**.

---

## 5. Endpoints

### Resumo

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/auth/register` | Não | Cadastro + retorno de token |
| `POST` | `/api/auth/login` | Não | Login + retorno de token |
| `GET` | `/api/me` | Sim | Dados do usuário autenticado |
| `PUT` | `/api/me/avatar` | Sim | Atualizar o avatar do usuário autenticado |
| `POST` | `/api/me/checkout` | Sim | Criar Checkout Session Stripe e devolver a URL |
| `POST` | `/api/webhook/stripe` | Não | Receber `checkout.session.completed`, verificar a assinatura e ler `client_reference_id` |
| `GET` | `/api/posts` | Não | Listagem pública paginada |
| `GET` | `/api/posts/:id` | Opcional | Consulta pública por id (`likedByMe` se autenticado) |
| `POST` | `/api/posts` | Sim | Criar post |
| `PUT` | `/api/posts/:id` | Sim | Atualizar parcialmente o próprio post |
| `PUT` | `/api/posts/:id/image` | Sim | Atualizar a imagem do próprio post |
| `DELETE` | `/api/posts/:id` | Sim | Excluir (hard delete) o próprio post |
| `POST` | `/api/posts/:id/likes` | Sim | Curtir post (idempotente) |
| `DELETE` | `/api/posts/:id/likes` | Sim | Descurtir post (idempotente) |
| `POST` | `/api/posts/:id/replies` | Sim | Responder um post (e-mail ao autor, se não for auto-reply) |
| `DELETE` | `/api/posts/:id/replies/:replyId` | Sim | Excluir a própria reply |

---

### 5.1 `POST /api/auth/register`

Cadastra um usuário. Em sucesso, gera e persiste token de sessão e o retorna (usuário já autenticado).

| | |
|--|--|
| **Authorization** | Não |
| **Content-Type** | `application/json` |

#### Input — `body`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `name` | `string` | Sim | Não vazio; trim; comprimento 1–100 |
| `email` | `string` | Sim | E-mail válido; normalizar para lowercase; único no banco |
| `password` | `string` | Sim | Mínimo 6 caracteres |

#### Respostas

**201 Created**

```json
{
  "token": "string",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "avatar": null
  }
}
```

`avatar` é o path público do arquivo (ex.: `"/uploads/avatars/..."`) ou `null` quando o usuário ainda não enviou avatar.

**400** — `VALIDATION_ERROR` (campos inválidos)

**409** — `CONFLICT` — e-mail já cadastrado

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Email already registered"
  }
}
```

---

### 5.2 `POST /api/auth/login`

Autentica com e-mail e senha. Em sucesso, gera e persiste novo token de sessão e o retorna.

| | |
|--|--|
| **Authorization** | Não |
| **Content-Type** | `application/json` |

#### Input — `body`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `email` | `string` | Sim | E-mail válido; lowercase |
| `password` | `string` | Sim | Não vazio; mínimo 6 caracteres |

#### Respostas

**200 OK**

```json
{
  "token": "string",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "avatar": null
  }
}
```

**400** — `VALIDATION_ERROR`

**401** — `UNAUTHORIZED` — e-mail inexistente ou senha incorreta (mensagem genérica, sem revelar qual campo falhou)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

---

### 5.3 `GET /api/me`

Retorna os dados do usuário autenticado. Não inclui senha, hash nem token.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input

Nenhum (`body`, `params` e `query` vazios).

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "name": "string",
  "email": "string",
  "avatar": null,
  "premium": false
}
```

- `avatar` é o path público (ex.: `"/uploads/avatars/..."`) ou `null` quando o usuário ainda não enviou avatar.
- `premium` é `true` depois que o webhook de pagamento concluído marcou o usuário. Não entra em register, login nem em `PUT /api/me/avatar`.

**401** — `UNAUTHORIZED` — token ausente/inválido

---

### 5.4 `PUT /api/me/avatar`

Atualiza o avatar do usuário autenticado. O campo de arquivo é `image`. Substitui o avatar anterior, se houver.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type** | `multipart/form-data` |

#### Input — arquivo

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `image` | arquivo | Sim | Imagem válida; MIME `image/jpeg`, `image/png` ou `image/webp` |

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "name": "string",
  "email": "string",
  "avatar": "/uploads/avatars/..."
}
```

**400** — `VALIDATION_ERROR` — arquivo ausente, tipo não permitido ou imagem inválida

**401** — `UNAUTHORIZED`

---

### 5.5 `GET /api/posts`

Listagem de posts em ordem cronológica inversa (`createdAt` desc). Inclui o nome do autor (não o e-mail), `likesCount`, `image` e `premium`. **Não** inclui `likedByMe` nem o array `replies`.

Sem token, ou com token válido de usuário não premium, a lista traz só posts com `premium: false`. Com token válido de usuário premium, a mesma lista mistura posts premium e não premium, na mesma ordem. `meta.total` e `meta.totalPages` contam só os posts visíveis naquele pedido.

| | |
|--|--|
| **Authorization** | Opcional — `Bearer <token>` |

#### Input — `query`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `page` | `number` (coerce de string) | Não | Inteiro ≥ 1; default `1` |

#### Respostas

**200 OK**

```json
{
  "data": [
    {
      "id": 1,
      "title": "string",
      "content": "string",
      "image": null,
      "premium": false,
      "createdAt": "2026-08-07T21:00:00.000Z",
      "likesCount": 0,
      "author": {
        "id": 1,
        "name": "string"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

- Página sem resultados retorna `data: []` com `meta` coerente (não é 404).
- `likesCount` é `0` quando o post não tem likes.
- `image` é o path público da foto (ex.: `"/uploads/posts/..."`) ou `null` quando o post não tem imagem.
- `premium` é `true` quando o post foi marcado como premium.

**400** — `VALIDATION_ERROR` — `page` inválida (ex.: `0`, negativo, não numérico)

**401** — `UNAUTHORIZED` — header `Authorization` presente, mas token malformado ou inválido

---

### 5.6 `GET /api/posts/:id`

Consulta de um post por id, com nome do autor, `likesCount`, `likedByMe`, `premium` e o array completo de `replies` (sem paginação), ordenado por `createdAt` **asc**.

Post premium é **404** `NOT_FOUND` (`"Post not found"`) para quem não envia token e para token válido de usuário não premium. Post inexistente usa o mesmo erro. Token inválido continua **401**, resolvido antes de olhar o post.

| | |
|--|--|
| **Authorization** | Opcional — `Bearer <token>` para preencher `likedByMe` |

Se o header `Authorization` estiver presente, deve ser um Bearer válido; caso contrário **401**. Sem header, `likedByMe` é `false`.

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "image": null,
  "premium": false,
  "createdAt": "2026-08-07T21:00:00.000Z",
  "likesCount": 0,
  "likedByMe": false,
  "replies": [
    {
      "id": 1,
      "content": "string",
      "createdAt": "2026-08-07T21:00:00.000Z",
      "author": {
        "id": 1,
        "name": "string"
      }
    }
  ],
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

- `likesCount` é `0` quando o post não tem likes.
- `likedByMe` é `true` somente se o token for válido **e** aquele usuário já tiver curtido o post; caso contrário `false`.
- `replies` é `[]` quando o post não tem respostas. Sem paginação: todas as replies do post. Sem e-mail do autor da reply.
- `image` é o path público da foto ou `null`.

**400** — `VALIDATION_ERROR` — `id` inválido

**401** — `UNAUTHORIZED` — header `Authorization` presente, mas token malformado ou inválido

**404** — `NOT_FOUND`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Post not found"
  }
}
```

---

### 5.7 `POST /api/posts`

Cria um post para o usuário autenticado. `createdAt` é definido no momento da criação. `authorId` vem do usuário do token.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type** | `application/json` |

#### Input — `body`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `title` | `string` | Sim | Não vazio; trim; comprimento 1–200 |
| `content` | `string` | Sim | Não vazio; trim; comprimento ≥ 1 |
| `premium` | `boolean` | Não | Ausente → `false`. `true` só se o autor for premium |

#### Respostas

**201 Created**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "image": null,
  "premium": false,
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — inclusive `premium` com tipo inválido

**401** — `UNAUTHORIZED` — token ausente/inválido

**403** — `FORBIDDEN` — usuário autenticado não premium enviou `premium: true`. Nada é gravado.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only premium users can mark posts as premium"
  }
}
```

---

### 5.8 `PUT /api/posts/:id`

Atualização **parcial** do próprio post. Pode enviar só `title`, só `content`, só `premium`, ou qualquer combinação. Pelo menos um desses campos deve estar presente. Não altera a imagem do post (use `PUT /api/posts/:id/image`).

`premium` ausente não muda a marca. `premium: false` pode ser enviado por qualquer autor no próprio post. `premium: true` só pelo autor que já é premium; caso contrário **403** e nada é gravado (nem os outros campos do body).

Ordem quando o post existe e o caller é premium, ou quando o post não é premium: post inexistente ou premium visto por quem não é premium → **404**; post de outro autor → **403** de ownership; autor não premium enviando `premium: true` → **403** da marca.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type** | `application/json` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — `body`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `title` | `string` | Não* | Se presente: não vazio; trim; 1–200 |
| `content` | `string` | Não* | Se presente: não vazio; trim; ≥ 1 |
| `premium` | `boolean` | Não* | Se presente: boolean. Ausente não altera a marca |

\* Objeto deve ter **pelo menos um** de `title`, `content` ou `premium`. Campos extras devem ser rejeitados (schema estrito / `.strict()`).

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "image": null,
  "premium": false,
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — params/body inválidos, body vazio ou `premium` com tipo inválido

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — post existe, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only update your own posts"
  }
}
```

**403** — `FORBIDDEN` — autor não premium enviou `premium: true`

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only premium users can mark posts as premium"
  }
}
```

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium (`"Post not found"`)

---

### 5.9 `PUT /api/posts/:id/image`

Atualiza a imagem do **próprio** post. O arquivo é obrigatório e deve ser uma imagem válida. Substitui a imagem anterior, se houver. Não altera `title` nem `content`.

Confirmar visibilidade antes de ownership: post inexistente ou premium visto por quem não é premium → **404**; post visível de outro autor → **403**.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type** | `multipart/form-data` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — arquivo

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `image` | arquivo | Sim | Imagem válida; MIME `image/jpeg`, `image/png` ou `image/webp` |

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "image": "/uploads/posts/...",
  "premium": false,
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — `id` inválido, arquivo ausente, tipo não permitido ou imagem inválida

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — post existe, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only update your own posts"
  }
}
```

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium (`"Post not found"`)

---

### 5.10 `DELETE /api/posts/:id`

Hard delete do próprio post. Likes e replies daquele post são removidos em **cascade**. O arquivo da imagem do post, se existir, é removido do disco.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — body

Nenhum.

#### Respostas

**204 No Content** — corpo vazio

**400** — `VALIDATION_ERROR` — `id` inválido

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — post existe, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only delete your own posts"
  }
}
```

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium (`"Post not found"`)

---

### 5.11 `POST /api/posts/:id/likes`

Curte o post. **Idempotente**: se o usuário já curtiu, o estado não muda e a resposta é a mesma. O autor do post **pode** curtir o próprio post. Sem body.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — body

Nenhum.

#### Respostas

**204 No Content** — corpo vazio (já curtido ou recém-curtido)

**400** — `VALIDATION_ERROR` — `id` inválido

**401** — `UNAUTHORIZED`

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Post not found"
  }
}
```

O **401** de token ausente ou inválido é resolvido antes de olhar o post.

---

### 5.12 `DELETE /api/posts/:id/likes`

Remove o like do usuário autenticado naquele post. **Idempotente**: se o usuário não tinha curtido, o estado não muda e a resposta é a mesma. Sem body.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — body

Nenhum.

#### Respostas

**204 No Content** — corpo vazio (não curtido ou recém-descurtido)

**400** — `VALIDATION_ERROR` — `id` inválido

**401** — `UNAUTHORIZED`

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium (`"Post not found"`)

---

### 5.13 `POST /api/posts/:id/replies`

Cria uma reply no post. `createdAt` é definido no momento da criação. `authorId` vem do usuário do token. Não há thread: reply só existe no post, nunca em outra reply.

Depois de persistir a reply, se o autor da reply **não** for o autor do post, o sistema enfileira o envio de e-mail ao autor do post (autor da reply, trecho do conteúdo e identificação do post). Responder o próprio post **não** gera e-mail. Falha ao enfileirar ou de SMTP não desfaz a reply: a resposta continua **201**.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type** | `application/json` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — `body`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `content` | `string` | Sim | Não vazio; trim; comprimento ≥ 1 |

Campos extras devem ser rejeitados (schema estrito / `.strict()`).

#### Respostas

**201 Created**

```json
{
  "id": 1,
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR`

**401** — `UNAUTHORIZED`

**404** — `NOT_FOUND` — post inexistente, ou post premium visto por usuário que não é premium (`"Post not found"`)

---

### 5.14 `DELETE /api/posts/:id/replies/:replyId`

Hard delete da **própria** reply. O autor do post **não** pode apagar reply de outra pessoa. Sem body.

Para quem não é premium, post premium e post inexistente são o mesmo **404** `"Post not found"`, também quando o id da reply está errado. Nos demais casos, confirmar que o post existe e que a reply existe **naquele** post antes de checar ownership: post ou reply inexistente (ou reply de outro post) → **404**; reply existe no post mas não pertence ao usuário autenticado → **403**.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input — `params`

| Campo | Tipo | Obrigatório | Regras (Zod) |
|-------|------|-------------|--------------|
| `id` | `number` (coerce) | Sim | Inteiro positivo (id do post) |
| `replyId` | `number` (coerce) | Sim | Inteiro positivo |

#### Input — body

Nenhum.

#### Respostas

**204 No Content** — corpo vazio

**400** — `VALIDATION_ERROR` — `id` ou `replyId` inválido

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — reply existe no post, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only delete your own replies"
  }
}
```

**404** — `NOT_FOUND` — post inexistente ou premium visto por quem não é premium (`"Post not found"`); reply inexistente naquele post (`"Reply not found"`) nos demais casos

---

### 5.15 `POST /api/me/checkout`

Cria uma Checkout Session de pagamento único no Stripe para o usuário autenticado e devolve somente a URL hospedada. Não concede o acesso. Usuário que já é premium recebe **409** e a sessão não é criada.

| | |
|--|--|
| **Authorization** | Sim — `Bearer <token>` |

#### Input

Nenhum (`body`, `params` e `query` vazios).

A sessão é criada com:

- `mode`: `payment`
- `line_items`: preço `STRIPE_PRICE_ID`, quantidade `1`
- `success_url`: `STRIPE_SUCCESS_URL`
- `cancel_url`: `STRIPE_CANCEL_URL`
- `client_reference_id`: id do usuário autenticado, em string
- `customer_email`: e-mail do usuário autenticado

#### Respostas

**200 OK**

```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**401** — `UNAUTHORIZED` — token ausente ou inválido

**409** — `CONFLICT` — usuário já é premium

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User is already premium"
  }
}
```

Falha ao criar a sessão no Stripe → **500** `INTERNAL_ERROR`.

---

### 5.16 `POST /api/webhook/stripe`

Recebe o webhook do Stripe. Não exige token de sessão: a autenticidade é o header `Stripe-Signature`, verificado com `STRIPE_WEBHOOK_SECRET` sobre o **body cru** (os bytes originais, antes de qualquer parse JSON).

Observa o evento `checkout.session.completed`. Nesse evento, lê `client_reference_id`. Se o id corresponde a um usuário, `users.premium` passa a `true` (se já era `true`, permanece). Se o id não corresponde a um usuário, ou não é um id de usuário, nada muda. Evento de outro tipo, com assinatura válida, é reconhecido e ignorado. Nenhum outro evento altera `premium`.

| | |
|--|--|
| **Authorization** | Não |
| **Content-Type** | `application/json` (body cru) |

#### Input

- Header `Stripe-Signature` (obrigatório para aceitar o evento).
- Body: payload do evento, como o Stripe enviou.

#### Respostas

**200 OK** — corpo vazio.

A assinatura é válida e:

- o evento é `checkout.session.completed` e `client_reference_id` veio preenchido; ou
- o evento é de outro tipo.

**400** — `VALIDATION_ERROR`

Assinatura ausente ou inválida:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid Stripe webhook"
  }
}
```

Evento `checkout.session.completed` sem `client_reference_id`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing client_reference_id"
  }
}
```

---

## 6. Matriz de erros por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 |
|----------|-----|-----|-----|-----|-----|
| `POST /api/auth/register` | ✓ | | | | ✓ |
| `POST /api/auth/login` | ✓ | ✓ | | | |
| `GET /api/me` | | ✓ | | | |
| `PUT /api/me/avatar` | ✓ | ✓ | | | |
| `POST /api/me/checkout` | | ✓ | | | ✓ |
| `POST /api/webhook/stripe` | ✓ | | | | |
| `GET /api/posts` | ✓ | ✓ | | | |
| `GET /api/posts/:id` | ✓ | ✓ | | ✓ | |
| `POST /api/posts` | ✓ | ✓ | ✓ | | |
| `PUT /api/posts/:id` | ✓ | ✓ | ✓ | ✓ | |
| `PUT /api/posts/:id/image` | ✓ | ✓ | ✓ | ✓ | |
| `DELETE /api/posts/:id` | ✓ | ✓ | ✓ | ✓ | |
| `POST /api/posts/:id/likes` | ✓ | ✓ | | ✓ | |
| `DELETE /api/posts/:id/likes` | ✓ | ✓ | | ✓ | |
| `POST /api/posts/:id/replies` | ✓ | ✓ | | ✓ | |
| `DELETE /api/posts/:id/replies/:replyId` | ✓ | ✓ | ✓ | ✓ | |

Erros **500** (`INTERNAL_ERROR`) podem ocorrer em qualquer endpoint diante de falha inesperada.

---

## 7. Fora deste contrato

- Perfil completo (editar `name`/`email`, trocar senha). `GET /api/me` e avatar estão no contrato.
- Logout / invalidação explícita de sessão.
- Papéis e permissões além de autenticado vs público.
- Soft delete, status de publicação, slug, rascunhos.
- Tags.
- Thread de replies (reply em reply).
- Like em reply.
- Paginação de replies.
- Edição de reply.
- Remover imagem do post ou avatar sem substituir.
- Provedor de e-mail externo (SES/SendGrid); armazenamento de imagem em S3/blob no banco.
- Expiração, renovação, reembolso ou desmarcar um usuário premium. Filtro de listagem por premium, feed separado ou preview de post bloqueado. `premium` no autor público, no register, no login ou no avatar. Papel de admin ou marcação manual fora do webhook. Guardar valor pago, customer ou id da sessão.
