import { defineConfig } from 'vitest/config';

/**
 * Lo único que este fichero pone es el runner que mide la ventana del límite
 * (`b4rrhh/frontend#80`). Todo lo demás —entorno, `setupFiles`, reporters, qué
 * ficheros entran— lo sigue decidiendo el builder `@angular/build:unit-test`
 * desde `angular.json`, que aplica su propia configuración encima de ésta.
 *
 * Se carga porque `angular.json` declara `"runnerConfig": true`, y **el nombre
 * del fichero no es libre**: el builder busca `vitest-base.config.*` y no
 * `vitest.config.*` (`findVitestBaseConfig`). Con el nombre de siempre no lo
 * lee nadie, y el reporter lo dice en su salida en vez de callarse: un reporter
 * que mide mal en silencio es justo lo que reabrió el issue.
 */
export default defineConfig({
  test: {
    runner: './tools/medir-la-ventana-del-limite.mjs',
  },
});
