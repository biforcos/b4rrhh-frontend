import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from '../../auth/auth.store';
import { appTexts } from '../../i18n/app-texts';
import { NavigationMenuStore } from '../navigation/navigation-menu.store';
import { RuleSystemScopeStore } from '../../scope/rule-system-scope.store';
import { B4IconComponent } from '../../../shared/ui/icon/b4-icon.component';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  protected readonly texts = appTexts;
  protected readonly auth = inject(AuthStore);
  protected readonly scope = inject(RuleSystemScopeStore);
  protected readonly menu = inject(NavigationMenuStore);

  private readonly router = inject(Router);

  protected readonly userInitials = computed(() => {
    const subject = this.auth.subject() ?? '';
    return subject.slice(0, 2).toUpperCase() || '?';
  });

  ngOnInit(): void {
    this.scope.load();
    this.menu.load();
  }

  protected onScopeChange(event: Event): void {
    this.scope.select((event.target as HTMLSelectElement).value);
  }

  protected async logout(): Promise<void> {
    this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
