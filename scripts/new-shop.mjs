// Starts a new barbershop: npm run new-shop <id>   (id: lowercase latin letters, e.g. dannylevi)
// Copies shops/_template, registers it in shops/index.ts and draws its icons. Then fill shops/<id>/config.ts.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9]*$/.test(id)) throw new Error('usage: npm run new-shop <id>  (lowercase latin letters and digits)');
if (existsSync(`shops/${id}`)) throw new Error(`shops/${id} already exists`);

cpSync('shops/_template', `shops/${id}`, { recursive: true });
const config = `shops/${id}/config.ts`;
writeFileSync(config, readFileSync(config, 'utf8').replaceAll('SHOPID', id));

const index = readFileSync('shops/index.ts', 'utf8')
  .replace(/(import [^\n]+\n)(\n)/, `$1import ${id} from './${id}/config.ts';\n$2`)
  .replace(/(\n} as const;)/, `\n  ${id},$1`);
writeFileSync('shops/index.ts', index);

execSync('node --experimental-strip-types --no-warnings scripts/make-icons.mjs', { stdio: 'inherit', env: { ...process.env, SHOP: id } });
console.log(`\nCreated shops/${id}. Fill in ${config}, then push: it deploys once backend is 'firebase' and the Firebase config is filled.`);
