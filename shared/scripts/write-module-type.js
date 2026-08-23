// tsc emits both builds as bare .js. Node decides CJS vs ESM from the nearest
// package.json "type", so stamp one into each output directory — otherwise the
// ESM build would be read as CommonJS and its `export` syntax would throw.
// It also runs before the watchers in `npm run dev`, where the output
// directories do not exist yet, so create them first.
const { mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');

const dist = join(__dirname, '..', 'dist');

for (const [dir, type] of [['cjs', 'commonjs'], ['esm', 'module']]) {
  mkdirSync(join(dist, dir), { recursive: true });
  writeFileSync(join(dist, dir, 'package.json'), JSON.stringify({ type }, null, 2) + '\n');
}
