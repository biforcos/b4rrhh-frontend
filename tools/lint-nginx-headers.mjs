// Candado de las cabeceras de seguridad del nginx (b4rrhh/frontend#67).
//
//   npm run lint:nginx
//
// Por que hace falta. En nginx, un `add_header` dentro de un bloque descarta
// TODOS los heredados. El server ponia las tres cabeceras de seguridad una vez
// y las perdian los tres bloques que traen su propio Cache-Control — entre
// ellos `location = /index.html`, que es por donde la SPA sirve TODAS sus rutas
// via try_files. O sea que el documento, el unico sitio donde X-Frame-Options
// significa algo, era precisamente el que no la recibia.
//
// Lo que esto vigila es la regla, no el sintoma: **todo bloque que tenga un
// `add_header` propio tiene que incluir tambien el fichero comun**. Asi el
// proximo Cache-Control que alguien anada no vuelve a tirarlas en silencio, que
// es exactamente lo que paso.
//
// Esto es estatico y no sustituye a la comprobacion de verdad: el `curl -I`
// contra la demo que corre en el reset diario (`deploy/reset-demo.sh`). Este
// candado corre en cada build y coge el bloque olvidado; aquel corre contra un
// servidor y coge lo que el fichero no cuenta. Hacen falta los dos, y por si
// alguien duda: leer el fichero es justo lo que no lo vio.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const CONF = path.join(RAIZ, 'nginx.conf')
const INCLUDE = 'include /etc/nginx/b4rrhh-security-headers.conf;'
const CABECERAS = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']

const conf = readFileSync(CONF, 'utf8').replace(/\r\n/g, '\n')
const lineas = conf.split('\n')

/** Los bloques de primer nivel dentro del `server`, con sus lineas. */
function bloques() {
  const encontrados = []
  let actual = null
  let profundidad = 0

  for (const [indice, linea] of lineas.entries()) {
    const abre = (linea.match(/\{/g) ?? []).length
    const cierra = (linea.match(/\}/g) ?? []).length

    if (profundidad === 1 && abre > 0 && /^\s*location\b/.test(linea)) {
      actual = { titulo: linea.trim(), desde: indice + 1, lineas: [] }
    } else if (actual) {
      actual.lineas.push(linea)
    }

    profundidad += abre - cierra

    if (actual && profundidad <= 1) {
      encontrados.push(actual)
      actual = null
    }
  }
  return encontrados
}

const fallos = []

// 1. El fichero comun se incluye en el server, para los bloques que NO tienen
//    add_header propio (el proxy del designer es uno).
if (!conf.includes(INCLUDE)) {
  fallos.push(`El nginx.conf no incluye "${INCLUDE}" en ninguna parte.`)
}

// 2. Y en cada bloque que tenga add_header propio.
for (const bloque of bloques()) {
  const suyo = bloque.lineas.join('\n')
  if (!/^\s*add_header/m.test(suyo)) continue
  if (suyo.includes(INCLUDE)) continue

  fallos.push(
    `Linea ${bloque.desde}: ${bloque.titulo}\n` +
      `    tiene un add_header propio y NO incluye el fichero comun, asi que\n` +
      `    descarta las tres cabeceras heredadas. Anade:  ${INCLUDE}`,
  )
}

// 3. Y los valores viven en un solo sitio: nadie los repite a mano.
for (const [indice, linea] of lineas.entries()) {
  const cabecera = CABECERAS.find((c) => new RegExp(`^\\s*add_header\\s+${c}\\b`).test(linea))
  if (cabecera) {
    fallos.push(
      `Linea ${indice + 1}: ${cabecera} escrita a mano en el nginx.conf.\n` +
        `    Su valor vive en nginx-security-headers.conf y se incluye; dos sitios\n` +
        `    con el mismo valor divergen el dia que uno cambia.`,
    )
  }
}

if (fallos.length > 0) {
  console.error('lint:nginx: las cabeceras de seguridad no llegan a todas partes\n')
  for (const fallo of fallos) console.error(`  ${fallo}\n`)
  console.error('  Ver b4rrhh/frontend#67.')
  process.exit(1)
}

console.log('lint:nginx: las tres cabeceras llegan a todos los bloques del nginx.conf')
