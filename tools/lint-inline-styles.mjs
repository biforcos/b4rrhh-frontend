// Candado de los estilos inline (issue #41): un componente Angular no lleva
// `styles:` dentro del .ts. Sus estilos van en un .scss propio (`styleUrl`),
// que es el unico sitio que mira el candado del sistema de color
// (lint:styles, `stylelint "src/app/**/*.scss"`). Con estilos inline el color
// literal no lo veia nadie, y por ahi se colo un morado en la primera pantalla
// que ve cualquiera.
//
//   npm run lint:inline-styles
//
// El cliente generado se excluye porque no es nuestro y no tiene componentes.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const EXCLUDED_DIRS = new Set(['generated']);

// `styles:` o `styles :` al principio de linea, dentro del decorador. Vale
// tanto el literal de plantilla como el array de strings. Un `styleUrl` o
// `styleUrls` no casa: el nombre es distinto.
const INLINE_STYLES = /^\s*styles\s*:/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path);
    } else if (path.endsWith('.ts') && !path.endsWith('.spec.ts')) {
      yield path;
    }
  }
}

const hits = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (INLINE_STYLES.test(line)) {
      hits.push(`${relative(process.cwd(), file).split(sep).join('/')}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (hits.length > 0) {
  console.error(
    `Estilos inline en un componente (#41); ${hits.length} bloque(s) 'styles:' en src/app/. ` +
      'Van en un .scss de al lado con styleUrl, que es donde los vigila lint:styles:',
  );
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('lint:inline-styles: ningun componente con styles: inline en src/app/');
