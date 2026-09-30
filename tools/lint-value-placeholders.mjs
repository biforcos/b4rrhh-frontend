// Candado de los placeholders que parecen valores (issue #129).
//
//   npm run lint:value-placeholders
//
// Un placeholder dice como se rellena un campo, no lo rellena. Cuando lo que
// pone es un valor valido para ese campo —`ACME` en un codigo de empresa,
// `ESP` en un pais, `202604` en un periodo, `0` en un porcentaje—, quien lo lee
// no sabe si es un ejemplo o lo que hay puesto. Ha salido tres veces: el
// periodo de recibos (#93), el sistema de reglas del alta de empresa (#124) y
// el codigo de empresa (#129).
//
// Mira los `placeholder="..."` de las plantillas (.html y `template:` en linea)
// y los textos cuya clave lleva `Placeholder` en los `*.texts.ts`. Un valor es:
//
//   - un numero                     (`0`, `202604`)
//   - un codigo en mayusculas       (`ESP`, `ACME`, `EMP001`, `HE_QTY`)
//   - una sola palabra en minusculas sin espacios (`bifor`)
//
// salvo los formatos conocidos (`dd/mm/aaaa`, `aaaamm`), que no son un valor
// valido para su campo sino su forma. Un ejemplo que lo dice («Ej: HE_QTY»,
// «Ejemplo: EMP000001») no es un valor: lleva espacios y lo avisa.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Clave `fichero|placeholder`. Una excepcion que ya no se encuentra hace
// fallar el candado hasta que se borra.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = join(import.meta.dirname, '..', 'src', 'app');
const GENERATED = join(APP, 'core', 'api', 'generated');

/** Formatos: la forma del campo, no un valor suyo. */
const FORMATOS = new Set(['dd/mm/aaaa', 'aaaamm']);

/** `fichero|placeholder` → por que puede quedarse. Solo puede encoger. */
const EXCEPCIONES = new Map([]);

const PARECE_UN_VALOR = [
  { patron: /^-?\d+([.,]\d+)?$/, que: 'un numero' },
  { patron: /^[A-Z][A-Z0-9_]*$/, que: 'un codigo en mayusculas' },
  { patron: /^[a-z][a-z0-9._-]*$/, que: 'una palabra suelta, como un usuario' },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full !== GENERATED) out.push(...walk(full));
    } else if (name.endsWith('.html') || (name.endsWith('.ts') && !name.endsWith('.spec.ts'))) {
      out.push(full);
    }
  }
  return out;
}

const rel = (path) => relative(APP, path).split(sep).join('/');
const lineOf = (source, index) => source.slice(0, index).split('\n').length;

function placeholdersDe(file, source) {
  const found = [];
  for (const m of source.matchAll(/(?<![\w\]])placeholder="([^"]*)"/g)) {
    found.push({ value: m[1], line: lineOf(source, m.index) });
  }
  for (const m of source.matchAll(/\[(?:attr\.)?placeholder\]="'([^']*)'"/g)) {
    found.push({ value: m[1], line: lineOf(source, m.index) });
  }
  if (file.endsWith('.texts.ts') || file.endsWith('app-texts.ts')) {
    for (const m of source.matchAll(/\b\w*Placeholder\w*\s*:\s*'([^']*)'/g)) {
      found.push({ value: m[1], line: lineOf(source, m.index) });
    }
  }
  return found;
}

const hallados = [];
for (const file of walk(APP)) {
  const f = rel(file);
  for (const p of placeholdersDe(f, readFileSync(file, 'utf8'))) {
    const valor = p.value.trim();
    if (FORMATOS.has(valor)) continue;
    const parece = PARECE_UN_VALOR.find(({ patron }) => patron.test(valor));
    if (parece) hallados.push({ f, ...p, que: parece.que, clave: `${f}|${p.value}` });
  }
}

const nuevos = hallados.filter((h) => !EXCEPCIONES.has(h.clave));
const sobran = [...EXCEPCIONES.keys()].filter((k) => !hallados.some((h) => h.clave === k));

let roto = false;

if (nuevos.length > 0) {
  roto = true;
  console.error(
    `Placeholders que parecen un valor (#129): ${nuevos.length}. Quien los lee no sabe si es un ` +
      'ejemplo o lo que hay puesto:',
  );
  for (const h of nuevos) console.error(`  src/app/${h.f}:${h.line}  «${h.value}» — ${h.que}`);
  console.error(
    '\nUna de tres: se quita, se cambia por la forma del campo («Hasta 30 caracteres», ' +
      '«Código ISO de 3 letras»), o se apunta en EXCEPCIONES de este fichero con el motivo.',
  );
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no se encuentran. Borralas de EXCEPCIONES:`,
  );
  for (const k of sobran) console.error(`  ${k}`);
}

if (roto) process.exit(1);

console.log(
  'lint:value-placeholders: ningun placeholder parece un valor' +
    (EXCEPCIONES.size > 0 ? ` (${EXCEPCIONES.size} excepcion(es) con motivo)` : ''),
);
