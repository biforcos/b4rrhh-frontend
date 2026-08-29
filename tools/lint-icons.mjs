// Candado del set de iconos propio (issue #11): primeicons se retiró y no debe
// volver a colarse. Falla si algún fichero de src/ referencia un icono `pi pi-*`
// o una clase `pi-...` de esa fuente. El cliente generado se excluye porque no
// es nuestro y no lleva iconos.
//
//   npm run lint:icons
//
// Los iconos propios van por <b4-icon name="...">; ver docs/identidad-visual.md.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src');
const EXCLUDED_DIRS = new Set(['generated']);
const EXTENSIONS = new Set(['.ts', '.html', '.scss', '.css']);
// Tambien la clase base `.pi` a secas —que es la que lleva el font-family— y el
// nombre del paquete: sin esto el candado da verde con un `.toast .pi { color }`
// huerfano dentro, que es justo como se colo uno al migrar los toasts.
const PRIMEICON =
  /\bpi pi-[a-z]|(?<![\w-])pi-[a-z][a-z-]*(?![\w-])|(?<![\w-])\.pi(?![\w-])|primeicons/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path);
    } else if ([...EXTENSIONS].some((ext) => path.endsWith(ext))) {
      yield path;
    }
  }
}

const hits = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (PRIMEICON.test(line)) {
      hits.push(`${relative(process.cwd(), file).split(sep).join('/')}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (hits.length > 0) {
  console.error(`primeicons se retiró (#11); ${hits.length} referencia(s) a pi-* en src/:`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('lint:icons: sin referencias a primeicons en src/');
