import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { UiTagComponent } from '../tag/ui-tag.component';
import { B4IconComponent } from '../icon/b4-icon.component';

export interface EntityHeaderMetadataItem {
  label: string;
  value: string;
  copyable?: boolean;
}

export interface EntityHeaderStatus {
  label: string;
  severity?: 'success' | 'warn' | 'secondary' | 'contrast';
}

@Component({
  selector: 'app-entity-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiTagComponent, B4IconComponent],
  templateUrl: './entity-header.component.html',
  styleUrl: './entity-header.component.scss',
})
export class EntityHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly metadata = input<ReadonlyArray<EntityHeaderMetadataItem>>([]);
  readonly status = input<EntityHeaderStatus | null>(null);
  readonly avatarText = input<string | null>(null);
  readonly photoUrl = input<string | null>(null);

  protected readonly hasMetadata = computed(() => this.metadata().length > 0);
  protected readonly copiedLabel = signal<string | null>(null);

  private copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected copyValue(item: EntityHeaderMetadataItem): void {
    if (!item.copyable) return;
    navigator.clipboard.writeText(item.value).then(() => {
      if (this.copyTimeoutId !== null) clearTimeout(this.copyTimeoutId);
      this.copiedLabel.set(item.label);
      this.copyTimeoutId = setTimeout(() => this.copiedLabel.set(null), 1800);
    });
  }
}
