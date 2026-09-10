# AGENTS.md — node-api-blog

API REST de blog (auth + posts + likes + replies + mídia + e-mail). Contrato canônico: [`docs/api.md`](docs/api.md). Requisitos: [`docs/project-prd.md`](docs/project-prd.md).

Antes de mudar comportamento HTTP, conferir `docs/api.md`. Não inventar endpoints, campos ou códigos de erro fora desse contrato. Upload, avatar e notificação por e-mail **entram no contrato junto** com a implementação.

## O que o projeto faz

- Cadastro e login geram um **token de sessão** (hex, 32 bytes) persistido em `users.token` e devolvido ao cliente.
- Listagem e GET de post são **públicos**. Criar/editar/excluir exigem `Authorization: Bearer <token>`. GET por id aceita token **opcional** (`likedByMe`).
- Um usuário só edita/exclui **os próprios posts** (hard delete). Likes e replies em cascade com o post.
- Usuário autenticado curte/descurte posts e cria replies. Só o **autor da reply** apaga a própria reply.
- Foto opcional no post e **avatar** no usuário: arquivo em disco, **path** no banco.
- Nova reply em um post **de outra pessoa** dispara e-mail ao autor do post (Nodemailer + Mailpit em dev/teste).
- Sem logout, papéis, soft delete, threads, like em reply, tags ou troca de senha.

## Stack

| Peça | Tecnologia |
|------|------------|
| Runtime | Node.js, ESM (`"type": "module"`), TypeScript `strict` |
| HTTP | Express 5 |
| Upload (borda) | Multer (`memoryStorage`) — **só na rota/middleware** |
| Imagem | Sharp (processar + gravar em disco) |
| E-mail | Nodemailer; Mailpit (SMTP + UI) em dev/teste |
| Validação | Zod 4 |
| ORM / banco | Drizzle ORM + PostgreSQL 17 |
| Senha | bcrypt (cost 10) |
| Testes | Vitest + Supertest contra o **banco de teste real** |

O PRD menciona Vite; a implementação usa `tsx` no dev e `tsc` no build. Siga o `package.json`.

Imports TypeScript usam extensão `.js` (NodeNext): `import { x } from './foo.js'`.

## Comandos

```bash
cp .env.example .env   # se ainda não existir
npm run db:up          # Postgres app :6000, teste :6001, Mailpit SMTP :1025 / UI :8025
npm run db:migrate
npm run dev            # http://localhost:3000
npm test               # NODE_ENV=test vitest run
```

Outros: `db:generate` (drizzle-kit), `db:studio`, `db:down`, `build`, `start`.

Testes precisam dos containers `db-test` e **Mailpit** no ar. `fileParallelism: false` no Vitest — os specs compartilham o mesmo banco.

## Mapa de pastas

```
src/
  server.ts              # dotenv + listen (não importar nos testes)
  app.ts                 # createApp(): json, static de uploads, rotas, errorHandler
  db/schema.ts           # tabelas Drizzle
  db/index.ts            # pool; DATABASE_URL_TEST se NODE_ENV=test
  routes/                # paths HTTP + requireAuth + Multer (só aqui)
  controllers/           # HTTP: validar → use case → DTO → status/json
  use-cases/             # regras de negócio (sem req/res); recebem Buffer, não File do Multer
  repositories/          # interface + implementação Drizzle (path da imagem, não o arquivo)
  storage/               # Sharp: processar buffer e salvar em disco; devolver path relativo
  mailer/                # interface + Nodemailer; Mailpit só via SMTP_HOST/PORT
  schemas/               # Zod (body/params/query)
  dtos/                  # mapeamento de resposta
  middlewares/           # requireAuth, errorHandler; Multer se for middleware dedicado
  errors/app-error.ts    # AppError + ErrorCode
  types/                 # AuthUser; Express.Request.user
  utils/                 # validate(), generateSessionToken()
uploads/                 # arquivos gerados (não versionar o conteúdo)
tests/                   # *.spec.ts por endpoint (integração HTTP)
docs/                    # PRD, contrato da API, braindump
drizzle/                 # migrations geradas
```

## Arquitetura (obrigatória)

```
Route → Controller → Use Case → Repository (interface)
  ↑          ↑            ↓              ↓
Multer   Zod+validate  Sharp/mailer   Drizzle → DB (path)
(borda)       ↓
            DTO (resposta)
```

| Camada | Faz | Não faz |
|--------|-----|---------|
| **Route** | Path, método, `requireAuth`, **Multer** | Validação de negócio, regra, SQL, Sharp, e-mail |
| **Controller** | `validate()`, extrai `req.file?.buffer`, chama `useCase.execute()`, mapeia DTO, define status | Acessar `db` / Drizzle; gravar arquivo; enviar e-mail; importar Multer/Sharp |
| **Use case** | Regras (hash, token, ownership, 404/403/409); recebe **`Buffer`**; chama storage/mailer | Express (`req`/`res`), `req.file`, formato JSON |
| **Storage (Sharp)** | Redimensionar/normalizar e **salvar em disco**; retornar path | HTTP, Zod, `AppError` de negócio, SQL |
| **Mailer** | Enviar e-mail (Nodemailer) | HTTP, persistência, Sharp |
| **Repository** | Persistência. Interface em `*.repository.ts`, impl `drizzle-*.repository.ts` | HTTP, Zod, `AppError` de negócio, I/O de arquivo |
| **DTO** | Shape estável da resposta (`createdAt` em ISO 8601) | |

Padrão atual: controller instancia o repositório Drizzle e os use cases **no topo do módulo** (singletons). Storage e mailer também entram por injeção no use case — não instanciar Nodemailer/Sharp no controller.

Exceção existente: `requireAuth` consulta `db.query.users` direto. Não espalhar isso; novos acessos a dados vão no repositório.

O contrato em `docs/api.md` fala em "Service"; no código a camada se chama **use case**. Use esse nome.

### Upload — Multer só na borda

Multer existe **apenas** na rota (ou middleware de rota). `memoryStorage()`: o arquivo **não** vai para disco no Multer.

Fluxo:

1. Rota aplica Multer (campo `photo` no post, `avatar` no usuário).
2. Controller lê `req.file` (se houver), valida MIME/tamanho já recusados na borda, e passa `{ buffer, mimetype }` ao use case. Sem arquivo → `buffer` omitido/undefined.
3. Use case chama o storage com o **Buffer**. Sharp processa (redimensionar, converter) e grava em disco (`uploads/posts/` ou `uploads/avatars/`).
4. Use case persiste **somente o path relativo** via repositório (`posts.photoPath`, `users.avatarPath`). Nunca blob no Postgres.

Regras:

- Use case **não** importa `multer` e **não** recebe `Express.Multer.File` — só `Buffer` + metadados (`mimetype`).
- Controller **não** chama Sharp nem `fs.writeFile`.
- Repositório **não** lê/grava arquivo; só a string do path.
- Substituir imagem: apagar o arquivo antigo no storage **depois** de persistir o path novo (use case orquestra).
- Hard delete do post: remover o arquivo da foto no disco no mesmo use case de exclusão. Troca de avatar: apagar o arquivo anterior.
- Servir arquivos com `express.static` em `app.ts` (ex.: `/uploads`). Path público no DTO (URL ou path estável), nunca o binário.
- Arquivo inválido / tipo não permitido → 400 `VALIDATION_ERROR` na borda (Multer `fileFilter` / limits) ou no use case se Sharp falhar ao decodificar.

### E-mail — reply no meu post

- Transport: **Nodemailer**. Em dev/teste o SMTP é o **Mailpit** (Compose). Sem SendGrid/SES neste projeto.
- Interface de mailer (porta) + implementação Nodemailer. Use case de criar reply **depende da interface**, não do `createTransport` direto.
- Disparo **depois** de persistir a reply, no `CreateReplyUseCase` (efeito colateral de negócio, não no controller).
- Enviar só se `reply.authorId !== post.authorId`. Responder o próprio post **não** gera e-mail.
- Destinatário: e-mail do **autor do post**. Corpo inclui autor da reply, trecho do conteúdo e identificação do post. Não incluir senha/token.
- Falha de SMTP não deve corromper a reply já gravada; logar/tratar sem rollback da reply (request de criação ainda **201**).
- Testes: Mailpit real (API HTTP do Mailpit para listar mensagens). Não mockar o mailer nos specs de reply. Limpar a caixa do Mailpit no `beforeEach` junto com o banco.

## HTTP

Prefixo da API: `/api`. Health: `GET /health` (fora de `/api`).

| Método | Path | Auth |
|--------|------|------|
| `POST` | `/api/auth/register` | não |
| `POST` | `/api/auth/login` | não |
| `GET` | `/api/posts` | não |
| `GET` | `/api/posts/:id` | opcional |
| `POST` | `/api/posts` | sim |
| `PUT` | `/api/posts/:id` | sim |
| `DELETE` | `/api/posts/:id` | sim |
| `POST` | `/api/posts/:id/likes` | sim |
| `DELETE` | `/api/posts/:id/likes` | sim |
| `POST` | `/api/posts/:id/replies` | sim |
| `DELETE` | `/api/posts/:id/replies/:replyId` | sim |

Paths de **avatar** e de foto no create/update de post ficam em `docs/api.md` — atualizar o contrato **junto** com a feature. Upload é `multipart/form-data` nessas rotas; o restante da API continua `application/json`.

- Register → **201** `{ token, user: { id, name, email } }` (já autenticado). Incluir `avatar` no user quando o campo existir no contrato.
- Login → **200** mesmo shape; gera **novo** token (substitui o anterior na coluna).
- Create post → **201**; update → **200**; delete → **204** corpo vazio. Foto opcional: campo de arquivo na borda; JSON `title`/`content` no mesmo multipart.
- Listagem: query `page` (inteiro ≥ 1, default 1), `limit` **fixo 10**, ordem `createdAt` desc. Envelope `{ data, meta: { page, limit, total, totalPages } }`.
- Post na resposta: `{ id, title, content, createdAt, author: { id, name } }` — nunca e-mail do autor, nunca senha/hash. Incluir path/URL da foto e do avatar do autor quando o contrato definir.
- Update é **parcial** (`title` e/ou `content` e/ou foto); body `strict` no JSON; pelo menos um campo.
- Create reply → **201**; além de persistir, notifica o autor do post por e-mail (exceto auto-reply). Delete reply → **204**.

Erros (sempre este envelope):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| HTTP | `code` |
|------|--------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` |
| 500 | `INTERNAL_ERROR` |

Lançar `new AppError(status, code, message, details?)`. O `errorHandler` serializa `AppError`, `ZodError` (400) e o resto (500, sem vazar stack).

`validate(schema, data)` faz `safeParse` e lança `AppError` 400 com `details: [{ path, message }]`. Usar nos controllers para body/params/query.

## Autenticação

- Header: `Authorization: Bearer <token>`. Ausente, malformado, vazio ou desconhecido → 401 `Unauthorized`.
- Token válido: `req.user = { id, name, email }`.
- Ownership (editar/excluir post de outro) → 403 no **use case**, depois de confirmar que o post existe (404 se não existir).
- Login com e-mail/senha errados → 401 genérico `"Invalid email or password"` (não revelar qual falhou).
- E-mail duplicado no register → 409 `"Email already registered"`. E-mail é normalizado para lowercase.

## Banco

Tabelas em `src/db/schema.ts`:

- `users`: `id` serial, `name`, `email` unique, `password` (hash), `token` nullable, `avatarPath` nullable (path relativo em disco).
- `posts`: `id` serial, `title`, `content`, `createdAt` (`created_at` timestamptz), `authorId` → `users.id`, `photoPath` nullable (path relativo em disco).
- `likes`: PK composta (`userId`, `postId`); `postId` em cascade.
- `replies`: `id` serial, `content`, `createdAt`, `authorId` → `users.id`, `postId` → `posts.id` (cascade). Sem thread.

`.env`: app `localhost:6000/blog`, testes `localhost:6001/blog_test`. SMTP Mailpit `localhost:1025`; UI/API Mailpit `localhost:8025`. Docker Compose com volumes separados (Postgres). Uploads de teste em diretório distinto do de desenvolvimento (`UPLOADS_DIR`).

Mudança de schema: editar `schema.ts` → `npm run db:generate` → `npm run db:migrate`. Não editar SQL em `drizzle/` na mão. Não guardar binário de imagem no Postgres.

## Testes

TDD: para comportamento novo/alterado, começar pelo spec HTTP.

- Arquivos: `tests/<domínio>/<ação>.spec.ts`.
- `createApp()` + Supertest. Não subir `server.ts`.
- `beforeEach(cleanDatabase)`, `afterAll(closeDatabase)` (`tests/helpers/database.ts`). Também limpar pasta de uploads de teste e a caixa do Mailpit.
- Sem mock de banco. Sem mock do mailer nos specs de reply — assertir mensagem no Mailpit. Exercitar auth, validação, 403/404, persistência quando fizer sentido.
- Upload: `.attach(...)` no Supertest (buffer em memória). Assertir arquivo em disco + path no banco + URL no DTO.
- Assertir `status` + `body.error.code` nos erros; shape completo nas respostas de sucesso.

## Ao adicionar feature

1. Alinhar com `docs/api.md` (ou atualizar o contrato **junto** se o pedido mudar o HTTP).
2. Spec de integração.
3. Schema Zod → route (Multer se houver arquivo) → controller (Buffer) → use case → storage/mailer + repositório (interface + Drizzle) → DTO.
4. Não vazar senha/token hash. Não retornar e-mail no `author` de posts (e-mail só no destino SMTP e no `user` de auth).
5. Não adicionar logout, perfil completo, admin, soft delete, etc., salvo pedido explícito. Avatar **não** é perfil completo: só o arquivo/path.

## Fora de escopo (PRD)

Troca de senha, logout/invalidação explícita, roles, soft delete, rascunhos, slug, threads de reply, like em reply, tags, provedor de e-mail externo (SES/SendGrid), armazenamento de imagem em S3/blob no banco.
