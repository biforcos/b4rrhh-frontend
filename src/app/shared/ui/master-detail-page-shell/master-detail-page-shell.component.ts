import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-master-detail-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-detail-page-shell.component.html',
  styleUrl: './master-detail-page-shell.component.scss',
  host: {
    class: 'master-detail-page-shell-host',
  },
})
export class MasterDetailPageShellComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
