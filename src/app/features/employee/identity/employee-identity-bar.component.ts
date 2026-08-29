import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';

import { B4IconComponent } from '../../../shared/ui/icon/b4-icon.component';
import { formatDisplayDate, parseLocalDate } from '../../../shared/utils/local-date.util';
import { EmployeeDetailStore } from '../data-access/employee-detail.store';
import { EmployeePhotoService } from '../data-access/employee-photo.service';
import { employeeTexts } from '../employee.texts';
import { EmployeeBusinessKey } from '../models/employee-business-key.model';
import { EmployeeDetailModel } from '../models/employee-detail.model';
import { EmployeePhotoUploadDialogComponent } from '../photo/employee-photo-upload-dialog.component';

/**
 * La barra de identidad de la ficha (frontend#24): quién es la persona que se está mirando, a
 * ancho completo en el hueco `identidad` del esqueleto (ADR-050), idéntica en todas las secciones.
 *
 * - El nombre pesa más que su clave: primero quién es; la matrícula, el sistema/tipo, el alta y
 *   la antigüedad van en una línea secundaria.
 * - El estado solo se dice cuando dice algo: activo es lo normal y lo normal calla.
 * - El retrato con el diálogo de subida que ya existía; iniciales de respaldo.
 * - Las acciones de página se proyectan a la derecha (`[identityActions]`); la miga, encima
 *   (`[identityBreadcrumb]`).
 */
@Component({
  selector: 'app-employee-identity-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagModule, B4IconComponent, EmployeePhotoUploadDialogComponent],
  templateUrl: './employee-identity-bar.component.html',
  styleUrl: './employee-identity-bar.component.scss',
})
export class EmployeeIdentityBarComponent {
  readonly employeeKey = input.required<EmployeeBusinessKey>();
  readonly employee = input<EmployeeDetailModel | null>(null);
  readonly hireDate = input<string | null>(null);
  readonly status = input<'ACTIVE' | 'TERMINATED'>('TERMINATED');
  readonly isAdmin = input(false);
  /** Hoy, inyectable para que los tests no dependan del reloj. */
  readonly today = input<string | null>(null);

  readonly editIdentityRequested = output<void>();

  private readonly photoService = inject(EmployeePhotoService);
  private readonly detailStore = inject(EmployeeDetailStore);

  protected readonly texts = employeeTexts;
  protected readonly uploadDialogVisible = signal(false);

  protected readonly displayName = computed(() => this.employee()?.displayName?.trim() || '—');

  protected readonly initials = computed(() => {
    const parts = (this.employee()?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase() || '?';
  });

  protected readonly photoUrl = computed(() => this.employee()?.photoUrl ?? null);

  /** Solo cuando dice algo: activo es lo normal. */
  protected readonly statusLabel = computed(() =>
    this.status() === 'ACTIVE' ? null : this.texts.employeeStatusInactiveLabel,
  );

  protected readonly hireDateLabel = computed(() => {
    const hireDate = this.hireDate();
    return hireDate ? formatDisplayDate(hireDate) : null;
  });

  /** «2 años y 10 meses», «7 meses» o «menos de un mes», contados desde el alta. */
  protected readonly seniorityLabel = computed(() => {
    const from = parseLocalDate(this.hireDate());
    const to = parseLocalDate(this.today()) ?? new Date();
    if (!from || from > to) return null;
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1;
    const t = this.texts;
    if (months < 1) return t.identitySeniorityLessThanMonth;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? t.identityYearLabel : t.identityYearsLabel}`);
    if (rest > 0) parts.push(`${rest} ${rest === 1 ? t.identityMonthLabel : t.identityMonthsLabel}`);
    return parts.join(` ${t.identityAndLabel} `);
  });

  protected requestEditIdentity(): void {
    this.editIdentityRequested.emit();
  }

  protected copyMatricula(): void {
    void navigator.clipboard.writeText(this.employeeKey().employeeNumber);
  }

  protected openUploadDialog(): void {
    if (!this.isAdmin()) return;
    this.uploadDialogVisible.set(true);
  }

  protected onPhotoConfirmed(): void {
    this.detailStore.refreshEmployeeDetailByBusinessKey(this.employeeKey());
  }

  protected deletePhoto(): void {
    this.photoService.deletePhoto(this.employeeKey()).subscribe({
      next: () => this.detailStore.refreshEmployeeDetailByBusinessKey(this.employeeKey()),
    });
  }
}
