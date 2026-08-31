import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { appTexts } from '../../i18n/app-texts';

@Component({
  selector: 'app-section-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder-page">
      <header>
        <h2>{{ title }}</h2>
      </header>

      <p>{{ description }}</p>
    </section>
  `,
  styles: `
    .placeholder-page {
      border: 1px solid var(--border-subtle);
      background: #ffffff;
      border-radius: 0.8rem;
      box-shadow: var(--shadow-panel);
      padding: 1rem 1rem 1.1rem;
      display: grid;
      gap: 0.7rem;
      max-width: 52rem;
    }

    .placeholder-page h2 {
      margin: 0;
      font-size: 1.02rem;
      color: #17283c;
    }

    .placeholder-page p {
      margin: 0;
      color: var(--text-muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }
  `,
})
export class SectionPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title = this.readTitle();
  protected readonly description = this.readDescription();

  private readTitle(): string {
    const rawTitle = this.route.snapshot.data['title'];
    if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
      return `${rawTitle.trim()} · ${appTexts.placeholderTitleSuffix}`;
    }

    // La ruta genérica de entidades (frontend#33) no puede traer el título en data:
    // hasta que el tipo tenga pantalla, su código es el único nombre disponible.
    const typeCode = this.route.snapshot.paramMap.get('typeCode');
    if (typeCode) {
      return `${typeCode} · ${appTexts.placeholderTitleSuffix}`;
    }

    return `Seccion · ${appTexts.placeholderTitleSuffix}`;
  }

  private readDescription(): string {
    const rawDescription = this.route.snapshot.data['description'];
    if (typeof rawDescription === 'string' && rawDescription.trim().length > 0) {
      return rawDescription;
    }

    return 'Contenido inicial pendiente de implementacion en siguientes iteraciones.';
  }
}
