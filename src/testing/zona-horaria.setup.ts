/**
 * La suite corre en `Europe/Madrid`, escrito y no heredado (`b4rrhh/frontend#81`).
 *
 * El backend emite `calculatedAt` como instante con `Z` desde el `b4rrhh/backend#116`, y el
 * folio lo pinta con la zona del navegador. Un test que compruebe *qué hora sale* sólo
 * significa algo si la zona del proceso está fijada: en el portátil daría 12:00 y en un runner
 * en UTC daría 10:00, y el mismo test sería verde aquí y rojo allí sin que nada haya cambiado.
 *
 * Es la misma decisión que el pipeline del backend ya tenía tomada —`TZ=Europe/Madrid` en el
 * contenedor de Maven, «con nómina de por medio, una hora de diferencia entre tu máquina y el
 * pipeline es un fallo que no se reproduce»— aplicada aquí, donde faltaba.
 *
 * Se elige Madrid y no UTC porque es la zona de quien mira la demo: lo que se está afirmando es
 * lo que lee una persona, no lo que guarda el servidor.
 */
process.env['TZ'] = 'Europe/Madrid';
