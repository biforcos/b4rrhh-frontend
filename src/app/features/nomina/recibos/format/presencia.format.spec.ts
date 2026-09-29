import { describe, expect, it } from 'vitest';

import { marcaDePresencia } from './presencia.format';

/**
 * La presencia de un recibo sólo se dice cuando distingue algo (`b4rrhh/frontend#104`).
 *
 * El número de presencia distingue recibos, no describe empleados: sólo se dice cuando otra
 * presencia del mismo empleado tiene recibo del mismo período y tipo —cesado y readmitido en el
 * mismo mes—, y entonces en los dos. Si tiene hermana lo contesta el servidor, no la página: aquí
 * llega ya contestado.
 */
describe('la marca de presencia de un recibo', () => {
  it('presencia 1 sin hermana: nada', () => {
    expect(marcaDePresencia(1, false)).toBeNull();
  });

  it('presencia 1 con hermana del mismo mes: marca', () => {
    expect(marcaDePresencia(1, true)).toBe('1.ª presencia');
  });

  it('presencia 2 con hermana del mismo mes: marca', () => {
    expect(marcaDePresencia(2, true)).toBe('2.ª presencia');
  });

  it('presencia 2 sola: nada, igual que la 1 — la readmisión es un dato de la ficha', () => {
    expect(marcaDePresencia(2, false)).toBeNull();
  });
});
