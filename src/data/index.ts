import type { Backend } from './backend';
import { createMockBackend } from './mock/mockBackend';

// Single switch point. When Firebase is wired: `import.meta.env.VITE_BACKEND === 'firebase' ? createFirebaseBackend() : ...`
export function createBackend(): Backend {
  return createMockBackend();
}

