// Candado del idioma (b4rrhh/frontend#113): lo que se pinta va en castellano. Falla si
// una plantilla o un `*.texts.ts` trae una palabra que delata un literal en inglés
// («Create», «Open», «Name», «Code», «Rule», «Type»…).
//
//   npm run lint:english
//   node tools/lint-english-labels.mjs --inventario   # además, los literales de los .ts
//
// ─── Qué mira ──────────────────────────────────────────────────────────────
//
// - Las plantillas: los `.html` y los `template:` de los `.ts`. De ellas, el texto entre
//   etiquetas y los atributos que se pintan escritos a mano (`label="…"`, `placeholder="…"`,
//   `aria-label="…"`…). No mira lo enlazado (`[label]="texts.x"`): eso sale de un
//   `*.texts.ts`, que se mira aparte. Tampoco las interpolaciones ni el control de flujo
//   (`@if (form.hasError('required'))` no es texto).
// - Los `*.texts.ts`: todos sus literales de cadena. Ahí está casi todo lo que se pinta.
//
// Con `--inventario` recorre además los literales del resto de los `.ts` (componentes,
// stores, mappers). Ahí hay mucho que no se pinta —rutas, selectores, claves—, así que no
// es candado: es el listado que se revisa a mano, el que pedía el paso 1 del issue.
//
// ─── Lo que llega del servidor no se traduce aquí ───────────────────────────
//
// Los nombres de catálogo, los códigos y los mensajes que manda el backend no son literales
// de este árbol y este candado no los ve. Si llegan en inglés, es un issue de backend.
//
// ─── Las excepciones van con nombre y solo pueden encoger ───────────────────
//
// Cada una dice el fichero, el literal y por qué. Si una deja de aparecer, el candado falla
// pidiendo que se borre: una excepción que ya no hace falta es un agujero.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const EXCLUDED_DIRS = new Set(['generated']);
const INVENTORY = process.argv.includes('--inventario');

// Palabras que en castellano no existen, o no se escriben así. «No», «error», «total» o
// «general» no están porque son castellano. Se comparan enteras y sin mayúsculas.
const TELLS = [
  'active',
  'inactive',
  'add',
  'and',
  'back',
  'business',
  'cancel',
  'characters',
  'close',
  'code',
  'codes',
  'country',
  'create',
  'date',
  'delete',
  'description',
  'details',
  'edit',
  'empty',
  'end',
  'entity',
  'entities',
  'exactly',
  'failed',
  'for',
  'found',
  'is',
  'key',
  'loading',
  'maintenance',
  'must',
  'name',
  'new',
  'of',
  'open',
  'remove',
  'required',
  'rule',
  'rules',
  'save',
  'search',
  'select',
  'start',
  'status',
  'submit',
  'system',
  'systems',
  'the',
  'type',
  'types',
  'update',
  'with',
  'yes',
  'yet',
  'action',
  'actions',
  'employee',
  'number',
  'value',
  'done',
  'manage',
  'confirm',
  'rows',
  'data',
  'timeline',
  'event',
  'events',
];
const TELL = new RegExp(`(?<!\\p{L})(${TELLS.join('|')})(?!\\p{L})`, 'iu');

// Atributos que se pintan tal cual están escritos en la plantilla.
const SHOWN_ATTRIBUTES =
  /(?<![[(\w.-])(label|placeholder|header|title|aria-label|pTooltip|emptyMessage|alt)="([^"]*)"/g;

/** { fichero, literal, motivo } */
const EXCEPTIONS = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path);
    } else {
      yield path;
    }
  }
}

const display = (file) => relative(process.cwd(), file).split(sep).join('/');
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;
// Tapa un tramo con espacios sin mover los saltos de línea: los desplazamientos siguen valiendo.
const blank = (s) => s.replace(/[^\n]/g, ' ');

/** Salta un paréntesis equilibrado que empieza en `from`; devuelve el índice después del cierre. */
function skipParens(text, from) {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i + 1;
  }
  return text.length;
}

/** Los trozos de una plantilla que se pintan como texto, con su desplazamiento. */
function templatePieces(template) {
  const pieces = [];
  let text = template.replace(/<!--[\s\S]*?-->/g, blank);

  const TAG = /<\/?[a-zA-Z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
  text = text.replace(TAG, (tag, offset) => {
    for (const match of tag.matchAll(SHOWN_ATTRIBUTES)) {
      pieces.push({ offset: offset + match.index, text: match[2] });
    }
    return blank(tag);
  });

  text = text.replace(/\{\{[\s\S]*?\}\}/g, blank);
  text = text.replace(/@let\s[^;]*;/g, blank);

  // Control de flujo: `@if (…) {`, `} @else if (…) {`, `@for (…; track …) {`, `@case (…) {`…
  let out = '';
  for (let i = 0; i < text.length; ) {
    const block =
      /^@(else\s+if|if|else|for|switch|case|default|empty|defer|placeholder|loading|error)\b\s*/.exec(
        text.slice(i),
      );
    if (block) {
      let end = i + block[0].length;
      if (text[end] === '(') end = skipParens(text, end);
      out += blank(text.slice(i, end));
      i = end;
    } else {
      out += text[i] === '{' || text[i] === '}' ? ' ' : text[i];
      i++;
    }
  }

  for (const match of out.matchAll(/[^\s][^\n]*/g)) {
    pieces.push({ offset: match.index, text: match[0].trim() });
  }
  return pieces;
}

/** Los literales de cadena de un .ts, con su desplazamiento. */
function stringLiterals(source) {
  const literals = [];
  const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length)));
  for (const match of withoutComments.matchAll(LITERAL)) {
    const value = (match[1] ?? match[2] ?? match[3]).replace(/\$\{[^}]*\}/g, ' ');
    literals.push({ offset: match.index, text: value });
  }
  return literals;
}

const hits = [];
const inventory = [];
function check(file, source, pieces, into) {
  for (const piece of pieces) {
    const tell = TELL.exec(piece.text);
    if (!tell) continue;
    into.push({
      file: display(file),
      line: lineAt(source, piece.offset),
      text: piece.text,
      word: tell[1],
    });
  }
}

for (const file of walk(ROOT)) {
  if (file.endsWith('.spec.ts')) continue;
  const source = readFileSync(file, 'utf8');

  if (file.endsWith('.html')) {
    check(file, source, templatePieces(source), hits);
  } else if (file.endsWith('.texts.ts')) {
    check(file, source, stringLiterals(source), hits);
  } else if (file.endsWith('.ts')) {
    const inline = /\btemplate\s*:\s*`((?:[^`\\]|\\.)*)`/.exec(source);
    if (inline) {
      const start = inline.index + inline[0].indexOf('`') + 1;
      const pieces = templatePieces(inline[1]).map((p) => ({ ...p, offset: p.offset + start }));
      check(file, source, pieces, hits);
    }
    if (INVENTORY) {
      const outside = inline
        ? source.slice(0, inline.index) +
          blank(inline[0]) +
          source.slice(inline.index + inline[0].length)
        : source;
      const literals = stringLiterals(outside).filter(
        // Fuera lo que no se pinta: imports, rutas, selectores, claves sin espacios en
        // minúscula y códigos en mayúsculas (`IS_A_CORRECTION`, `ACTIVE`).
        (l) =>
          (/\s/.test(l.text.trim()) || /^\p{Lu}/u.test(l.text)) && !/^[A-Z0-9_]+$/.test(l.text),
      );
      check(file, source, literals, inventory);
    }
  }
}

const excused = (hit) =>
  EXCEPTIONS.find((e) => e.fichero === hit.file && hit.text.includes(e.literal));
const pending = hits.filter((hit) => !excused(hit));
const stale = EXCEPTIONS.filter(
  (e) => !hits.some((hit) => hit.file === e.fichero && hit.text.includes(e.literal)),
);

if (INVENTORY) {
  console.log(
    `Literales de .ts fuera de plantillas y textos (${inventory.length}), para revisar a mano:`,
  );
  for (const hit of inventory) console.log(`  ${hit.file}:${hit.line}: [${hit.word}] ${hit.text}`);
  console.log('');
}

if (pending.length > 0 || stale.length > 0) {
  if (pending.length > 0) {
    console.error(
      `Literales en inglés en plantillas o textos (#113): ${pending.length}. ` +
        'Van en castellano, con las palabras que ya usa el resto de la aplicación:',
    );
    for (const hit of pending)
      console.error(`  ${hit.file}:${hit.line}: [${hit.word}] ${hit.text}`);
  }
  if (stale.length > 0) {
    console.error('Excepciones que ya no hacen falta; se borran de la lista:');
    for (const e of stale) console.error(`  ${e.fichero}: «${e.literal}»`);
  }
  process.exit(1);
}
console.log('lint:english: sin literales en inglés en plantillas ni textos de src/app/');
