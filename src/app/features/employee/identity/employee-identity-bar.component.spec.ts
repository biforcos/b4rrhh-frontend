import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeDetailStore } from '../data-access/employee-detail.store';
import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { EmployeeDetailModel } from '../models/employee-detail.model';
import { EmployeeIdentityBarComponent } from './employee-identity-bar.component';

const KEY = { ruleSystemCode: 'ESP', employeeTypeCode: 'INTERNAL', employeeNumber: 'EMP000003' };
const EMPLOYEE: EmployeeDetailModel = {
  ...KEY,
  id: 3,
  firstName: 'Elena',
  lastName1: 'Serrano',
  lastName2: 'Ibáñez',
  preferredName: null,
  displayName: 'Elena Serrano Ibáñez',
  statusLabel: 'Active',
  workCenter: 'MAIN_OFFICE',
  photoUrl: null,
};

describe('EmployeeIdentityBarComponent', () => {
  const refresh = vi.fn();

  function render(
    overrides: Partial<{
      employee: EmployeeDetailModel | null;
      status: 'ACTIVE' | 'TERMINATED';
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
    fixture.componentRef.setInput('status', overrides.status ?? 'ACTIVE');
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
      render({ status: 'TERMINATED' })
        .nativeElement.querySelector('.identity-bar__status')
        ?.textContent?.trim(),
    ).toBe('Baja');
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

  it('copia la matrícula al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    (render().componentInstance as unknown as { copyMatricula(): void }).copyMatricula();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('EMP000003');
    vi.unstubAllGlobals();
  });
});
