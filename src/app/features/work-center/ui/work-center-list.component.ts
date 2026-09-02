import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ListItemComponent } from '../../../shared/ui/list-item/list-item.component';
import { MasterListPanelComponent } from '../../../shared/ui/master-list-panel/master-list-panel.component';
import { UiTagComponent } from '../../../shared/ui/tag/ui-tag.component';
import { WorkCenterListItemModel } from '../models/work-center-list-item.model';
import { WorkCenterBusinessKey } from '../models/work-center-ui-state.model';
import { workCenterTexts } from '../work-center.texts';

@Component({
  selector: 'app-work-center-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MasterListPanelComponent, ListItemComponent, UiTagComponent],
  templateUrl: './work-center-list.component.html',
  styleUrl: './work-center-list.component.scss',
})
export class WorkCenterListComponent {
  readonly workCenters = input.required<ReadonlyArray<WorkCenterListItemModel>>();
  readonly selectedKey = input<WorkCenterBusinessKey | null>(null);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly workCenterSelected = output<WorkCenterBusinessKey>();
  readonly newRequested = output<void>();

  protected readonly texts = workCenterTexts;
  protected readonly searchValue = signal('');
  protected readonly selectedListKey = computed(() => {
    const key = this.selectedKey();
    return key ? this.itemKey(key.ruleSystemCode, key.workCenterCode) : null;
  });
  protected readonly visibleWorkCenters = computed(() => {
    const normalizedQuery = this.searchValue().trim().toLowerCase();
    if (!normalizedQuery) {
      return this.workCenters();
    }

    return this.workCenters().filter((item) => {
      const haystack = [
        item.workCenterCode,
        item.ruleSystemCode,
        item.name,
        item.companyCode ?? '',
        item.city ?? '',
        item.countryCode ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  });

  protected readonly workCenterKeyOf = (item: WorkCenterListItemModel): string =>
    this.itemKey(item.ruleSystemCode, item.workCenterCode);

  protected formatLocation(item: WorkCenterListItemModel): string {
    const location = [item.city, item.countryCode]
      .filter((value): value is string => !!value)
      .join(' · ');
    return location || this.texts.detailViewEmptyValue;
  }

  protected requestSelect(item: WorkCenterListItemModel): void {
    this.workCenterSelected.emit({
      ruleSystemCode: item.ruleSystemCode,
      workCenterCode: item.workCenterCode,
    });
  }

  protected requestCreate(): void {
    this.newRequested.emit();
  }

  protected updateSearchValue(value: string): void {
    this.searchValue.set(value);
  }

  private itemKey(ruleSystemCode: string, workCenterCode: string): string {
    return `${ruleSystemCode}::${workCenterCode}`;
  }
}
