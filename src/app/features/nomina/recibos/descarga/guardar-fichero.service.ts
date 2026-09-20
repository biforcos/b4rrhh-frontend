import { Injectable } from '@angular/core';

/**
 * Entregarle al navegador un fichero que ya existe (`b4rrhh/frontend#78`).
 *
 * <b>No genera nada.</b> Recibe los bytes que el backend ha servido y el nombre que el backend ha
 * dicho, y los pone donde el navegador los guarda. Ésa es toda la diferencia entre esto y la
 * ficha de empleado, que sí compone su HTML en el cliente y lo manda a imprimir: el recibo es un
 * documento que sale del sistema, y un fichero que depende del navegador de quien lo pide no se
 * puede archivar ni servir dos veces igual.
 *
 * Existe como servicio y no como cuatro líneas dentro del store por una razón concreta: es lo
 * único del camino que toca el DOM. Aparte, el store se puede probar entero sin que un test
 * intente descargarse nada.
 */
@Injectable({ providedIn: 'root' })
export class GuardarFicheroService {
  guardar(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = fileName;
    enlace.rel = 'noopener';
    try {
      // El enlace no llega a estar en el documento: no hay nada que mirar ni que se mueva de
      // sitio en la pantalla. Descargar es leer, y no cambia lo que hay delante.
      enlace.click();
    } finally {
      // En el turno siguiente y no en éste. Revocar el URL en el mismo tick del clic deja
      // descargas a medias en algunos navegadores, porque cuando `click()` vuelve la descarga
      // todavía no ha empezado a leer el blob. Y se suelta siempre, también si el clic revienta:
      // un object URL vivo se lleva el blob con él.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}
