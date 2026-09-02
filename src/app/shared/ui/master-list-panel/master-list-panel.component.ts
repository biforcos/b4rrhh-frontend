import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  contentChild,
  input,
  output,
} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';

import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { UiButtonComponent } from '../button/ui-button.component';

export interface MasterListPanelItemContext<T> {
  $implicit: T;
  selected: boolean;
}

export interface MasterListPanelEmptyState {
  title: string;
  description: string;
}

@Component({
  selector: 'app-master-list-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, InputTextModule, UiButtonComponent, EmptyStateComponent],
  templateUrl: './master-list-panel.component.html',
  styleUrl: './master-list-panel.component.scss',
})
export class MasterListPanelComponent<T = unknown> {
  readonly title = input('');
  readonly subtitle = input('');
  readonly items = input.required<ReadonlyArray<T>>();
  readonly emptyState = input.required<MasterListPanelEmptyState>();
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly primaryActionLabel = input<string | null>(null);
  readonly primaryActionDisabled = input(false);
  readonly searchPlaceholder = input<string | null>(null);
  readonly searchValue = input('');
  readonly selectedItemKey = input<string | null>(null);
  readonly listAriaLabel = input('Master list');
  readonly itemKey = input.required<(item: T) => string>();

  readonly createNew = output<void>();
  readonly itemSelected = output<T>();
  readonly searchValueChange = output<string>();

  private readonly itemTemplate =
    contentChild.required<TemplateRef<MasterListPanelItemContext<T>>>(TemplateRef);

  protected onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchValueChange.emit(target?.value ?? '');
  }

  protected emitPrimaryAction(): void {
    this.createNew.emit();
  }

  protected emitItemSelected(item: T): void {
    this.itemSelected.emit(item);
  }

  protected isSelected(item: T): boolean {
    return this.itemKey()(item) === this.selectedItemKey();
  }

  protected trackByKey = (_index: number, item: T): string => this.itemKey()(item);

  protected resolveItemTemplate(): TemplateRef<MasterListPanelItemContext<T>> {
    return this.itemTemplate();
  }
}
