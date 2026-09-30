// Candado de las fechas en crudo (issue #120).
//
//   npm run lint:raw-dates
//
// Una fecha se pinta de una sola manera, `dd/mm/aaaa`, y sale de un solo sitio:
// `DISPLAY_DATE_FORMAT` en `shared/utils/local-date.util.ts`. En una plantilla,
// `| date: displayDateFormat`; en el codigo, `formatDisplayDate(…)`. Lo vio el
// #116 en la ficha de una empresa: la cabecera decia `01/09/2026` y el bloque
// «Identificacion», a un palmo, `2026-09-01`, porque ese lo pintaba tal cual.
//
// ─── Que se mira ────────────────────────────────────────────────────────────
//
// Toda interpolacion `{{ … }}` de las plantillas (.html y `template:` en linea)
// que nombra un campo de fecha —un identificador que acaba en `Date`, o un
// `.date`— tiene que pasar por el formateador: un `| date` o una llamada a
// `formatDisplayDate`, `formatLongDisplayDate` o `formatLongDisplayDateRange`.
//
// Un metodo del componente que recibe la fecha y devuelve texto NO cuenta,
// aunque formatee por dentro: desde la plantilla no se ve, y asi es como se
// colaba `occurrenceLabel(code, startDate)`, que devolvia `${code} · ${startDate}`.
//
// Lo que no se mira: los `[value]` de los campos, que llevan el ISO a proposito
// porque es lo que viaja; y los campos `…At` con hora, que ya van con su
// `| date` y no son este defecto.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Y se comprueban en las dos direcciones: una excepcion que ya no hace falta
// hace fallar el candado hasta que se borra.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const EXCLUDED_DIRS = new Set(['generated']);

/** `fichero::expresion` → por que se pinta sin el formateador. Solo puede encoger. */
const EXCEPCIONES = new Map([]);

const PASA_POR_EL_FORMATEADOR = /\|\s*date\b|\bformat(?:Long)?DisplayDate(?:Range)?\s*\(/;
const CAMPO_DE_FECHA = /\b[A-Za-z_$][\w$]*Date\b|\.date\b/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIRS.has(name)) out.push(...walk(full));
    } else if (name.endsWith('.html') || (name.endsWith('.ts') && !name.endsWith('.spec.ts'))) {
      out.push(full);
    }
  }
  return out;
}

function plantillas(path) {
  const source = readFileSync(path, 'utf8');
  if (path.endsWith('.html')) return [source];
  return [...source.matchAll(/template:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
}

const sinCadenas = (expr) => expr.replace(/'[^']*'|"[^"]*"/g, "''");

const encontradas = [];
for (const path of walk(ROOT)) {
  const rel = relative(join(ROOT, '..', '..'), path)
    .split(sep)
    .join('/');
  for (const plantilla of plantillas(path)) {
    for (const m of plantilla.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      const expr = m[1].replace(/\s+/g, ' ').trim();
      const limpia = sinCadenas(expr);
      if (CAMPO_DE_FECHA.test(limpia) && !PASA_POR_EL_FORMATEADOR.test(limpia)) {
        encontradas.push(`${rel}::${expr}`);
      }
    }
  }
}

const nuevas = encontradas.filter((clave) => !EXCEPCIONES.has(clave));
const sobran = [...EXCEPCIONES.keys()].filter((clave) => !encontradas.includes(clave));

let roto = false;

if (nuevas.length > 0) {
  roto = true;
  console.error(
    `Fechas pintadas sin el formateador (#120): ${nuevas.length}. Salen en ISO, o en el ` +
      'formato que le toque, al lado de otras en dd/mm/aaaa:',
  );
  for (const clave of nuevas) console.error(`  ${clave}`);
  console.error(
    '\nEn la plantilla, `| date: displayDateFormat`; en el codigo, `formatDisplayDate(…)`, los ' +
      'dos de src/app/shared/utils/local-date.util.ts.',
  );
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no se pintan asi. Borralas de EXCEPCIONES:`,
  );
  for (const clave of sobran) console.error(`  ${clave}`);
}

if (roto) process.exit(1);

console.log(
  'lint:raw-dates: ninguna fecha pintada sin el formateador en las plantillas de src/app/',
);
