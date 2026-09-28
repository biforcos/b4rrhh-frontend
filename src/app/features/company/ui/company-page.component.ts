import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { companyTexts } from '../company.texts';
import { CompanyStore } from '../store/company.store';
import { CompanyBusinessKey } from '../models/company-ui-state.model';
import { CompanyFormValue } from '../models/company-form-value.model';
import { CompanyListComponent } from './company-list.component';
import { CompanyDetailPanelComponent } from './company-detail-panel.component';
import { DisplayNameFormatCardComponent } from './display-name-format-card.component';
import { EmployeeNumberingConfigCardComponent } from './employee-numbering-config-card.component';
import { MasterDetailPageShellComponent } from '../../../shared/ui/master-detail-page-shell/master-detail-page-shell.component';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { describeFailure } from '../../../shared/utils/http-failure.util';

@Component({
  selector: 'app-company-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MasterDetailPageShellComponent,
    SectionCardComponent,
    CompanyListComponent,
    CompanyDetailPanelComponent,
    DisplayNameFormatCardComponent,
    EmployeeNumberingConfigCardComponent,
  ],
  templateUrl: './company-page.component.html',
  styleUrl: './company-page.component.scss',
})
export class CompanyPageComponent {
  protected readonly store = inject(CompanyStore);
  protected readonly texts = companyTexts;
  /** El molde de un error en pantalla (`b4rrhh/frontend#92`), para la plantilla. */
  protected readonly describeFailure = describeFailure;

  protected onNewCompany(): void {
    this.store.startCreate();
  }

  protected onCompanySelected(key: CompanyBusinessKey): void {
    this.store.selectCompany(key);
  }

  protected onEditRequested(): void {
    const key = this.store.selectedKey();
    if (key) {
      this.store.startEdit(key);
    }
  }

  protected onFormSubmit(formValue: CompanyFormValue): void {
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
