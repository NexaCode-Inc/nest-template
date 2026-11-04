import { defineConfig } from 'vitest/config';

// e2e 테스트: test 안의 *.e2e-spec.ts (앱 전체를 띄워서 DB·설정이 필요하다)
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
  },
});
