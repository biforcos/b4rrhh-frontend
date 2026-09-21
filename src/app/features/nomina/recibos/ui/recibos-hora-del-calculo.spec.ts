import { describe, expect, it } from 'vitest';

import { RecibosDetailComponent } from './recibos-detail.component';

/**
 * «Calculada el» pinta el instante en la hora de quien mira (`b4rrhh/frontend#81`).
 *
 * <h3>El fallo que esto habría dicho</h3>
 *
 * Hasta el `b4rrhh/backend#116`, `calculated_at` era una hora de pared sin zona y el servidor la
 * emitía tal cual: `2026-09-20T18:04:37`. `new Date` de un ISO sin zona la lee como **local**,
 * así que en un navegador español salía «18:04» y coincidía con lo que había escrito el loader
 * —que también corre en Madrid—. Coincidía por casualidad.
 *
 * En la demo no coincidía. La CT corre en UTC, así que un recibo **recalculado allí** escribía
 * `16:04` y la pantalla lo pintaba como «16:04»: dos horas antes de la hora real. Y no había
 * ningún test que lo dijera, porque ninguno pintaba una fecha y miraba qué hora salía.
 *
 * <h3>Por qué hace falta fijar la zona</h3>
 *
 * Porque lo que se afirma aquí es **qué lee una persona**, y eso depende del reloj del
 * navegador. Sin fijarla, este test sería verde en este portátil y rojo en un runner en UTC sin
 * que nada hubiera cambiado. La fija `src/testing/zona-horaria.setup.ts`, y se comprobó que
 * gana: con `TZ=UTC` en el entorno, la suite sigue corriendo en `Europe/Madrid`.
 */
describe('la hora del cálculo, como la lee quien mira', () => {
  const componente = Object.create(RecibosDetailComponent.prototype) as RecibosDetailComponent;

  it('pinta un instante en Z en la hora de Madrid', () => {
    // 10:00 UTC del 21 de septiembre son las 12:00 en Madrid: en septiembre hay dos horas.
    expect(componente.calculatedAtLabel('2026-09-21T10:00:00Z')).toBe('21/09/2026 a las 12:00');
  });

  /**
   * El invierno, que es donde una hora fija metida a mano se rompería.
   *
   * <p>En enero Madrid va una hora por delante de UTC y no dos. Si alguien «arreglara» esto
   * sumando dos horas en vez de dejar que la zona haga su trabajo, este caso lo diría.
   */
  it('y respeta el horario de invierno, que no es el mismo desfase', () => {
    expect(componente.calculatedAtLabel('2026-01-15T10:00:00Z')).toBe('15/01/2026 a las 11:00');
  });

  /**
   * Y lo que el servidor emite de verdad, con microsegundos.
   *
   * <p>El valor sale tal cual de la semilla del `b4rrhh/deploy#17`: `Instant` serializado por
   * Jackson con seis decimales. Que el formateador no se atragante con ellos no es evidente
   * hasta que se prueba.
   */
  it('acepta la forma exacta que emite el backend, microsegundos incluidos', () => {
    expect(componente.calculatedAtLabel('2026-09-20T16:04:37.476530Z')).toBe(
      '20/09/2026 a las 18:04',
    );
  });

  /** Lo que no es una fecha se devuelve tal cual, que era el contrato de antes y sigue. */
  it('devuelve tal cual lo que no sabe leer', () => {
    expect(componente.calculatedAtLabel('vete a saber')).toBe('vete a saber');
  });
});
