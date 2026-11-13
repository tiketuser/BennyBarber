import type { Backend } from './backend';
import { BACKEND } from '@/config/shop';

/** Single switch point: the shop config (shops/<id>/config.ts) `backend` picks demo data or Firebase. Firebase is loaded only when used. */
export async function createBackend(): Promise<Backend> {
  if (BACKEND === 'firebase') return (await import('./firebase/firebaseBackend')).createFirebaseBackend();
  return (await import('./mock/mockBackend')).createMockBackend();
}
