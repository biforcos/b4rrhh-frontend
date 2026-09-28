import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { describeFailure, toHttpFailure } from './http-failure.util';

const http = (status: number, error: unknown = null) =>
  toHttpFailure(new HttpErrorResponse({ status, error }));

/**
 * El molde de un error en pantalla (`b4rrhh/frontend#92`): lo que se intentaba y por qué no salió.
 * Lo que este spec sujeta es que **el mensaje del servidor llega a la pantalla**, y que cuando el
 * servidor no dice nada la frase dice al menos lo que se sabe, nunca sólo «No se pudo».
 */
describe('describeFailure', () => {
  const action = 'No se pudo guardar el contrato';

  it('el mensaje del servidor llega tal cual, detrás de lo que se intentaba', () => {
    expect(
      describeFailure(action, http(400, { message: 'El tipo de contrato XYZ no existe en ESP' })),
    ).toBe('No se pudo guardar el contrato: El tipo de contrato XYZ no existe en ESP.');
  });

  it('también con la forma {code, message, details}', () => {
    expect(
      describeFailure(
        action,
        http(409, { code: 'CONTRACT_OVERLAP', message: 'Solapa con el contrato 2.', details: {} }),
      ),
    ).toBe('No se pudo guardar el contrato: Solapa con el contrato 2.');
  });

  it('sin mensaje, lo que se deduce del estado', () => {
    expect(describeFailure(action, http(0))).toBe(
      'No se pudo guardar el contrato: no hay conexión con el servidor. Reintenta cuando vuelva.',
    );
    expect(describeFailure(action, http(403))).toBe(
      'No se pudo guardar el contrato: no tienes permiso para esto.',
    );
    expect(describeFailure(action, http(404))).toBe(
      'No se pudo guardar el contrato: el servidor no lo encuentra.',
    );
    expect(describeFailure(action, http(500, { error: 'Internal Server Error' }))).toBe(
      'No se pudo guardar el contrato: el servidor falló (500) sin decir por qué. Reintenta.',
    );
    expect(describeFailure(action, http(422))).toBe(
      'No se pudo guardar el contrato: el servidor respondió 422 sin decir por qué.',
    );
  });

  it('reintentar sólo se propone cuando puede servir', () => {
    expect(describeFailure(action, http(409, { message: 'Ya existe.' }))).not.toContain(
      'Reintenta',
    );
    expect(describeFailure(action, http(403))).not.toContain('Reintenta');
  });

  it('un mensaje vacío del servidor no cuenta como mensaje', () => {
    expect(describeFailure(action, http(404, { message: '  ' }))).toBe(
      'No se pudo guardar el contrato: el servidor no lo encuentra.',
    );
  });

  it('sin fallo, sólo la acción; y un error que no es HTTP es falta de conexión', () => {
    expect(describeFailure('No se pudo guardar.', null)).toBe('No se pudo guardar.');
    expect(toHttpFailure(new Error('boom'))).toEqual({ status: 0, serverMessage: null });
  });
});
