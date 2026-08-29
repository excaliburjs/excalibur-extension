import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.spec.ts', 'src/**/*.spec.ts']
        }
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser/**/*.spec.ts'],
          setupFiles: ['./test/browser/setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
});
