// Prints the shops that are ready to deploy (backend 'firebase' with a Firebase web config), one id per line.
import { SHOPS } from '../shops/index.ts';

for (const [id, shop] of Object.entries(SHOPS)) {
  if (shop.backend === 'firebase' && shop.firebase.apiKey && shop.firebase.appId) console.log(id);
}
