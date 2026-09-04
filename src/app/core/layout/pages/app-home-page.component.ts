import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { appTexts } from '../../i18n/app-texts';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="home-page">
      <header class="home-page__header">
        <h2>{{ texts.homeTitle }}</h2>
        <p>{{ texts.homeDescription }}</p>
      </header>

      <div class="home-page__actions">
        <a routerLink="/personas/empleados">{{ texts.homeEmployeesShortcut }}</a>
      </div>
    </section>
  `,
  styleUrl: './app-home-page.component.scss',
})
export class AppHomePageComponent {
  protected readonly texts = appTexts;
}
