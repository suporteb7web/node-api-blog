# PRD — Usuário e post premium

Feature em que um usuário pode ser marcado como premium e um post pode ser marcado como premium. O acesso premium é concedido uma vez, depois que o Stripe confirma o pagamento. Não expira.

O checkout (`POST /api/me/checkout`) e o webhook (`POST /api/webhook/stripe`) já existem. Este PRD cobre a marca no usuário, a marca no post e quem pode ver ou alterar cada um. O detalhe de request/response continua em [`docs/api.md`](../../api.md), que deve ser atualizado junto com a implementação.

---

## 1. Visão geral

- Um usuário tem `premium: false` até o webhook de pagamento concluído.
- Um post tem `premium: false` até o autor, sendo premium, marcar o contrário.
- A listagem pública continua sem os posts premium. Eles entram na mesma listagem, na mesma ordem (`createdAt` desc), quando o pedido traz um token válido de usuário premium.
- Usuário premium vê os posts premium dele e os de outros usuários premium.
- Só um usuário premium pode marcar um post como premium, na criação ou na edição.
- Quem não é premium recebe, sobre um post premium, o mesmo **404** de post inexistente.

---

## 2. Dados

| Recurso | Campo novo | Default |
|---------|------------|---------|
| `users` | `premium` (boolean) | `false` |
| `posts` | `premium` (boolean) | `false` |

Usuários e posts já existentes nascem não premium. Não há data de expiração, plano nem identificador de pagamento.

---

## 3. Visibilidade

A listagem passa a aceitar `Authorization` **opcional**, no mesmo critério de `GET /api/posts/:id`:

| Quem pede | O que a listagem devolve |
|-----------|--------------------------|
| Sem header | Só posts com `premium: false` |
| Header presente, token inválido | **401** `UNAUTHORIZED` |
| Token válido, usuário não premium | Só posts com `premium: false` |
| Token válido, usuário premium | Posts premium e não premium |

`meta.total` e `meta.totalPages` contam só os posts visíveis para aquele pedido. A página mistura os dois tipos quando o leitor é premium; a ordem é só `createdAt` desc.

Leitura e interação com um post premium:

| Operação | Sem token | Token inválido | Token válido, não premium | Token válido, premium |
|----------|-----------|----------------|---------------------------|------------------------|
| `GET /api/posts/:id` | **404** | **401** | **404** | **200** |
| Like, unlike, reply, apagar reply, editar, editar imagem, excluir | **401** | **401** | **404** | Regra atual do endpoint |

O **401** das rotas que já exigem login continua sendo resolvido antes de olhar o post. Assim, a ausência de token não revela se o id é premium ou público.

Para quem não é premium, post premium e post inexistente são indistinguíveis: **404** `NOT_FOUND` com `"Post not found"`. Isso vale também quando o id da reply está errado.

Entre usuários premium, ownership não muda: editar, trocar imagem ou excluir post de outro autor continua **403**; apagar reply de outro autor continua **403**. Curtir e responder o próprio post premium continua permitido.

Reply em post premium só é criada por quem já passou nessa visibilidade. O e-mail ao autor do post segue a regra atual (não envia quando o autor da reply é o autor do post).

---

## 4. Marcar um post como premium

`premium` é boolean opcional no body JSON de `POST /api/posts` e `PUT /api/posts/:id`.

- Ausente na criação → o post fica `premium: false`.
- Ausente na edição → a marca não muda.
- `true` → só o autor premium pode. Usuário autenticado que não é premium recebe **403** `FORBIDDEN` (`"Only premium users can mark posts as premium"`) e nada é gravado.
- `false` → qualquer autor pode, no próprio post. Num post que já é `false`, o valor não muda.
- Tipo inválido → **400** `VALIDATION_ERROR`.

Na edição, `title`, `content` ou `premium` satisfazem a regra de “pelo menos um campo”. O restante do update parcial permanece.

Ordem quando o post existe e o caller é premium, ou quando o post não é premium:

1. Post inexistente, ou premium visto por quem não é premium → **404**.
2. Post de outro autor → **403** de ownership, como hoje.
3. Autor não premium enviando `premium: true` → **403** da marca.

Um usuário premium pode criar e manter posts não premium.

---

## 5. Como o usuário vira premium

`POST /api/me/checkout` continua só devolvendo a URL da Checkout Session. Não marca o usuário.

- Usuário ainda não premium → **200** com `{ "url" }`, como hoje.
- Usuário já premium → **409** `CONFLICT` (`"User is already premium"`). A sessão no Stripe não é criada.

O acesso nasce no webhook, no evento `checkout.session.completed`, depois da assinatura válida e com `client_reference_id` preenchido:

- O id corresponde a um usuário → `users.premium` passa a `true`. A resposta continua **200** com corpo vazio.
- O usuário já é premium (o Stripe reenvia o evento) → permanece `true`, **200**.
- O id não corresponde a um usuário existente → **200** e nada muda.
- `client_reference_id` ausente → **400**, como hoje.
- Outro tipo de evento, com assinatura válida → **200** e ignorado, como hoje.

Voltar da `success_url` não concede o acesso. O cliente vê o estado em `GET /api/me` depois que o webhook gravou a marca.

Nenhum outro evento (reembolso, cancelamento, falha de pagamento) altera `premium`.

---

## 6. O que muda na resposta

`premium` (boolean) entra em:

- `GET /api/me`
- todo JSON de post: listagem, `GET`, create, update e update de imagem

Register, login e `PUT /api/me/avatar` permanecem sem esse campo. O objeto `author` de post e de reply também: continua `{ id, name }`.

---

## 7. Fora de escopo

- Expiração, renovação, reembolso ou desmarcar um usuário premium.
- Assinatura recorrente. O checkout segue pagamento único.
- Filtro de listagem por premium, feed separado ou preview de post bloqueado.
- `premium` no autor público, no register, no login ou no avatar.
- Papel de admin, cortesia ou marcação manual fora do webhook.
- Guardar valor pago, customer ou id da sessão.
