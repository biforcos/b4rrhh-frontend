// Candado de las clases fantasma (b4rrhh/frontend#114): ninguna plantilla usa una clase que
// no defina ninguna hoja que le llegue.
//
//   npm run lint:phantom-classes
//
// ─── Por qué ───────────────────────────────────────────────────────────────
//
// PrimeFlex no está instalado, y las plantillas usaban sus utilidades: `p-4`, `h-full`,
// `mb-3`, `mt-0`. Una clase que no define nadie no rompe nada que se vea en un test: el
// componente compila y la pantalla sale. Sólo no hace lo que dice. `p-4` prometía relleno y
// la rejilla del alta se salía 8 px por la derecha (#112); `h-full` prometía igualar el alto
// de dos tarjetas y no las igualaba. La próxima que se copie puede desbordar.
//
// ─── Qué cuenta como definida para una plantilla ────────────────────────────
//
// Angular encapsula las hojas de componente: una clase de la hoja del alta no llega a la
// tarjeta de Empresas aunque se llamen igual. Así que no vale «alguna hoja la define»:
//
// - la hoja del propio componente (`styleUrl`), compilada con `sass`, así que `&__titulo`
//   dentro de `.panel` define `.panel__titulo`, como en la pantalla;
// - la hoja global (`src/styles.scss`) y las de los componentes con
//   `ViewEncapsulation.None`, que son globales de hecho;
// - lo que cualquier hoja declara en un `:host(.x)`, que es la clase que el padre le pone al
//   componente. Lo que va bajo `:host ::ng-deep` no: sólo llega por debajo de ese
//   componente, y cuenta como de su hoja;
// - el tema de PrimeNG (`@primeuix/styles`), que se inyecta en tiempo de ejecución: se lee de
//   sus fuentes y no por el prefijo, porque `p-4` también empieza por `p-`.
//
// ─── Qué cuenta como usada ─────────────────────────────────────────────────
//
// En los `.html` y los `template:`: `class="…"`, `[class.x]`, las claves literales de un
// `[ngClass]` y los `…styleClass="…"` que se pasan a PrimeNG. Lo que se compone en tiempo
// de ejecución (`[class]="expr"`) no se ve; ese hueco es conocido.
//
// Un gancho para un test no es una clase: un spec que busca un elemento lo busca por lo que
// es (su rol, su texto) o por un `data-testid`, no por una clase que no pinta nada.
//
// ─── Excepciones con nombre ────────────────────────────────────────────────
//
// Cada una dice la clase y por qué existe sin hoja. Se comprueban en las dos direcciones,
// como en `lint:own-cards`: una excepción que ya nadie usa también pone rojo el candado.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import * as sass from 'sass';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const PRIMEUIX = join(ROOT, 'node_modules', '@primeuix', 'styles', 'dist');
const EXCLUDED_DIRS = new Set(['generated', 'node_modules']);

/** { clase, motivo } */
const EXCEPTIONS = [];

function* walk(dir, accept) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path, accept);
    } else if (accept(path)) {
      yield path;
    }
  }
}

const display = (file) => relative(process.cwd(), file).split(sep).join('/');
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;
const CLASS_IN_SELECTOR = /\.((?:\\.|[\w-])+)/g;
const unescape = (name) => name.replace(/\\(.)/g, '$1');

/**
 * Las clases de una hoja compilada, separadas en las que se quedan en el componente y las que
 * declara para quien lo usa (`:host(.x)`).
 */
function classesInCss(css) {
  const own = new Set();
  const leaking = new Set();
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of withoutComments.matchAll(/([^{}]+)\{/g)) {
    // Lo que va antes de un `;` es otra sentencia (`@charset "UTF-8";`), no el selector.
    const selector = match[1].split(';').pop();
    if (selector.trim().startsWith('@')) continue;
    for (const part of selector.split(',')) {
      for (const cls of part.matchAll(CLASS_IN_SELECTOR)) {
        const name = unescape(cls[1]);
        if (/:host\([^)]*$/.test(part.slice(0, cls.index))) leaking.add(name);
        else own.add(name);
      }
    }
  }
  return { own, leaking };
}

const sheets = new Map();
const global = new Set();
const sassFailures = [];
for (const file of walk(SRC, (p) => p.endsWith('.scss'))) {
  try {
    const { css } = sass.compile(file, {
      loadPaths: [SRC, join(ROOT, 'node_modules')],
      logger: sass.Logger.silent,
    });
    const { own, leaking } = classesInCss(css);
    sheets.set(file, own);
    for (const cls of leaking) global.add(cls);
  } catch (error) {
    sassFailures.push(`${display(file)}: ${error.message.split('\n')[0]}`);
  }
}
for (const cls of sheets.get(join(SRC, 'styles.scss')) ?? []) global.add(cls);

// PrimeNG: sus estilos van como cadenas dentro de los módulos de `@primeuix/styles`.
for (const file of walk(PRIMEUIX, (p) => p.endsWith('.mjs') || p.endsWith('.js'))) {
  for (const cls of readFileSync(file, 'utf8').matchAll(/\.(p-[\w-]+)/g)) global.add(cls[1]);
}

/** Las hojas que declara un componente, por su `styleUrl` o `styleUrls`. */
function sheetsOf(componentSource, componentFile) {
  const declared = /styleUrls?\s*:\s*(\[[^\]]*\]|'[^']*')/.exec(componentSource);
  if (!declared) return [];
  return [...declared[1].matchAll(/'([^']+)'/g)].map((m) => join(dirname(componentFile), m[1]));
}

// Los componentes sin encapsular publican su hoja para todos.
const components = [...walk(join(SRC, 'app'), (p) => p.endsWith('.ts') && !p.endsWith('.spec.ts'))];
for (const file of components) {
  const source = readFileSync(file, 'utf8');
  if (!/ViewEncapsulation\.None/.test(source)) continue;
  for (const sheet of sheetsOf(source, file))
    for (const cls of sheets.get(sheet) ?? []) global.add(cls);
}

function usedClasses(template) {
  const used = [];
  const text = template.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  const push = (name, offset) => used.push({ name, offset });

  // class="a b" y los styleClass que se pasan a PrimeNG; no los enlazados ([class]).
  for (const m of text.matchAll(/(?<![[\w.-])((?:\w*[sS]tyle)?[cC]lass)="([^"]*)"/g)) {
    if (m[2].includes('{{')) continue;
    for (const name of m[2].split(/\s+/).filter(Boolean)) push(name, m.index);
  }
  // [class.x]="…"
  for (const m of text.matchAll(/\[class\.([\w:-]+)\]/g)) push(m[1], m.index);
  // [ngClass]="{ 'a b': x, c: y }"
  for (const m of text.matchAll(/\[ngClass\]="\{([^"]*)\}"/g)) {
    for (const key of m[1].matchAll(/(?:^|,)\s*(?:'([^']+)'|([\w-]+))\s*:/g)) {
      for (const name of (key[1] ?? key[2]).split(/\s+/).filter(Boolean)) push(name, m.index);
    }
  }
  return used;
}

/** El componente de una plantilla `.html`: el `.ts` de al lado que la nombra. */
function componentOfTemplate(htmlFile) {
  const sibling = htmlFile.replace(/\.html$/, '.ts');
  const candidates = existsSync(sibling) ? [sibling] : [];
  candidates.push(...components.filter((c) => dirname(c) === dirname(htmlFile)));
  return candidates.find((c) => readFileSync(c, 'utf8').includes(`'./${basename(htmlFile)}'`));
}

const uses = [];
for (const file of walk(join(SRC, 'app'), (p) => p.endsWith('.html') || p.endsWith('.ts'))) {
  if (file.endsWith('.spec.ts')) continue;
  const source = readFileSync(file, 'utf8');
  let template = source;
  let start = 0;
  let component = file;
  if (file.endsWith('.ts')) {
    const inline = /\btemplate\s*:\s*`((?:[^`\\]|\\.)*)`/.exec(source);
    if (!inline) continue;
    template = inline[1];
    start = inline.index + inline[0].indexOf('`') + 1;
  } else {
    component = componentOfTemplate(file);
  }
  const own = new Set(
    component
      ? sheetsOf(readFileSync(component, 'utf8'), component).flatMap((s) => [
          ...(sheets.get(s) ?? []),
        ])
      : [],
  );
  for (const use of usedClasses(template)) {
    uses.push({
      ...use,
      file: display(file),
      line: lineAt(source, use.offset + start),
      defined: own.has(use.name) || global.has(use.name),
    });
  }
}

const excused = new Map(EXCEPTIONS.map((e) => [e.clase, e]));
const phantoms = uses.filter((use) => !use.defined && !excused.has(use.name));
const stale = EXCEPTIONS.filter((e) => !uses.some((use) => use.name === e.clase && !use.defined));

let failed = false;
if (sassFailures.length > 0) {
  failed = true;
  console.error('Hojas que sass no compila; sin ellas el candado no sabe qué definen:');
  for (const failure of sassFailures) console.error(`  ${failure}`);
}
if (phantoms.length > 0) {
  failed = true;
  console.error(
    `Clases que no define ninguna hoja que llegue a su plantilla (#114): ${phantoms.length}. ` +
      'Se sustituyen por lo que querían decir, en la hoja del componente:',
  );
  for (const use of phantoms) console.error(`  ${use.file}:${use.line}: .${use.name}`);
}
if (stale.length > 0) {
  failed = true;
  console.error('Excepciones que ya no hacen falta; se borran de la lista:');
  for (const e of stale) console.error(`  .${e.clase}`);
}
if (failed) process.exit(1);
console.log(`lint:phantom-classes: ${uses.length} usos de clase en las plantillas, todos con hoja`);
