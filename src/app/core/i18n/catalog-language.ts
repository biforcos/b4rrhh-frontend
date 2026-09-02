/**
 * El idioma en que se piden los literales de catálogo al backend: viaja en `Accept-Language`
 * (ADR-052 §4) y el backend devuelve, para cada código, la traducción en ese idioma o el
 * literal base si no la hay.
 *
 * Hoy es una constante porque no hay preferencia de usuario: la aplicación se usa en castellano
 * y no está decidido que vaya a haber un selector de idioma. El ADR-052 §4 deja dicho que el
 * idioma es de quien mira, no del sistema de reglas, así que el día que exista esa preferencia
 * el cambio va aquí —de dónde sale el valor— y no en cada llamada (frontend#35).
 *
 * No confundir con `SPANISH_LOCALE`: aquel es el locale de fechas y números, este es el idioma
 * de los literales. El ADR-052 los separa a propósito.
 *
 * BCP 47 corto (`es-ES`, `fr-FR`, `en`), que es lo que el backend canoniza y lo que lleva la
 * semilla de traducciones.
 */
export const CATALOG_LANGUAGE = 'es-ES';
