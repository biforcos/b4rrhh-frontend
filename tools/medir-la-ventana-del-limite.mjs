// Runner de Vitest que mide el CUERPO del test, que es lo único que el
// `testTimeout` cuenta (b4rrhh/frontend#80).
//
// ## Por qué hace falta un runner y no basta el reporter
//
// El reporter sólo puede leer `test.diagnostic().duration`, y esa duración
// **no es la ventana del límite**. En `@vitest/runner` la cuenta arranca antes
// de los `beforeEach` y se cierra después de los `afterEach` y las limpiezas:
//
//     const start = now()
//     ...
//     await callSuiteHook(suite, test, 'beforeEach', ...)   // hookTimeout
//     await runner.runTask(test) ?? fn()                    // testTimeout  <-- el limite
//     await callSuiteHook(suite, test, 'afterEach', ...)    // hookTimeout
//     ...
//     test.result.duration = now() - start
//
// mientras que el `testTimeout` se aplica **al fn del test y a nada más**, en
// la creación de la tarea:
//
//     setFn(task, withTimeout(withCancel(withAwaitAsyncAssertions(
//         withFixtures(handler, { context }), task), ...), timeout, false, ...))
//
// y los hooks llevan su propio reloj, el `hookTimeout`, que por omisión son
// 10 s y no 5.
//
// Eso explica lo que destapó el `frontend#57` y por lo que este issue se
// reabrió: en la pasada de los ocho timeouts había **once** tests por encima de
// 5 s en la lista del reporter y sólo ocho fallaron, y el más lento de todos
// —8,2 s— pasó. No era azar: su tiempo estaba casi todo en el `beforeEach`, que
// tenía 10 s de presupuesto, y su cuerpo nunca llegó a los 5.
//
// ## Cómo se mide
//
// El bucle del runner llama a `runner.runTask(test)` **en lugar de** `fn()`
// cuando el runner lo define, dentro del mismo `limitMaxConcurrency` y en el
// mismo sitio. Así que envolver ahí mide exactamente lo que el límite mide: ni
// un hook de más, ni una limpieza.
//
// `getTestFn` devuelve el fn **ya envuelto en su `withTimeout`**, que es la
// pieza que hace esto exacto en vez de aproximado: cuando el cuerpo se pasa del
// límite, el `finally` anota los ~5.000 ms con los que Vitest lo abortó.
//
// Lo que se anota va en `test.meta`, que el reporter lee con `test.meta()`.
// No se toca ningún resultado ni ningún tiempo: sólo se observa.
//
// El nombre del que se hereda es `TestRunner` y no `VitestTestRunner`: el
// segundo sólo lo exporta `vitest/runners`, que desde Vitest 4.1 avisa de que
// está obsoleto **en cada pasada**. Son la misma clase; se coge la que no
// ensucia la salida, que es de lo que va este reporter.
import { TestRunner } from 'vitest';

export default class MedirLaVentanaDelLimite extends TestRunner {
  async runTask(test) {
    const desde = performance.now();
    try {
      return await TestRunner.getTestFn(test)();
    } finally {
      test.meta.cuerpoMs = performance.now() - desde;
    }
  }
}
