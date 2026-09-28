import { HttpErrorResponse } from '@angular/common/http';

/**
 * Lo que se sabe de una petición que falló: el estado HTTP y lo que dijo el servidor, si dijo algo
 * (`b4rrhh/frontend#92`).
 *
 * Los stores ya reducen un fallo a un código (`'request-failed'`, `'CONTRACT_OVERLAP'`…) para
 * decidir qué hacer; esto es lo que se guarda **además**, para poder contarlo. Antes se tiraba, y
 * la pantalla decía «No se pudo procesar la operación. Reintenta.» cuando el servidor había dicho
 * exactamente qué faltaba.
 */
export interface HttpFailure {
  /** 0 cuando no hubo respuesta: sin conexión, o el servidor no contestó. */
  readonly status: number;
  /** El `message` del cuerpo del error, si lo trae y no está vacío. */
  readonly serverMessage: string | null;
}

export function toHttpFailure(err: unknown): HttpFailure {
  if (err instanceof HttpErrorResponse) {
    return { status: err.status, serverMessage: serverMessageOf(err.error) };
  }
  return { status: 0, serverMessage: null };
}

/** El `message` de un cuerpo de error del backend: las dos formas lo llevan (`{message}` y `{code,message,details}`). */
function serverMessageOf(body: unknown): string | null {
  // Un cuerpo de texto plano también es lo que dijo el servidor; una página HTML de error, no.
  if (typeof body === 'string') {
    const text = body.trim();
    return text.length > 0 && !text.startsWith('<') ? text : null;
  }
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message.trim();
  }
  return null;
}

/**
 * El único sitio donde se redacta un fallo para enseñarlo (`b4rrhh/frontend#92`).
 *
 * <p>Dice **qué se intentaba** y **por qué no salió**. El porqué es lo que dijo el servidor cuando
 * lo dijo; si no, lo que se puede deducir del estado —no hubo conexión, no hay permiso, no existe—,
 * y si ni eso, el estado tal cual, que al menos es algo que se puede buscar. Y sólo propone
 * reintentar cuando reintentar puede servir: sin conexión o con el servidor caído, no con un
 * rechazo, que reintentado se rechaza igual.
 *
 * @param action lo que se intentaba, sin punto final: «No se pudo guardar el contrato».
 * @param failure el fallo, o `null` si no se sabe nada más de él.
 */
export function describeFailure(action: string, failure: HttpFailure | null): string {
  const what = action.trim().replace(/[.:]$/, '');
  if (failure === null) return `${what}.`;
  if (failure.serverMessage !== null) return `${what}: ${withPeriod(failure.serverMessage)}`;
  const { status } = failure;
  if (status === 0) return `${what}: no hay conexión con el servidor. Reintenta cuando vuelva.`;
  if (status === 401) return `${what}: la sesión ha caducado. Vuelve a entrar.`;
  if (status === 403) return `${what}: no tienes permiso para esto.`;
  if (status === 404) return `${what}: el servidor no lo encuentra.`;
  if (status >= 500) return `${what}: el servidor falló (${status}) sin decir por qué. Reintenta.`;
  return `${what}: el servidor respondió ${status} sin decir por qué.`;
}

function withPeriod(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}
