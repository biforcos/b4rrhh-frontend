// Candado de las hojas desenchufadas (issue #21, tercer candado del comentario
// del 30/08): un .scss de componente tiene que estar declarado en el `styleUrl`
// de su .ts. Si no, no llega a la pantalla y nadie se entera.
//
//   npm run lint:orphan-styles
//
// Sale del #28: `ui-select.component.scss` eran 44 lineas con tokens, anillo de
// foco y estado deshabilitado que no se aplicaban en ninguno de los ~28
// desplegables de la aplicacion. Ni `ng build`, ni `stylelint`, ni los tests
// dicen nada de una hoja que nadie enchufa: el fichero es .scss valido, el
// componente compila, y la pantalla sale sin estilar. Solo se ve mirandola.
//
// El barrido del #28 confirmo que era el unico huerfano de aquel dia. Este
// candado es para que no vuelva a haber uno.
//
// Se comprueban las dos direcciones, porque las dos duelen:
//
//   1. Un .scss al lado de un .ts que no lo nombra en su styleUrl: escrito y
//      desenchufado. Es el caso del #28.
//   2. Un .scss sin .ts hermano: queda de un componente que se fue o se
//      renombro, y no lo aplica ni puede aplicarlo nadie.
//
// Lo que NO se mira es el contenido: una hoja enchufada y vacia es asunto de
// otro candado. Aqui solo se pregunta si llega a la pantalla.
//
// El cliente generado se excluye: no es nuestro y no tiene componentes.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const EXCLUDED_DIRS = new Set(['generated']);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path);
    } else if (path.endsWith('.scss')) {
      yield path;
    }
  }
}

function relativo(path) {
  return relative(process.cwd(), path).split(sep).join('/');
}

/**
 * El .ts hermano: el mismo nombre con otra extension. Es la convencion de
 * Angular y la que sigue todo el arbol; si algun dia deja de serlo, aqui es
 * donde hay que decirlo, y no en silencio.
 */
function hermanoTs(scss) {
  return join(dirname(scss), basename(scss, '.scss') + '.ts');
}

const desenchufadas = [];
const sinComponente = [];

for (const scss of walk(ROOT)) {
  const ts = hermanoTs(scss);
  let fuente;
  try {
    fuente = readFileSync(ts, 'utf8');
  } catch {
    sinComponente.push(relativo(scss));
    continue;
  }

  // Basta con que el .ts nombre el fichero: vale styleUrl, styleUrls y
  // cualquier forma de citarlo. Lo que se busca es que este enchufado, no
  // con que sintaxis.
  if (!fuente.includes(basename(scss))) {
    desenchufadas.push(`${relativo(scss)}  (su ${basename(ts)} no la nombra)`);
  }
}

if (desenchufadas.length > 0 || sinComponente.length > 0) {
  console.error(
    'Hojas de estilo que no llegan a la pantalla (#21, #28): ' +
      `${desenchufadas.length} desenchufada(s) y ${sinComponente.length} sin componente.`,
  );
  if (desenchufadas.length > 0) {
    console.error('  Escritas y no aplicadas; falta el styleUrl en el .ts de al lado:');
    for (const hit of desenchufadas) console.error(`    ${hit}`);
  }
  if (sinComponente.length > 0) {
    console.error('  Sin .ts hermano: sobran, o al componente se le cambio el nombre:');
    for (const hit of sinComponente) console.error(`    ${hit}`);
  }
  process.exit(1);
}
console.log('lint:orphan-styles: todas las hojas de src/app/ estan enchufadas a su componente');
