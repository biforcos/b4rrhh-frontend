import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ICON_SPRITE_ELEMENT_ID, ICON_SPRITE_URL, loadIconSprite } from './icon-sprite';

const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none"><symbol id="b4-empleado" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></symbol></svg>';

describe('loadIconSprite', () => {
  beforeEach(() => {
    document.getElementById(ICON_SPRITE_ELEMENT_ID)?.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.getElementById(ICON_SPRITE_ELEMENT_ID)?.remove();
  });

  it('inyecta el sprite al principio del body y deja sus symbols referenciables', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(SPRITE, { status: 200 }));

    await loadIconSprite(document);

    const container = document.getElementById(ICON_SPRITE_ELEMENT_ID);
    expect(container).not.toBeNull();
    expect(document.body.firstElementChild).toBe(container);
    expect(container?.getAttribute('aria-hidden')).toBe('true');
    expect(document.getElementById('b4-empleado')?.tagName.toLowerCase()).toBe('symbol');
    expect(fetch).toHaveBeenCalledWith(ICON_SPRITE_URL);
  });

  it('no lo carga dos veces', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(SPRITE, { status: 200 }));

    await loadIconSprite(document);
    await loadIconSprite(document);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#b4-empleado')).toHaveLength(1);
  });

  it('si la carga falla no rompe el arranque', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(loadIconSprite(document)).resolves.toBeUndefined();

    expect(document.getElementById(ICON_SPRITE_ELEMENT_ID)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
