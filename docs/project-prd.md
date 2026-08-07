# PRD — API de Blog

## 1. Visão geral

API de blog com autenticação de usuários e gestão de posts. Usuários autenticados podem criar e gerenciar apenas os próprios posts. A listagem e a consulta individual de posts são públicas.

---

## 2. Requisitos funcionais

### 2.1 Autenticação

- O sistema deve permitir **cadastro** de usuário com `name`, `email` e `password`.
- O `email` deve ser único.
- A senha deve ser armazenada apenas como **hash** (nunca em texto puro).
- Após o cadastro, o usuário já fica autenticado: o sistema gera um **token de sessão**, persiste no banco e o retorna ao cliente.
- O sistema deve permitir **login** com `email` e `password`.
- No login bem-sucedido, o sistema gera um token de sessão, persiste no banco e o retorna ao cliente.
- Rotas protegidas devem exigir o header `Authorization: Bearer <token>`.
- Escopo limitado a **auth + posts** (sem perfil, troca de senha, logout ou papéis de admin).

### 2.2 Posts

- Qualquer usuário autenticado pode **criar** um post com `title` e `content`.
- O post deve registrar `createdAt` no momento da criação.
- A **listagem de posts** é pública, em ordem cronológica inversa (mais recente → mais antigo).
- A listagem deve incluir o **nome do autor** (não o e-mail).
- A listagem deve ser **paginada** via query `page`, convertida internamente em `offset` + `limit`.
- Deve existir **consulta pública de um post por id**, também com o nome do autor.
- O autor pode **editar** apenas os próprios posts, com **update parcial** (pode alterar só `title`, só `content`, ou ambos).
- O autor pode **excluir** apenas os próprios posts, com **hard delete**.
- Tentativas de editar ou excluir post de outro usuário devem ser rejeitadas.

### 2.3 Dados e relacionamentos

| Recurso | Campos principais | Observações |
|--------|-------------------|-------------|
| `users` | `name`, `email`, `password` (hash), token de sessão | `email` único |
| `posts` | `title`, `content`, `createdAt`, referência ao autor | Relação 1:N com `users` |

- Um usuário pode ter vários posts; cada post pertence a um único usuário.

---

## 3. Especificações técnicas (alto nível)

### 3.1 Stack

| Camada | Tecnologia |
|--------|------------|
| Linguagem / bundling | TypeScript com Vite (template vanilla-ts) |
| HTTP | Express |
| ORM | Drizzle |
| Banco | PostgreSQL 17 |
| Hash de senha | bcrypt |
| Testes | Vitest |
| Infra local | Docker Compose |

### 3.2 Autorização

- Autenticação baseada em **token de sessão** persistido no banco.
- Cliente envia o token no header `Authorization` no formato Bearer.

### 3.3 Persistência e ambientes

- Docker Compose com PostgreSQL 17.
- Banco de **aplicação** e banco de **teste**, com **volumes separados**.
- Testes de integração usam o banco de teste real (sem mock de banco).

### 3.4 Qualidade

- Desenvolvimento orientado a TDD: cada task começa pelos testes.
- Testes com Vitest contra o banco de teste.

---

## 4. Fora de escopo

- Perfil do usuário (consultar/editar dados, trocar senha).
- Logout explícito / invalidação avançada de sessão.
- Papéis e permissões além de “autenticado vs público”.
- Soft delete, status de publicação, slug, rascunhos.
- Detalhamento de rotas, contratos de request/response e configuração fina de Docker/env (ficam para documentação ou implementação posterior).
