import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Optional: to use Vitest's globals like describe, it, expect without importing
    environment: 'node', // Suitable for API/backend testing
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'], // Coverage report formats
      include: ['src/**/*.ts'], // Files to include in coverage
      exclude: [
        'src/db/**', // Exclude database schema, migrations, etc.
        'src/**/types.ts',
        'src/**/*.d.ts'
      ],
    },
    // Optional: Setup files to run before each test file (e.g., for global mocks or db setup)
    setupFiles: ['./tests/setup.ts'],
  },
}); 