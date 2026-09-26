import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

/**
 * Este fichero pone dos cosas y nada más: el runner que mide la ventana del
 * límite (`b4rrhh/frontend#80`) y el techo de trabajadores de abajo
 * (`b4rrhh/frontend#57`). Todo lo demás —entorno, `setupFiles`, reporters, qué
 * ficheros entran— lo sigue decidiendo el builder `@angular/build:unit-test`
 * desde `angular.json`, que aplica su propia configuración encima de ésta. El
 * `testTimeout` sigue sin tocarse: son los 5000 ms por omisión de Vitest.
 *
 * Se carga porque `angular.json` declara `"runnerConfig": true`, y **el nombre
 * del fichero no es libre**: el builder busca `vitest-base.config.*` y no
 * `vitest.config.*` (`findVitestBaseConfig`). Con el nombre de siempre no lo
 * lee nadie, y el reporter lo dice en su salida en vez de callarse: un reporter
 * que mide mal en silencio es justo lo que reabrió el issue.
 */

/**
 * TECHO de trabajadores, no una fracción de la máquina.
 *
 * La suite monta 131 entornos de jsdom pase lo que pase; lo que cambia es
 * **cuántos monta a la vez**, y montar veinte a la vez hace que cada uno cueste
 * el doble. Medido el 26/09 en la máquina del worker (20 hilos) con 14 procesos
 * quemando sha256 al lado —15,2 de los 20 hilos ocupados, contados por segundos
 * de CPU consumidos y no por el porcentaje de carga, que promedia— y el cuerpo
 * más apretado medido en la ventana que de verdad cuenta el límite (la del
 * `#80`). Cada celda son las pasadas que se hicieron de ese brazo:
 *
 * | trabajadores | reloj de la suite | `environment` | cuerpo más apretado |
 * |---|---|---|---|
 * | 3            | 17,1 / 16,9 s          | 175-181 s | 0,6-0,7 s |
 * | 4            | 15,3 / 14,8 s          | 180-187 s | 0,7 s |
 * | **6**        | **14,9 / 14,3 / 14,3 s** | 195-220 s | **0,8-0,9 s** |
 * | 8            | 14,5 / 14,5 s          | 228-239 s | 0,9-1,2 s |
 * | 10           | 15,4 / 15,7 / 15,7 s   | 269-275 s | 1,1-1,3 s |
 * | libre (20)   | 18,6 / 19,0 / 20,0 s   | 433-442 s | 1,4-1,8 s |
 *
 * El reloj tiene un fondo plano de 4 a 8 y sube a los dos lados; el coste del
 * cuerpo —que es lo que cruza el límite y hace fallar la suite— baja sin
 * excepción a medida que bajan los trabajadores. **6 es el medio de ese fondo
 * plano**: ni uno menos ni uno más cambia el reloj, y deja el cuerpo en 0,8 s
 * de los 5,0 s del límite en vez de en 1,8 s.
 *
 * Y el motivo dice la verdad: **acota un estado que no sabemos provocar.** Los
 * ocho timeouts del `#57` salieron en una pasada en la que todo costaba tres
 * veces más, y ese estado no se ha conseguido reproducir: ni machacando la CPU
 * (nueve pasadas, nueve verdes), ni con la caché de Angular en frío, ni con la
 * máquina paginando de verdad (5 MB libres y 7.706 páginas/s de entrada: 131
 * ficheros y 931 tests en verde igual). Así que esto no arregla una causa
 * demostrada: quita el margen de más que la suite se estaba gastando, que es lo
 * único que se puede hacer con lo medido y no cuesta nada.
 *
 * Es un `Math.min` y no una división a propósito. El pipeline corre la suite en
 * un contenedor con `--cpus 5` y 4 GB (`.gitea/workflows/deploy.yml`), y ahí el
 * techo no llega a morder: se queda en los 5 de hoy. Una fracción de los hilos
 * le bajaría los trabajadores a una máquina donde el problema no se ha visto
 * nunca y donde nadie ha medido qué pasa.
 *
 * Si vuelve a fallar acotado, se reabre el `#57`: el reporter del `#80` ya mide
 * la ventana que puede fallar y nombrará quién cruzó.
 */
const TECHO_DE_TRABAJADORES = Math.min(6, availableParallelism());

export default defineConfig({
  test: {
    runner: './tools/medir-la-ventana-del-limite.mjs',
    maxWorkers: TECHO_DE_TRABAJADORES,
  },
});
