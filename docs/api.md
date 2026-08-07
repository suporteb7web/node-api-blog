# Contrato de implementação — API de Blog

Documento de contrato derivado do [PRD](./project-prd.md). Define visão geral, stack, arquitetura de camadas e o contrato HTTP de cada endpoint (método, path, autenticação, inputs, respostas e erros).

---

## 1. Visão geral

API de blog com autenticação de usuários e gestão de posts.

- Cadastro e login geram um **token de sessão** persistido no banco e retornado ao cliente.
- Rotas protegidas exigem `Authorization: Bearer <token>`.
- Usuários autenticados podem criar, editar e excluir **apenas os próprios posts**.
- Listagem e consulta individual de posts são **públicas**.
- Escopo limitado a **auth + posts** (sem perfil, logout, papéis de admin, soft delete, etc.).

### Relacionamentos

| Recurso | Campos principais | Observações |
|--------|-------------------|-------------|
| `users` | `id`, `name`, `email`, `password` (hash), `token` (sessão) | `email` único |
| `posts` | `id`, `title`, `content`, `createdAt`, `authorId` | Relação 1:N com `users` |

Um usuário pode ter vários posts; cada post pertence a um único usuário.

---

## 2. Stack (alto nível)

| Camada | Tecnologia |
|--------|------------|
| Linguagem / bundling | TypeScript com Vite (template vanilla-ts) |
| HTTP | Express |
| Validação de input | Zod |
| ORM | Drizzle |
| Banco | PostgreSQL 17 |
| Hash de senha | bcrypt |
| Testes | Vitest |
| Infra local | Docker Compose (app DB + test DB, volumes separados) |

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
| 403 | `FORBIDDEN` | Autenticado, mas sem permissão (ex.: editar/excluir post de outro autor) |
| 404 | `NOT_FOUND` | Recurso não encontrado |
| 409 | `CONFLICT` | Violação de unicidade (ex.: e-mail já cadastrado) |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

### 4.5 Paginação

- Query `page` (inteiro ≥ 1). Default: `1`.
- Convertida internamente em `offset` + `limit`.
- `limit` fixo da implementação: **10** itens por página.
- Fórmula: `offset = (page - 1) * limit`.

### 4.6 IDs

- Identificadores de `users` e `posts` são inteiros positivos (gerados pelo banco), a menos que a implementação opte por UUID — neste contrato as respostas usam `number` como referência.

### 4.7 Datas

- `createdAt` em ISO 8601 (string), ex.: `"2026-08-07T21:00:00.000Z"`.

### 4.8 Senha

- Nunca retornada em nenhuma resposta (nem hash).
- Persistida apenas como hash bcrypt.

---

## 5. Endpoints

### Resumo

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/auth/register` | Não | Cadastro + retorno de token |
| `POST` | `/api/auth/login` | Não | Login + retorno de token |
| `GET` | `/api/posts` | Não | Listagem pública paginada |
| `GET` | `/api/posts/:id` | Não | Consulta pública por id |
| `POST` | `/api/posts` | Sim | Criar post |
| `PUT` | `/api/posts/:id` | Sim | Atualizar parcialmente o próprio post |
| `DELETE` | `/api/posts/:id` | Sim | Excluir (hard delete) o próprio post |

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
    "email": "string"
  }
}
```

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
    "email": "string"
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

### 5.3 `GET /api/posts`

Listagem pública de posts em ordem cronológica inversa (`createdAt` desc). Inclui o nome do autor (não o e-mail).

| | |
|--|--|
| **Authorization** | Não |

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
      "createdAt": "2026-08-07T21:00:00.000Z",
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

**400** — `VALIDATION_ERROR` — `page` inválida (ex.: `0`, negativo, não numérico)

---

### 5.4 `GET /api/posts/:id`

Consulta pública de um post por id, com nome do autor.

| | |
|--|--|
| **Authorization** | Não |

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
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — `id` inválido

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

### 5.5 `POST /api/posts`

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

#### Respostas

**201 Created**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR`

**401** — `UNAUTHORIZED` — token ausente/inválido

---

### 5.6 `PUT /api/posts/:id`

Atualização **parcial** do próprio post. Pode enviar só `title`, só `content`, ou ambos. Pelo menos um campo deve estar presente.

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

\* Objeto deve ter **pelo menos um** de `title` ou `content`. Campos extras devem ser rejeitados (schema estrito / `.strict()`).

#### Respostas

**200 OK**

```json
{
  "id": 1,
  "title": "string",
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": 1,
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — params/body inválidos ou body vazio

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

**404** — `NOT_FOUND` — post inexistente

---

### 5.7 `DELETE /api/posts/:id`

Hard delete do próprio post.

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

**404** — `NOT_FOUND` — post inexistente

---

## 6. Matriz de erros por endpoint

| Endpoint | 400 | 401 | 403 | 404 | 409 |
|----------|-----|-----|-----|-----|-----|
| `POST /api/auth/register` | ✓ | | | | ✓ |
| `POST /api/auth/login` | ✓ | ✓ | | | |
| `GET /api/posts` | ✓ | | | | |
| `GET /api/posts/:id` | ✓ | | | ✓ | |
| `POST /api/posts` | ✓ | ✓ | | | |
| `PUT /api/posts/:id` | ✓ | ✓ | ✓ | ✓ | |
| `DELETE /api/posts/:id` | ✓ | ✓ | ✓ | ✓ | |

Erros **500** (`INTERNAL_ERROR`) podem ocorrer em qualquer endpoint diante de falha inesperada.

---

## 7. Fora deste contrato (alinhado ao PRD)

- Perfil do usuário (consultar/editar dados, trocar senha).
- Logout / invalidação explícita de sessão.
- Papéis e permissões além de autenticado vs público.
- Soft delete, status de publicação, slug, rascunhos.
- Upload de mídia, comentários, likes, tags.
