/**
 * Copia un texto al portapapeles y dice si lo consiguió (`b4rrhh/frontend#138`).
 *
 * <p>«Estoy en el empleado 3 y me copia el 1». El botón llamaba a `navigator.clipboard.writeText` sin
 * mirar el resultado, y ese API sólo existe en un contexto seguro: abierta la demo por `http://` y
 * una IP, `navigator.clipboard` no está, el clic lanza un `TypeError` que sólo ve la consola, y el
 * portapapeles se queda con lo que tenía, que era la matrícula copiada antes.
 *
 * <p>Aquí se intenta el API y, si no está o se niega, el camino de siempre: un `textarea` y
 * `execCommand('copy')`, que funciona fuera de un contexto seguro. Y se devuelve si se copió, para que
 * quien llama lo diga: un botón que falla en silencio es peor que uno que no está.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Negado o fuera de foco: se prueba el camino de siempre.
  }
  return copyWithATextarea(text);
}

function copyWithATextarea(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
