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
  styleUrl: './section-placeholder-page.component.scss',
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
