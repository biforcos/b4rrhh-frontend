// Candado del sitio de los clientes (issue #122).
//
//   npm run lint:client-location
//
// Un `*.client.ts` va en la carpeta `client/` de su feature, junto al gateway
// que lo usa (`client/ → gateway/ → store/ → ui/`), o en `core/api/clients/`,
// donde viven los de la ficha del empleado, que son anteriores a la regla y se
// quedan. En ningun otro sitio. La regla esta en el CLAUDE.md del workspace.
//
// Por que hace falta: la regla escrita decia `core/api/clients/` para todos, y
// diez clientes la contradecian desde hacia meses sin que nadie lo viera. Se
// cambio la regla, no los ficheros; y una regla sin candado vuelve a quedarse
// atras en silencio.
//
// Queda fuera el cliente generado de la API (`core/api/generated`), que no
// tiene `*.client.ts` y se regenera entero del contrato.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Y se comprueban en las dos direcciones: una excepcion que ya esta en su
// sitio, o que ya no existe, hace fallar el candado hasta que se borra.

import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = join(import.meta.dirname, '..', 'src', 'app');
const GENERATED = join(APP, 'core', 'api', 'generated');

/** Fichero (relativo a src/app) → por que vive fuera de una carpeta de clientes. Solo puede encoger. */
const EXCEPCIONES = new Map([
  [
    'core/availability/backend-health.client.ts',
    'No envuelve el contrato: pregunta al actuator, que no esta en el OpenAPI, y sin sesion ' +
      '(frontend#59). Es parte de la disponibilidad del backend que monta el shell de core, no ' +
      'de una feature con gateway.',
  ],
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full !== GENERATED) out.push(...walk(full));
    } else if (name.endsWith('.client.ts') || name.endsWith('.client.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (path) => relative(APP, path).split(sep).join('/');
const enSuSitio = (f) => f.startsWith('core/api/clients/') || f.split('/').slice(0, -1).at(-1) === 'client';

const clientes = walk(APP).map(rel).sort();
const fuera = clientes.filter((f) => !enSuSitio(f));
const nuevos = fuera.filter((f) => !EXCEPCIONES.has(f));
const sobran = [...EXCEPCIONES.keys()].filter((f) => !fuera.includes(f));

let roto = false;

if (nuevos.length > 0) {
  roto = true;
  console.error(
    `Clientes fuera de su sitio (#122): ${nuevos.length}. Un *.client.ts va en la carpeta ` +
      'client/ de su feature o en core/api/clients/:',
  );
  for (const f of nuevos) console.error(`  src/app/${f}`);
  console.error(
    '\nUna de dos: se mueve a la carpeta client/ de su feature, o se apunta en EXCEPCIONES de ' +
      'este fichero con el motivo por el que vive fuera. No hay tercera.',
  );
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no hacen falta: el fichero ya esta en su sitio o ` +
      'ya no existe. Borralas de EXCEPCIONES:',
  );
  for (const f of sobran) console.error(`  src/app/${f}`);
}

if (roto) process.exit(1);

console.log(
  `lint:client-location: ${clientes.length} clientes, todos en una carpeta client/ o en ` +
    'core/api/clients/' +
    (EXCEPCIONES.size > 0 ? ` salvo ${EXCEPCIONES.size} excepcion(es) con motivo` : ''),
);
