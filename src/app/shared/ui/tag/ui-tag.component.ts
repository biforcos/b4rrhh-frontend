import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';

type UiTagSeverity =
  | 'success'
  | 'secondary'
  | 'info'
  | 'warn'
  | 'danger'
  | 'contrast'
  | undefined
  | null;

@Component({
  selector: 'app-ui-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagModule],
  template:
    '<p-tag [value]="value()" [severity]="severity()" [rounded]="rounded()" [icon]="icon()" />',
  styles: [
    ':host { display: inline-flex; align-items: center; }',
    ':host :where(.p-tag) { border-radius: 999px; line-height: 1; }',
  ],
})
export class UiTagComponent {
  readonly value = input('');
  readonly severity = input<UiTagSeverity>(undefined);
  readonly rounded = input(false);
  readonly icon = input<string | undefined>(undefined);
}
