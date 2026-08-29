import { DOCUMENT } from '@angular/common';
import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';

/** Ruta del sprite, relativa al `<base href>`. Lo genera `tools/identidad/build_all.py`. */
export const ICON_SPRITE_URL = 'icons/b4-icons.svg';

/** Id del nodo inyectado, para no cargarlo dos veces y para poder localizarlo en tests. */
export const ICON_SPRITE_ELEMENT_ID = 'b4-icon-sprite';

/**
 * Inyecta el sprite de iconos al principio del `<body>` antes de arrancar la aplicación.
 *
 * Se inyecta en el documento, en vez de referenciarlo como fichero externo
 * (`<use href="/icons/b4-icons.svg#b4-x">`), porque el `<use>` externo no hereda
 * `currentColor` en varios navegadores, y heredar el color del contexto (`:hover`,
 * `.active`) es justo lo que hace útil al set (frontend#9).
 *
 * Si la carga falla, la aplicación arranca igual: los iconos quedan en blanco, que es
 * un fallo visible y no bloqueante.
 */
export function provideIconSprite(): EnvironmentProviders {
  return provideAppInitializer(() => loadIconSprite(inject(DOCUMENT)));
}

export async function loadIconSprite(document: Document): Promise<void> {
  if (document.getElementById(ICON_SPRITE_ELEMENT_ID)) {
    return;
  }
  try {
    const response = await fetch(ICON_SPRITE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const markup = await response.text();
    const container = document.createElement('div');
    container.id = ICON_SPRITE_ELEMENT_ID;
    container.setAttribute('aria-hidden', 'true');
    container.style.display = 'none';
    container.innerHTML = markup;
    document.body.insertBefore(container, document.body.firstChild);
  } catch (error) {
    console.warn(`No se ha podido cargar el sprite de iconos (${ICON_SPRITE_URL})`, error);
  }
}
