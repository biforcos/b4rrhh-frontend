import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

import { employeeTexts } from '../../employee.texts';
import { EmployeeCoreIdentityDraft } from '../../models/employee-core-identity-draft.model';
import { EmployeeDetailModel } from '../../models/employee-detail.model';
import { UiButtonComponent } from '../../../../shared/ui/button/ui-button.component';
import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';

@Component({
  selector: 'app-employee-detail-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputTextModule, UiButtonComponent, B4IconComponent],
  templateUrl: './employee-detail-header.component.html',
  styleUrl: './employee-detail-header.component.scss',
})
export class EmployeeDetailHeaderComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly employee = input.required<EmployeeDetailModel>();
  readonly editorOnly = input(false);
  readonly openEditorRequestId = input(0);
  readonly updating = input(false);
  readonly updateError = input(false);
  readonly updateSuccess = input(false);
  readonly updateRequested = output<EmployeeCoreIdentityDraft>();
  readonly editInteractionStarted = output<void>();

  protected readonly texts = employeeTexts;
  protected readonly editingIdentity = signal(false);
  protected readonly identityForm = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName1: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName2: new FormControl('', { nonNullable: true }),
    preferredName: new FormControl('', { nonNullable: true }),
  });
  protected readonly avatarInitials = computed(() =>
    this.buildAvatarInitials(this.employee().displayName),
  );
  protected readonly statusTone = computed(() =>
    this.resolveStatusTone(this.employee().statusLabel),
  );

  constructor() {
    effect(() => {
      const requestId = this.openEditorRequestId();
      if (requestId <= 0) {
        return;
      }

      untracked(() => {
        this.openIdentityEditor();
      });
    });
  }

  protected openIdentityEditor(): void {
    const employee = this.employee();

    this.identityForm.setValue({
      firstName: employee.firstName,
      lastName1: employee.lastName1,
      lastName2: employee.lastName2 ?? '',
      preferredName: employee.preferredName ?? '',
    });

    this.editInteractionStarted.emit();
    this.editingIdentity.set(true);
  }

  protected cancelIdentityEditor(): void {
    if (this.updating()) {
      return;
    }

    this.editingIdentity.set(false);
    this.editInteractionStarted.emit();
  }

  protected submitIdentityUpdate(): void {
    if (this.identityForm.invalid || this.updating()) {
      this.identityForm.markAllAsTouched();
      return;
    }

    const value = this.identityForm.getRawValue();

    this.updateRequested.emit({
      firstName: value.firstName,
      lastName1: value.lastName1,
      lastName2: value.lastName2,
      preferredName: value.preferredName,
    });
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    if (!this.editingIdentity() || this.updating()) {
      return;
    }

    const eventTarget = event.target;
    if (!(eventTarget instanceof Node)) {
      return;
    }

    if (this.elementRef.nativeElement.contains(eventTarget)) {
      return;
    }

    this.editingIdentity.set(false);
  }

  private buildAvatarInitials(displayName: string): string {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      return this.texts.detailHeaderAvatarFallback;
    }

    const segments = normalizedName
      .split(/\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? '');

    return segments.join('') || this.texts.detailHeaderAvatarFallback;
  }

  private resolveStatusTone(statusLabel: string): 'default' | 'positive' | 'warning' | 'neutral' {
    const normalizedStatus = statusLabel.trim().toLowerCase();

    if (normalizedStatus.includes('active') || normalizedStatus.includes('alta')) {
      return 'positive';
    }

    if (normalizedStatus.includes('pending') || normalizedStatus.includes('draft')) {
      return 'warning';
    }

    if (
      normalizedStatus.includes('inactive') ||
      normalizedStatus.includes('closed') ||
      normalizedStatus.includes('baja')
    ) {
      return 'neutral';
    }

    return 'default';
  }
}
