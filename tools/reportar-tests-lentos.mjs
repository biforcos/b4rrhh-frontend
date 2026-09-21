// Reporter de Vitest que nombra los tests que se acercan al límite de tiempo
// (b4rrhh/frontend#80).
//
// Se engancha desde `angular.json`, junto al reporter por defecto y al de tests
// saltados. No corre solo: corre en cada `ng test`.
//
// Por que hace falta. El `b4rrhh/frontend#57` se cerró sin reproducir el fallo
// —dieciocho pasadas verdes con la máquina machacada— y lo único que dejó fue
// una medida hecha a mano una vez: el test más lento usaba 1,9 s de los 5 s que
// tiene. Un margen de 2,6x.
//
// Esa medida envejece sola. El día que el margen se coma, la suite sale verde
// hasta que sale roja, y el rojo es un «Test timed out in 5000ms» sin nada más
// dentro — que es exactamente lo que el #57 no pudo usar para diagnosticar.
// Esto convierte una medición puntual en una que se hace en cada pasada.
//
// Lo que NO hace es tumbar la suite. Un test lento no está roto, y fallar por
// lento entrenaría a subir el umbral hasta que saliera verde, que es el reflejo
// que el #57 describe para el `testTimeout`. Nombra; decidir es de quien lee.
//
// Y dice algo SIEMPRE, incluso cuando no hay nada que decir: una línea con el
// más lento y su tiempo. Sin ella, una pasada silenciosa se lee igual que un
// reporter que no ha corrido.

import path from 'node:path'

// El 60 % del `testTimeout` de Vitest, que son 5000 ms y no están configurados
// en ninguna parte de este repositorio: es el valor por omisión.
//
// El umbral va aquí y en un solo sitio. Y el 60 % no es redondo por casualidad:
// por debajo, el ruido normal de una máquina cargada llenaría la lista de tests
// que no tienen ningún problema; por encima, el aviso llegaría cuando ya casi
// no queda margen que avisar.
const LIMITE_MS = 5000
const UMBRAL_MS = LIMITE_MS * 0.6

export default class ReportarTestsLentos {
  onTestRunEnd(modulos) {
    const medidos = []

    for (const modulo of modulos) {
      for (const test of modulo.children.allTests()) {
        const duracion = test.diagnostic()?.duration
        if (typeof duracion === 'number') {
          medidos.push({
            ms: duracion,
            fichero: path.relative(process.cwd(), test.module.moduleId).split(path.sep).join('/'),
            nombre: test.fullName,
          })
        }
      }
    }

    if (medidos.length === 0) {
      return
    }

    medidos.sort((a, b) => b.ms - a.ms)
    const lentos = medidos.filter((t) => t.ms > UMBRAL_MS)
    const segundos = (ms) => `${(ms / 1000).toFixed(1)} s`

    if (lentos.length === 0) {
      const [masLento] = medidos
      process.stdout.write(
        `\n Margen: el test más lento son ${segundos(masLento.ms)} de ${segundos(LIMITE_MS)}` +
          ` — ${masLento.nombre}\n\n`,
      )
      return
    }

    const cuantos =
      lentos.length === 1
        ? `1 test pasa de ${segundos(UMBRAL_MS)}`
        : `${lentos.length} tests pasan de ${segundos(UMBRAL_MS)}`

    const lineas = [
      '',
      ` ${cuantos}, que es el 60 % del límite de ${segundos(LIMITE_MS)}.`,
      ' No es un fallo: es el margen que queda antes de que la suite empiece a',
      ' fallar al azar cuando la máquina vaya cargada (b4rrhh/frontend#80).',
      '',
    ]

    for (const { ms, fichero, nombre } of lentos) {
      lineas.push(`   ${segundos(ms).padStart(6)}  ${fichero}`)
      lineas.push(`           ${nombre}`)
    }

    lineas.push('')
    process.stdout.write(`${lineas.join('\n')}\n`)
  }
}
