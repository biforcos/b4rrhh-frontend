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
// más apretado y su tiempo. Sin ella, una pasada silenciosa se lee igual que un
// reporter que no ha corrido.
//
// ## Las dos ventanas, que es por lo que este issue se reabrió
//
// La primera versión medía `test.diagnostic().duration` y lo comparaba con los
// 5 s del `testTimeout`. **Son dos relojes distintos**, y compararlos era un
// fallo presentado como hecho:
//
//   - `duration` arranca antes de los `beforeEach` y se cierra después de los
//     `afterEach` y las limpiezas. Es el TOTAL del test con sus hooks.
//   - el `testTimeout` envuelve **sólo el fn del test** (`setFn(task,
//     withTimeout(...))`, en `@vitest/runner`). Los hooks llevan su propio
//     reloj, el `hookTimeout`, que por omisión son 10 s.
//
// Se vio en la pasada de los ocho timeouts del `frontend#57`: **once** tests por
// encima de 5 s en la lista y sólo ocho caídos, con el más lento de todos
// —8,2 s— pasando. Su tiempo estaba casi todo fuera del cuerpo.
//
// Así que se miden las dos y **el umbral se aplica al cuerpo**, que es la
// ventana que puede fallar. El total va al lado porque también dice algo: un
// cuerpo corto con un total largo señala el montaje, y ése es otro arreglo.
//
// El cuerpo lo mide `tools/medir-la-ventana-del-limite.mjs`, un runner que
// envuelve el fn en el mismo sitio en el que lo envuelve el límite, y lo deja en
// `test.meta().cuerpoMs`. Si esa medida no llega, este reporter **lo dice y no
// mide**: volver al `duration` en silencio sería repetir el error que este
// comentario explica.
//
// ## Y el límite tampoco es uno solo
//
// Salió midiendo esto: con la suite bajo carga hubo **diez** cuerpos por encima
// de 5 s y sólo **nueve** caídas. El que sobraba —`employee-cost-center`, 10,7 s
// de cuerpo— declara su propio `timeout` de 15 s en el `it`, con su medida al
// lado. No estaba a punto de caerse: le sobraban cuatro segundos.
//
// O sea, el mismo error de comparar contra un número que no es el que aplica,
// una capa más abajo. Por eso el límite de cada test se lee de
// `test.options.timeout`, que es el que Vitest le puso, y los 5.000 ms sólo se
// usan cuando el test no declara ninguno. El umbral es el 60 % **de su** límite,
// y la lista se ordena por lo que de verdad importa: qué fracción de su propio
// margen ha gastado cada uno.

import path from 'node:path'

// El `testTimeout` de Vitest cuando el test no declara el suyo: son 5000 ms y
// no están configurados en ninguna parte de este repositorio, es el valor por
// omisión. Un test puede pedir otro —`it('...', fn, 15000)`— y entonces manda
// el suyo, que se lee de `test.options.timeout`.
const LIMITE_POR_OMISION_MS = 5000

// La fracción del límite a partir de la cual un test se nombra. El 60 % no es
// redondo por casualidad: por debajo, el ruido normal de una máquina cargada
// llenaría la lista de tests que no tienen ningún problema; por encima, el aviso
// llegaría cuando ya casi no queda margen que avisar.
const FRACCION_AVISO = 0.6

const SALTO = '\n'

export default class ReportarTestsLentos {
  onTestRunEnd(modulos) {
    const medidos = []
    let sinMedirElCuerpo = 0

    for (const modulo of modulos) {
      for (const test of modulo.children.allTests()) {
        const total = test.diagnostic()?.duration
        if (typeof total !== 'number') {
          continue
        }
        const cuerpo = test.meta()?.cuerpoMs
        if (typeof cuerpo !== 'number') {
          sinMedirElCuerpo += 1
          continue
        }
        const limite = test.options.timeout ?? LIMITE_POR_OMISION_MS
        medidos.push({
          cuerpo,
          total,
          limite,
          gastado: cuerpo / limite,
          fichero: path.relative(process.cwd(), test.module.moduleId).split(path.sep).join('/'),
          nombre: test.fullName,
        })
      }
    }

    // Ni un cuerpo medido: o no hubo tests, o el runner no está puesto. Lo
    // segundo se avisa, porque un reporter callado se lee igual que uno que ha
    // mirado y no ha encontrado nada.
    if (medidos.length === 0) {
      if (sinMedirElCuerpo > 0) {
        this.#escribir([
          '',
          ` Margen: no se ha podido medir ninguno de los ${sinMedirElCuerpo} tests. Falta el`,
          ' runner que mide la ventana del límite: comprueba "runnerConfig": true en',
          ' angular.json y vitest-base.config.ts (b4rrhh/frontend#80).',
          '',
        ])
      }
      return
    }

    medidos.sort((a, b) => b.gastado - a.gastado)
    const lentos = medidos.filter((t) => t.gastado > FRACCION_AVISO)

    const aviso =
      sinMedirElCuerpo > 0
        ? [
            ` Y ${sinMedirElCuerpo} tests sin medir: no traen el tiempo del cuerpo y están`,
            ' fuera de esta cuenta.',
          ]
        : []

    if (lentos.length === 0) {
      const [apretado] = medidos
      this.#escribir([
        '',
        ` Margen: el cuerpo más apretado son ${segundos(apretado.cuerpo)} de su límite de` +
          ` ${segundos(apretado.limite)}`,
        ` (${segundos(apretado.total)} con sus hooks) — ${apretado.nombre}`,
        ...aviso,
        '',
      ])
      return
    }

    const cuantos =
      lentos.length === 1
        ? '1 test pasa del 60 % de su límite'
        : `${lentos.length} tests pasan del 60 % de su límite`

    const lineas = [
      '',
      ` ${cuantos}, medido sobre el CUERPO del test.`,
      ' No es un fallo: es el margen que queda antes de que la suite empiece a',
      ' fallar al azar cuando la máquina vaya cargada (b4rrhh/frontend#80).',
      '',
      ' El «cuerpo» es lo único que el testTimeout cuenta. El «total» añade los',
      ' hooks —beforeEach, afterEach—, que llevan su propio reloj de 10 s: por eso',
      ' un total alto no tumba nada y un cuerpo alto sí. Y el «límite» es el de',
      ' cada test, que casi siempre son los 5 s por omisión pero no siempre.',
      '',
      '   cuerpo  límite   total',
    ]

    for (const { cuerpo, limite, total, fichero, nombre } of lentos) {
      const marca = cuerpo >= limite ? '  <- pasa de su límite' : ''
      lineas.push(
        `   ${segundos(cuerpo).padStart(6)}  ${segundos(limite).padStart(6)}` +
          `  ${segundos(total).padStart(6)}  ${fichero}${marca}`,
      )
      lineas.push(`                            ${nombre}`)
    }

    this.#escribir([...lineas, ...aviso, ''])
  }

  #escribir(lineas) {
    process.stdout.write(lineas.join(SALTO) + SALTO)
  }
}

function segundos(ms) {
  return `${(ms / 1000).toFixed(1)} s`
}
