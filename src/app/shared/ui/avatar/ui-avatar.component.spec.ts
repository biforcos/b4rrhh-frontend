import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UiAvatarComponent, initialsOf } from './ui-avatar.component';

@Component({
  imports: [UiAvatarComponent],
  template: `<app-ui-avatar
    [photoUrl]="photoUrl()"
    [firstName]="firstName()"
    [lastName1]="lastName1()"
    [preferredName]="preferredName()"
    [displayName]="displayName()"
  />`,
})
class HostComponent {
  readonly photoUrl = signal<string | null>(null);
  readonly firstName = signal<string | null>('Beatriz');
  readonly lastName1 = signal<string | null>('Gutierrez');
  readonly preferredName = signal<string | null>(null);
  readonly displayName = signal<string | null>('Beatriz Gutierrez Ramos');
}

describe('UiAvatarComponent', () => {
  function render(changes: Partial<Record<keyof HostComponent, string | null>> = {}) {
    const fixture = TestBed.createComponent(HostComponent);
    for (const [key, value] of Object.entries(changes)) {
      fixture.componentInstance[key as keyof HostComponent].set(value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('con foto pinta la foto, perezosa y de tamaño fijo, y no las iniciales', () => {
    const { el } = render({ photoUrl: '/api/employees/ESP/INTERNAL/EMP000025/photo?v=abc' });

    const img = el.querySelector('img.ui-avatar__photo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/api/employees/ESP/INTERNAL/EMP000025/photo?v=abc');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('32');
    expect(img.getAttribute('height')).toBe('32');
    expect(el.querySelector('.ui-avatar__initials')).toBeNull();
  });

  it('sin foto no hay <img> ni petición: nombre y primer apellido', () => {
    const { el } = render();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.ui-avatar__initials')?.textContent?.trim()).toBe('BG');
  });

  it('con un nombre compuesto toma la primera letra del nombre, no la del segundo apellido', () => {
    const { el } = render({
      firstName: 'Maria del Carmen',
      lastName1: 'Gutierrez',
      displayName: 'Maria del Carmen Gutierrez Ramos',
    });

    expect(el.querySelector('.ui-avatar__initials')?.textContent?.trim()).toBe('MG');
  });

  it('con nombre preferido, las iniciales son las de lo que se pinta al lado', () => {
    const { el } = render({
      firstName: 'Jose Antonio',
      lastName1: 'Alvarez',
      preferredName: 'Antonio Alvarez',
      displayName: 'Antonio Alvarez',
    });

    expect(el.querySelector('.ui-avatar__initials')?.textContent?.trim()).toBe('AA');
  });

  it('si la foto no carga, salen las iniciales en vez de una imagen rota', () => {
    const { fixture, el } = render({ photoUrl: '/api/employees/ESP/INTERNAL/EMP000025/photo?v=x' });

    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.ui-avatar__initials')?.textContent?.trim()).toBe('BG');
  });

  it('es decorativo: el nombre va al lado', () => {
    const { el } = render();

    expect(el.querySelector('.ui-avatar')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('initialsOf', () => {
  it('sin nombre ni apellido sueltos, primera y última palabra del nombre visible', () => {
    expect(initialsOf({ displayName: 'Lidia Morales Pena' })).toBe('LP');
  });

  it('con una sola palabra, sus dos primeras letras; sin nada, una interrogación', () => {
    expect(initialsOf({ displayName: 'Lidia' })).toBe('LI');
    expect(initialsOf({ displayName: '  ' })).toBe('?');
  });
});
