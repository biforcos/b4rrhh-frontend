import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UiButtonComponent } from '../../../shared/ui/button/ui-button.component';
import { catalogTexts } from '../catalog.texts';
import { RuleEntityModel } from '../models/rule-entity.model';
import { DISPLAY_DATE_FORMAT } from '../../../shared/utils/local-date.util';

@Component({
  selector: 'app-rule-entity-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, UiButtonComponent],
  templateUrl: './rule-entity-list.component.html',
  styleUrl: './rule-entity-list.component.scss',
})
export class RuleEntityListComponent {
  readonly items = input<ReadonlyArray<RuleEntityModel>>([]);
  readonly actionsDisabled = input(false);
  readonly correctRequested = output<string>();
  readonly closeRequested = output<string>();
  readonly deleteRequested = output<string>();
  protected readonly texts = catalogTexts;
  protected readonly displayDateFormat = DISPLAY_DATE_FORMAT;

  protected requestCorrect(occurrenceKey: string): void {
    if (this.actionsDisabled()) {
      return;
    }

    this.correctRequested.emit(occurrenceKey);
  }

  protected requestClose(occurrenceKey: string): void {
    if (this.actionsDisabled()) {
      return;
    }

    this.closeRequested.emit(occurrenceKey);
  }

  protected requestDelete(occurrenceKey: string): void {
    if (this.actionsDisabled()) {
      return;
    }

    this.deleteRequested.emit(occurrenceKey);
  }
}
