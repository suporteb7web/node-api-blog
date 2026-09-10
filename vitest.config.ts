import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      UPLOADS_DIR: 'uploads-test',
    },
  },
});
