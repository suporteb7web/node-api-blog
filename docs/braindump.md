# Projeto: API de Blog (com usuários e posts)

Uma API de blog com usuário (cadastro e login), criação e gestão (edit/del) de posts (só os próprios) e uma listagem pública de todos os posts em ordem cronológica inversa (do mais recente para o mais antigo).

Recursos de dados:
- users
- posts

Relacionamento 1:N (um user pode ter vários posts, um post relacionado a um user)

No login do usuário, usar senha com hash salvo em uma coluna no banco do user.

Projeto será feito com Vite Vanilla Typescript

Docker com Docker compose:
- banco de dados postgresql 17
- banco de teste
- dois volumes separados (test e prod)

A autorização da API será feita através de Header Authorization com Bearer (mandando o hash salvo no banco).

A implementação do projeto será feita usando TDD para cada task e os testes utilizarão vitest como biblioteca (e o banco de teste para evitar mock de banco de dados).






