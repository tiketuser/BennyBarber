// Every shop the app is built for. `npm run new-shop <id>` adds a line here.
import bennycohen from './bennycohen/config.ts';
import orpani from './orpani/config.ts';

export const SHOPS = {
  bennycohen,
  orpani,
} as const;
