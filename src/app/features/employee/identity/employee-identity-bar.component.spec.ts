import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeDetailStore } from '../data-access/employee-detail.store';
import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { EmployeeDetailModel, EmployeeStatus } from '../models/employee-detail.model';
import { GlobalMessageService } from '../data-access/employee-global-message.store';
import { EmployeeIdentityBarComponent } from './employee-identity-bar.component';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000003' };
const EMPLOYEE: EmployeeDetailModel = {
  ...KEY,
  firstName: 'Elena',
  lastName1: 'Serrano',
  lastName2: 'Ibáñez',
  preferredName: null,
  displayName: 'Elena Serrano Ibáñez',
  statusLabel: 'Active',
  status: 'ACTIVE',
  statusSince: '2023-10-02',
  plannedTerminationDate: null,
  plannedHireDate: null,
  workCenter: 'MAIN_OFFICE',
  photoUrl: null,
};

describe('EmployeeIdentityBarComponent', () => {
  const refresh = vi.fn();

  function render(
    overrides: Partial<{
      employee: EmployeeDetailModel | null;
      status: EmployeeStatus | null;
      notFound: boolean;
      hireDate: string | null;
      isAdmin: boolean;
    }> = {},
  ) {
    const fixture = TestBed.createComponent(EmployeeIdentityBarComponent);
    fixture.componentRef.setInput('employeeKey', KEY);
    fixture.componentRef.setInput(
      'employee',
      overrides.employee === undefined ? EMPLOYEE : overrides.employee,
    );
    fixture.componentRef.setInput(
      'status',
      overrides.status === undefined ? 'ACTIVE' : overrides.status,
    );
    if (overrides.notFound !== undefined) {
      fixture.componentRef.setInput('notFound', overrides.notFound);
    }
    fixture.componentRef.setInput(
      'hireDate',
      overrides.hireDate === undefined ? '2023-10-02' : overrides.hireDate,
    );
    fixture.componentRef.setInput('isAdmin', overrides.isAdmin ?? false);
    fixture.componentRef.setInput('today', '2026-08-29');
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    refresh.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: EmployeePhotoService,
          useValue: { deletePhoto: vi.fn().mockReturnValue(of(undefined)) },
        },
        {
          provide: EmployeeDetailStore,
          useValue: {
            refreshEmployeeDetailByBusinessKey: refresh,
            selectedEmployeeDetail: signal(null),
          },
        },
      ],
    });
  });

  it('el nombre manda y la clave va detrás, con alta y antigüedad', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('h1.identity-bar__name')?.textContent?.trim()).toBe(
      'Elena Serrano Ibáñez',
    );
    const meta = el.querySelector('.identity-bar__meta')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(meta).toContain('EMP000003');
    expect(meta).toContain('ESP / INTERNAL');
    expect(meta).toContain('alta 02/10/2023');
    expect(meta).toContain('antigüedad 2 años y 10 meses');
    expect(el.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('el estado calla cuando es activo y habla cuando es baja', () => {
    expect(render().nativeElement.querySelector('.identity-bar__status')).toBeNull();
    expect(
      render({
        employee: { ...EMPLOYEE, status: 'TERMINATED', statusSince: null },
        status: 'TERMINATED',
      })
        .nativeElement.querySelector('.identity-bar__status')
        ?.textContent?.trim(),
    ).toBe('Baja');
  });

  // b4rrhh/backend#148: el estado lo dice el servidor a partir de las presencias, con sus fechas.
  function statusTag(employee: Partial<EmployeeDetailModel>, status: EmployeeStatus) {
    return render({ employee: { ...EMPLOYEE, ...employee, status }, status })
      .nativeElement.querySelector('.identity-bar__status')
      ?.textContent?.trim();
  }

  it('un cese grabado a futuro no es una baja: dice el día del cese', () => {
    expect(statusTag({ plannedTerminationDate: '2026-09-30' }, 'ACTIVE')).toBe(
      'Cese el 30/09/2026',
    );
  });

  it('la baja dice desde cuándo y, si la hay, cuándo vuelve', () => {
    expect(statusTag({ statusSince: '2026-10-01' }, 'TERMINATED')).toBe('Baja desde el 01/10/2026');
    expect(
      statusTag({ statusSince: '2026-05-14', plannedHireDate: '2026-07-01' }, 'TERMINATED'),
    ).toBe('Baja desde el 14/05/2026 · readmisión el 01/07/2026');
  });

  it('un alta a futuro todavía no es un empleado de alta', () => {
    expect(statusTag({ statusSince: null, plannedHireDate: '2026-11-01' }, 'NOT_HIRED')).toBe(
      'Alta el 01/11/2026',
    );
    expect(statusTag({ statusSince: null }, 'NOT_HIRED')).toBe('Sin alta');
  });

  it('sin foto, iniciales; con foto, la foto', () => {
    const noPhoto: HTMLElement = render().nativeElement;
    expect(noPhoto.querySelector('.identity-bar__initials')?.textContent?.trim()).toBe('EI');
    expect(noPhoto.querySelector('img')).toBeNull();
    const withPhoto: HTMLElement = render({
      employee: { ...EMPLOYEE, photoUrl: 'http://minio/foto.jpg' },
    }).nativeElement;
    expect(withPhoto.querySelector('img.identity-bar__photo')?.getAttribute('src')).toBe(
      'http://minio/foto.jpg',
    );
    expect(withPhoto.querySelector('.identity-bar__initials')).toBeNull();
  });

  it('la antigüedad cuenta meses enteros y no dice nada antes del alta', () => {
    expect(
      render({ hireDate: '2026-08-10' }).nativeElement.querySelector('.identity-bar__meta')
        ?.textContent,
    ).toContain('menos de un mes');
    expect(
      render({ hireDate: '2025-08-29' }).nativeElement.querySelector('.identity-bar__meta')
        ?.textContent,
    ).toContain('antigüedad 1 año');
    expect(
      render({ hireDate: '2027-01-01' }).nativeElement.querySelector('.identity-bar__meta')
        ?.textContent,
    ).not.toContain('antigüedad');
  });

  it('quien administra abre el diálogo de foto; al confirmar, la ficha se refresca sin recargar', () => {
    const fixture = render({ isAdmin: true });
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.identity-bar__portrait') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-employee-photo-upload-dialog')).not.toBeNull();
    (fixture.componentInstance as unknown as { onPhotoConfirmed(): void }).onPhotoConfirmed();
    expect(refresh).toHaveBeenCalledWith(KEY);
  });

  /**
   * «Estoy en el empleado 3 y me copia el 1» (`b4rrhh/frontend#138`): copia la de la ficha en la
   * que está, también después de navegar de una a otra, y dice que lo hizo.
   */
  describe('copiar la matrícula', () => {
    const copiar = (fixture: ReturnType<typeof render>) =>
      (fixture.componentInstance as unknown as { copyMatricula(): Promise<void> }).copyMatricula();
    const mensajes = () =>
      TestBed.inject(GlobalMessageService)
        .messages()
        .map((m) => m.text);

    afterEach(() => vi.unstubAllGlobals());

    it('de una ficha a otra, copia la del segundo y lo dice', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      const fixture = render();
      fixture.componentRef.setInput('employeeKey', { ...KEY, employeeNumber: 'EMP000001' });
      fixture.detectChanges();
      fixture.componentRef.setInput('employeeKey', KEY);
      fixture.detectChanges();

      await copiar(fixture);

      expect(writeText).toHaveBeenCalledWith('EMP000003');
      expect(mensajes()).toContain('Matrícula EMP000003 copiada.');
    });

    it('sin el API del portapapeles (http en la demo) no falla en silencio: lo dice, con el número', async () => {
      vi.stubGlobal('navigator', {});
      const execCommand = vi.fn().mockReturnValue(false);
      Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

      await copiar(render());

      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(mensajes().join(' ')).toContain('El navegador no deja escribir en el portapapeles');
      expect(mensajes().join(' ')).toContain('EMP000003');
    });

    it('sin el API, el camino de siempre copia y lo dice', async () => {
      vi.stubGlobal('navigator', {});
      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: vi.fn().mockReturnValue(true),
      });

      await copiar(render());

      expect(mensajes()).toContain('Matrícula EMP000003 copiada.');
    });
  });

  // Un empleado que no existe no está de baja (`b4rrhh/frontend#101`): la cabecera lo dice con
  // una frase y no le pone estado ni acciones sobre la persona.
  it('de un empleado que no existe dice que no existe y no le inventa estado', () => {
    const el: HTMLElement = render({
      employee: null,
      status: null,
      hireDate: null,
      notFound: true,
      isAdmin: true,
    }).nativeElement;
    expect(el.querySelector('h1.identity-bar__name')?.textContent?.trim()).toBe(
      'No existe el empleado ESP/INTERNAL/EMP000003',
    );
    expect(el.querySelector('.identity-bar__status')).toBeNull();
    expect(el.querySelector('.identity-bar__meta')).toBeNull();
    expect(el.querySelector('.identity-bar__portrait')).toBeNull();
    expect(el.querySelector('.identity-bar__icon-btn')).toBeNull();
  });

  it('mientras no hay detalle no dice «Baja»', () => {
    const el: HTMLElement = render({ employee: null, status: null }).nativeElement;
    expect(el.querySelector('.identity-bar__status')).toBeNull();
  });
});
