import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { MasterDetailPageShellComponent } from '../../../shared/ui/master-detail-page-shell/master-detail-page-shell.component';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { WorkCenterContactFormValue } from '../models/work-center-contact-form-value.model';
import { WorkCenterFormValue } from '../models/work-center-form-value.model';
import { WorkCenterBusinessKey } from '../models/work-center-ui-state.model';
import { WorkCenterStore } from '../store/work-center.store';
import { workCenterTexts } from '../work-center.texts';
import { WorkCenterDetailPanelComponent } from './work-center-detail-panel.component';
import { WorkCenterListComponent } from './work-center-list.component';

@Component({
  selector: 'app-work-center-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MasterDetailPageShellComponent,
    SectionCardComponent,
    WorkCenterListComponent,
    WorkCenterDetailPanelComponent,
  ],
  templateUrl: './work-center-page.component.html',
  styleUrl: './work-center-page.component.scss',
})
export class WorkCenterPageComponent {
  protected readonly store = inject(WorkCenterStore);
  protected readonly texts = workCenterTexts;

  protected onNewWorkCenter(): void {
    this.store.startCreate();
  }

  protected onWorkCenterSelected(key: WorkCenterBusinessKey): void {
    this.store.selectWorkCenter(key);
  }

  protected onEditRequested(): void {
    const key = this.store.selectedKey();
    if (key) {
      this.store.startEdit(key);
    }
  }

  protected onFormSubmit(formValue: WorkCenterFormValue): void {
    const key = this.store.selectedKey();
    if (this.store.isCreating()) {
      this.store.submitCreate(formValue);
    } else if (key) {
      this.store.submitUpdate(key, formValue);
    }
  }

  protected onFormCancel(): void {
    this.store.cancelForm();
  }

  protected onContactCreate(formValue: WorkCenterContactFormValue): void {
    this.store.submitCreateContact(formValue);
  }

  protected onContactUpdate(event: {
    contactNumber: number;
    formValue: WorkCenterContactFormValue;
  }): void {
    this.store.submitUpdateContact(event.contactNumber, event.formValue);
  }

  protected onContactDelete(contactNumber: number): void {
    this.store.deleteContact(contactNumber);
  }

  protected get detailMode(): 'create' | 'view' | 'edit' {
    if (this.store.isCreating()) {
      return 'create';
    }
    if (this.store.isEditing()) {
      return 'edit';
    }
    return 'view';
  }
}
