import { defineConfig } from 'vitest/config';

// 단위 테스트: src 안의 *.spec.ts
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      reportsDirectory: './coverage',
    },
  },
});
