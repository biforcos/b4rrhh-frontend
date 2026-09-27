import { describe, expect, it } from 'vitest';

import {
  isRunFinished,
  isRunQueued,
  runDurationMs,
  runHasRetro,
  runProcessedUnits,
  runProgressPercent,
  runRetroProcessedUnits,
  runTotalWorkUnits,
  unitsWithoutPayslip,
} from './calculation-run.model';
import type { CalculationRun } from './calculation-run.model';

const base: CalculationRun = {
  runId: 1,
  status: 'COMPLETED',
  ruleSystemCode: 'ESP',
  payrollPeriodCode: '202604',
  payrollTypeCode: 'NORMAL',
  calculationEngineCode: 'GRAPH',
  calculationEngineVersion: '1.0',
  totalCandidates: 0,
  totalEligible: 0,
  totalClaimed: 0,
  totalSkippedNotEligible: 0,
  totalSkippedAlreadyClaimed: 0,
  totalSkippedMissingInput: 0,
  totalCalculated: 0,
  totalNotValid: 0,
  totalErrors: 0,
  retroLimitPeriodCode: null,
  retroFloorPeriodCode: null,
  totalRetroUnits: 0,
  totalRetroRecalculated: 0,
  totalRetroNotRecalculated: 0,
  requestedAt: '2026-04-29T08:00:00',
  startedAt: null,
  finishedAt: null,
};

describe('isRunFinished', () => {
  it('returns true for COMPLETED', () =>
    expect(isRunFinished({ ...base, status: 'COMPLETED' })).toBe(true));
  it('returns true for COMPLETED_WITH_ERRORS', () =>
    expect(isRunFinished({ ...base, status: 'COMPLETED_WITH_ERRORS' })).toBe(true));
  it('returns true for FAILED', () =>
    expect(isRunFinished({ ...base, status: 'FAILED' })).toBe(true));
  it('returns false for RUNNING', () =>
    expect(isRunFinished({ ...base, status: 'RUNNING' })).toBe(false));
  it('returns false for REQUESTED', () =>
    expect(isRunFinished({ ...base, status: 'REQUESTED' })).toBe(false));
});

describe('isRunQueued', () => {
  it('REQUESTED es esperar turno, no arrancar', () =>
    expect(isRunQueued({ ...base, status: 'REQUESTED' })).toBe(true));
  it('RUNNING ya no espera a nadie', () =>
    expect(isRunQueued({ ...base, status: 'RUNNING' })).toBe(false));
  it('una terminada no esta en cola', () =>
    expect(isRunQueued({ ...base, status: 'COMPLETED' })).toBe(false));
});

describe('runProcessedUnits y runProgressPercent', () => {
  // La corrida 4 de la prueba del backend#75, a mitad: 879 candidatas, 165 saltadas por tener ya
  // recibo de la corrida que murio, 11 calculadas.
  const midway = {
    ...base,
    status: 'RUNNING' as const,
    totalCandidates: 879,
    totalEligible: 12,
    totalCalculated: 11,
    totalSkippedNotEligible: 165,
  };

  it('cuenta todo lo resuelto, calculado o no', () => expect(runProcessedUnits(midway)).toBe(176));

  it('el avance se mide sobre las candidatas, que son las que no se mueven', () => {
    // Sobre totalEligible saldria 11/12, o sea 92% con el trabajo casi sin empezar. Y sin retro,
    // candidatas ES el trabajo de la corrida.
    expect(runProgressPercent(midway)).toBe(20);
  });

  it('en cola no hay porcentaje: todavia no se sabe cuantas unidades son', () =>
    expect(runProgressPercent({ ...base, status: 'REQUESTED' })).toBeNull());

  it('una fallida que no llego a seleccionar nada tampoco tiene porcentaje', () =>
    // Es la que rechaza la cola llena (LAUNCH_REJECTED) o la que murio encolada: cero candidatas,
    // asi que la pantalla no puede contar «resolvio 0 de 0».
    expect(runProgressPercent({ ...base, status: 'FAILED' })).toBeNull());

  it('una corrida terminada esta al cien', () => {
    // La corrida 4 al acabar: 714 calculadas + 165 saltadas = 879 candidatas.
    const finished = {
      ...base,
      status: 'COMPLETED' as const,
      totalCandidates: 879,
      totalCalculated: 714,
      totalSkippedNotEligible: 165,
    };

    expect(runProcessedUnits(finished)).toBe(879);
    expect(runProgressPercent(finished)).toBe(100);
  });

  it('una fallida a medias no llega al cien, y eso es lo que hay que ver', () => {
    // La corrida 3: matada a los 165 recibos de 879 candidatas.
    const failed = {
      ...base,
      status: 'FAILED' as const,
      totalCandidates: 879,
      totalCalculated: 165,
    };

    expect(runProgressPercent(failed)).toBe(19);
    // Y sus unidades sin recibo son cero, que es justo por lo que la pantalla no puede leer el
    // final de una ejecucion fallida con ese contador (frontend#62).
    expect(unitsWithoutPayslip(failed)).toBe(0);
  });
});

/**
 * La terna de la retro (`b4rrhh/frontend#85`, contrato del `b4rrhh/backend#132`).
 *
 * Es **aparte** de los nueve contadores del recibo: una unidad de retro no acaba en ninguno de esos
 * cajones porque no escribe recibo, escribe calculo vigente. Lo que se suma es el trabajo de la
 * corrida, y eso se suma en un solo sitio.
 */
describe('el trabajo de la corrida cuenta empleado x mes', () => {
  // Un lanzamiento con suelo para todos desde enero: 873 recibos y ocho meses cerrados por
  // empleado. Los 6.984 son los que cuestan el tiempo.
  const conSuelo = {
    ...base,
    status: 'RUNNING' as const,
    retroLimitPeriodCode: '202509',
    retroFloorPeriodCode: '202601',
    totalCandidates: 873,
    totalCalculated: 400,
    totalRetroUnits: 6984,
    totalRetroRecalculated: 3200,
    totalRetroNotRecalculated: 0,
  };

  it('suma los dos universos, y solo aqui', () => {
    expect(runTotalWorkUnits(conSuelo)).toBe(7857);
    // Los nueve del recibo no se enteran de la retro: su particion sigue siendo la suya.
    expect(runProcessedUnits(conSuelo)).toBe(400);
  });

  it('la retro tiene su propia particion', () => {
    expect(runRetroProcessedUnits(conSuelo)).toBe(3200);
    expect(runRetroProcessedUnits({ ...conSuelo, totalRetroNotRecalculated: 12 })).toBe(3212);
  });

  it('el avance cuenta los dos, que es lo que hace que la barra se mueva', () => {
    // Sobre los recibos solos serian 400/873; con los dos universos, 3.600 de 7.857.
    expect(runProgressPercent(conSuelo)).toBe(46);
  });

  /**
   * Y una corrida **sin** retro no cambia de cuenta. Es el caso normal, y si el denominador se
   * hubiera movido para ella, las nueve corridas de cada resiembra habrian empezado a mentir.
   */
  it('sin retro el avance es el de siempre', () => {
    const sinRetro = { ...conSuelo, totalRetroUnits: 0, totalRetroRecalculated: 0 };

    expect(runHasRetro(sinRetro)).toBe(false);
    expect(runTotalWorkUnits(sinRetro)).toBe(873);
    expect(runProgressPercent(sinRetro)).toBe(46);
  });

  it('un mes que no se pudo recalcular no es un error, pero cuenta como resuelto', () => {
    const conFallo = {
      ...conSuelo,
      totalRetroRecalculated: 6900,
      totalRetroNotRecalculated: 84,
      totalCalculated: 873,
    };

    // 873 + 6.984 = 7.857 de 7.857: la corrida acabo, con 84 meses sin recalcular y contados.
    expect(runProgressPercent(conFallo)).toBe(100);
    expect(conFallo.totalRetroRecalculated + conFallo.totalRetroNotRecalculated).toBe(
      conFallo.totalRetroUnits,
    );
  });
});

describe('unitsWithoutPayslip', () => {
  it('cuenta las cinco clases de unidad que no acaba en recibo', () =>
    expect(
      unitsWithoutPayslip({
        ...base,
        totalSkippedNotEligible: 2,
        totalSkippedAlreadyClaimed: 1,
        totalSkippedMissingInput: 5,
        totalNotValid: 3,
        totalErrors: 4,
      }),
    ).toBe(15));

  // La clase nueva tiene que estar dentro de la suma. Si se queda fuera, la barra no llega al
  // final y el recuento de las que no cobraron miente por debajo (b4rrhh/backend#85).
  it('cuenta las que se quedaron sin calcular por falta de datos', () =>
    expect(unitsWithoutPayslip({ ...base, totalSkippedMissingInput: 2 })).toBe(2));

  it('no mira el estado: COMPLETED con unidades saltadas no es cero', () => {
    // La corrida del deploy#3, como queda tras repartir los contadores del
    // b4rrhh/backend#85: status COMPLETED, 873 candidatas, 871 calculadas, y las 2 saltadas son
    // «faltaban datos», no «ya tenian recibo». Comprobado en la base.
    const run = {
      ...base,
      status: 'COMPLETED' as const,
      totalCandidates: 873,
      totalCalculated: 871,
      totalSkippedMissingInput: 2,
    };

    expect(isRunFinished(run)).toBe(true);
    expect(unitsWithoutPayslip(run)).toBe(2);
  });

  it('es cero cuando todas acabaron en recibo', () =>
    expect(unitsWithoutPayslip({ ...base, totalCandidates: 5, totalCalculated: 5 })).toBe(0));
});

describe('runDurationMs', () => {
  it('mide entre el arranque y el cierre', () =>
    expect(
      runDurationMs({
        ...base,
        startedAt: '2026-04-29T08:00:00',
        finishedAt: '2026-04-29T08:05:30',
      }),
    ).toBe(330_000));

  it('sin cierre no hay duracion', () =>
    expect(
      runDurationMs({ ...base, startedAt: '2026-04-29T08:00:00', finishedAt: null }),
    ).toBeNull());

  it('sin arranque tampoco', () =>
    expect(
      runDurationMs({ ...base, startedAt: null, finishedAt: '2026-04-29T08:05:30' }),
    ).toBeNull());
});
