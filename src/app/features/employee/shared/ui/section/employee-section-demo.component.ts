import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { employeeTexts } from '../../../employee.texts';
import { EmployeeSectionShellComponent } from './employee-section-shell.component';
import { SectionActionContract, SectionUiState } from './section-ui-state.model';

const initialUiState: SectionUiState = {
  mode: 'view',
  dirty: false,
  busy: false,
  errorMessage: null,
  successMessage: null,
};

@Component({
  selector: 'app-employee-section-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmployeeSectionShellComponent],
  template: `
    <app-employee-section-shell
      [title]="texts.sectionDemoTitle"
      [subtitle]="texts.sectionDemoSubtitle"
      [state]="uiState()"
    >
      <div sectionCardActions class="employee-section-demo__header-actions">
        @if (uiState().mode === 'view' && !uiState().busy) {
          <button type="button" (click)="startCreate()">
            {{ texts.sectionShellCreateAction }}
          </button>
          <button type="button" (click)="startEdit(demoBusinessKey)">
            {{ texts.sectionShellEditAction }}
          </button>
        }

        @if (
          (uiState().mode === 'editing' ||
            uiState().mode === 'creating' ||
            uiState().mode === 'confirming') &&
          !uiState().busy
        ) {
          <button type="button" class="employee-section-demo__cancel-action" (click)="cancel()">
            {{ texts.sectionShellCancelAction }}
          </button>
        }
      </div>

      <div class="employee-section-demo__content">
        @if (uiState().mode === 'view') {
          <p>{{ texts.sectionDemoViewMessage }}</p>
        }

        @if (uiState().mode === 'creating') {
          <p>{{ texts.sectionDemoCreatingMessage }}</p>
          <button type="button" (click)="submitCreate()">
            {{ texts.sectionDemoSubmitCreateAction }}
          </button>
        }

        @if (uiState().mode === 'editing') {
          <p>{{ texts.sectionDemoEditingMessage }}</p>
          <button type="button" (click)="submitEdit()">
            {{ texts.sectionDemoSubmitEditAction }}
          </button>
        }

        @if (uiState().mode === 'confirming') {
          <p>{{ texts.sectionDemoConfirmingMessage }}</p>
          <button type="button" (click)="confirmClose()">
            {{ texts.sectionDemoConfirmCloseAction }}
          </button>
        }
      </div>
    </app-employee-section-shell>
  `,
  styles: `
    .employee-section-demo__header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.24rem;
    }

    .employee-section-demo__header-actions button {
      border: 1px solid #cbd8e6;
      border-radius: 999px;
      background: #f8fbff;
      color: #29435d;
      font-size: 0.64rem;
      font-weight: 600;
      line-height: 1;
      padding: 0.21rem 0.5rem;
      cursor: pointer;
    }

    .employee-section-demo__header-actions button:hover {
      background: #eef4fa;
    }

    .employee-section-demo__cancel-action {
      border-color: #d6dfe8;
      background: #fbfcfe;
      color: #4f6479;
    }

    .employee-section-demo__content {
      display: grid;
      gap: 0.3rem;
      font-size: 0.68rem;
      color: #4f6478;
    }

    .employee-section-demo__content p {
      margin: 0;
      line-height: 1.3;
    }

    .employee-section-demo__content button {
      width: fit-content;
      border: 1px solid #bdd0e3;
      border-radius: 999px;
      background: #f4f9ff;
      color: #29435d;
      font-size: 0.62rem;
      line-height: 1;
      font-weight: 600;
      padding: 0.2rem 0.45rem;
      cursor: pointer;
    }
  `,
})
export class EmployeeSectionDemoComponent implements SectionActionContract<string> {
  protected readonly texts = employeeTexts;
  protected readonly demoBusinessKey = 'DEMO-BUSINESS-KEY';
  protected readonly uiState = signal<SectionUiState>(initialUiState);

  startCreate(): void {
    this.uiState.set({
      mode: 'creating',
      dirty: false,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  startEdit(key: string): void {
    if (!key.trim()) {
      return;
    }

    this.uiState.set({
      mode: 'editing',
      dirty: true,
      busy: false,
      errorMessage: null,
      successMessage: null,
    });
  }

  requestDelete(key: string): void {
    if (!key.trim()) {
      return;
    }

    this.uiState.update((state) => ({
      ...state,
      mode: 'confirming',
      errorMessage: null,
      successMessage: null,
    }));
  }

  requestClose(key: string): void {
    if (!key.trim()) {
      return;
    }

    this.uiState.update((state) => ({
      ...state,
      mode: 'confirming',
      errorMessage: null,
      successMessage: null,
    }));
  }

  cancel(): void {
    this.uiState.set(initialUiState);
  }

  submitCreate(): void {
    if (this.uiState().mode !== 'creating') {
      return;
    }

    this.simulateSubmit(this.texts.sectionDemoCreateSuccessMessage);
  }

  submitEdit(): void {
    if (this.uiState().mode !== 'editing') {
      return;
    }

    this.simulateSubmit(this.texts.sectionDemoEditSuccessMessage);
  }

  confirmDelete(): void {
    this.simulateSubmit(this.texts.sectionDemoDeleteSuccessMessage);
  }

  confirmClose(): void {
    this.simulateSubmit(this.texts.sectionDemoCloseSuccessMessage);
  }

  private simulateSubmit(successMessage: string): void {
    this.uiState.update((state) => ({
      ...state,
      mode: 'submitting',
      dirty: false,
      busy: true,
      errorMessage: null,
      successMessage: null,
    }));

    window.setTimeout(() => {
      this.uiState.set({
        mode: 'view',
        dirty: false,
        busy: false,
        errorMessage: null,
        successMessage,
      });
    }, 500);
  }
}
