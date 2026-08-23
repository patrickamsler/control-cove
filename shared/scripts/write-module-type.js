// tsc emits both builds as bare .js. Node decides CJS vs ESM from the nearest
// package.json "type", so stamp one into each output directory — otherwise the
// ESM build would be read as CommonJS and its `export` syntax would throw.
const { writeFileSync } = require('fs');
const { join } = require('path');

const dist = join(__dirname, '..', 'dist');
writeFileSync(join(dist, 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
writeFileSync(join(dist, 'esm', 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');
