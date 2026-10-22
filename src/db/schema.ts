import { boolean, integer, pgTable, primaryKey, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  token: text('token'),
  avatarPath: text('avatar_path'),
  premium: boolean('premium').notNull().default(false),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id),
  photoPath: text('photo_path'),
  premium: boolean('premium').notNull().default(false),
});

export const likes = pgTable(
  'likes',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.postId] })],
);

export const replies = pgTable('replies', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
});
