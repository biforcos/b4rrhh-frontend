import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ningún error genérico en pantalla (`b4rrhh/frontend#92`), barrido y no enumerado a mano.
 *
 * <p>Un «No se pudo…» sólo puede llegar a la pantalla por el molde (`describeFailure`), que le pega
 * lo que dijo el servidor o, si no dijo nada, lo que se sabe por el estado HTTP. Este spec recorre el
 * código y se queja de:
 *
 * <ol>
 *   <li>un texto de los ficheros `*.texts.ts` que empiece por «No se pudo», «Error al»… y se use
 *       fuera de una llamada a `describeFailure`;</li>
 *   <li>un literal así en un componente o un store que no sea la acción de un `describeFailure`;</li>
 *   <li>un «Reintenta» o «Inténtalo de nuevo» escrito a mano: si reintentar sirve lo decide el
 *       molde, que sabe si fue la red o un rechazo.</li>
 * </ol>
 *
 * <p>Lo que se deja pasar va en {@link EXCEPTIONS}, con su porqué.
 */
const APP = resolve(process.cwd(), 'src/app');
const GENERIC = /^(No se pud|No se han? podido|Error al |Error procesando)/;
const GENERIC_LITERAL =
  /(['"`>]\s*)(No se pud[^'"`<{]*|No se han? podido[^'"`<{]*|Error al [^'"`<{]*)/g;
const RETRY = /Reintenta\b|Inténtalo de nuevo|Vuelve a intentarlo/;

/** Lo que se deja pasar, con su porqué. Clave: `fichero relativo a src/app` o `clave de texto`. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  // El prefijo va pegado al mensaje del servidor, que es exactamente lo que hace el molde.
  conflictErrorMessagePrefix: 'se concatena con el mensaje del servidor',
  // Y éste es el 409 sin mensaje: dice que hubo conflicto, que es lo que se sabe.
  conflictGenericErrorMessage: 'dice la causa: conflicto (409)',
  // Al entrar, un 401/403 son credenciales que no valen, y el texto dice qué revisar. El resto de
  // fallos del login sí pasan por el molde (`loginFailureText`).
  authLoginErrorMessage: '401/403 al entrar: dice qué revisar',
  demoLoginErrorMessage: '401/403 al entrar: dice qué revisar',
  // Dos altas a la vez se pisan el número: es una carrera, y reintentar sí la resuelve.
  workingTimeSectionNumberConflictMessage: 'carrera de numeración: reintentar sirve',
  // La pantalla de «no hay backend» es la causa misma, no un fallo genérico de una acción.
  'core/availability/backend-unavailable.component.ts': 'es la pantalla de sin conexión',
  // Un aviso de consola para quien desarrolla, no algo que vea un usuario.
  'core/icons/icon-sprite.ts': 'console.warn de desarrollo',
  // El molde mismo, y el almacén de documentos, que sí sabe que reintentar sirve (503).
  'shared/utils/http-failure.util.ts': 'es el molde',
  'features/nomina/recibos/store/recibos.store.ts#503': 'un 503 del almacén sí se reintenta',
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'generated' ? [] : sources(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

const files = sources(APP).map((path) => ({
  rel: relative(APP, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}));

/** Si la posición cae dentro de los argumentos de un `describeFailure(`. */
function insideDescribeFailure(text: string, index: number): boolean {
  const open = text.lastIndexOf('describeFailure(', index);
  if (open < 0) return false;
  let depth = 0;
  for (let i = open + 'describeFailure'.length; i < index; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) return false;
  }
  return true;
}

function genericTextKeys(): string[] {
  const keyRe = /^ {2}([A-Za-z0-9_]+):\s*\n?\s*'((?:[^'\\]|\\.)*)'/gm;
  return files
    .filter((f) => f.rel.endsWith('texts.ts'))
    .flatMap((f) => [...f.text.matchAll(keyRe)])
    .filter((m) => GENERIC.test(m[2]) && !(m[1] in EXCEPTIONS))
    .map((m) => m[1]);
}

describe('ningún error genérico en pantalla', () => {
  it('cada texto genérico se pinta por el molde', () => {
    const offenders: string[] = [];
    for (const key of new Set(genericTextKeys())) {
      for (const f of files.filter((file) => !file.rel.endsWith('texts.ts'))) {
        for (const m of f.text.matchAll(new RegExp(`\\.${key}\\b`, 'g'))) {
          if (!insideDescribeFailure(f.text, m.index ?? 0)) offenders.push(`${f.rel}: ${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ningún literal genérico fuera del molde', () => {
    const offenders: string[] = [];
    for (const f of files.filter((file) => !file.rel.endsWith('texts.ts'))) {
      if (f.rel in EXCEPTIONS) continue;
      for (const m of f.text.matchAll(GENERIC_LITERAL)) {
        const at = (m.index ?? 0) + m[1].length;
        const line = f.text.slice(f.text.lastIndexOf('\n', at) + 1, at);
        if (line.includes('//') || line.trim().startsWith('*')) continue;
        if (!insideDescribeFailure(f.text, at)) offenders.push(`${f.rel}: ${m[2].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nadie escribe «Reintenta» a mano: lo decide el molde', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f.rel in EXCEPTIONS) continue;
      const lines = f.text.split('\n');
      lines.forEach((line, i) => {
        if (!RETRY.test(line) || line.includes('//') || line.trim().startsWith('*')) return;
        // La clave puede ir en la línea de antes, con el texto partido debajo.
        const withKey = `${lines[i - 1] ?? ''}\n${line}`;
        if (Object.keys(EXCEPTIONS).some((key) => withKey.includes(`${key}:`))) return;
        if (
          f.rel === 'features/nomina/recibos/store/recibos.store.ts' &&
          line.includes('en un momento')
        )
          return; // EXCEPTIONS['…#503']
        offenders.push(`${f.rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
