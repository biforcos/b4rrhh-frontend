import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface AvatarName {
  firstName?: string | null;
  lastName1?: string | null;
  preferredName?: string | null;
  displayName?: string | null;
}

/**
 * The initials of a person: first name and first surname, one letter each (frontend#144).
 *
 * From the parts and not from the display name, because a compound first name cannot be told apart
 * there: «Maria del Carmen Gutierrez Ramos» is MG, not MR. A preferred name wins, because it is what
 * is painted next to the avatar: Jose Antonio who goes by «Antonio Alvarez» is AA, not JA. Without
 * the parts (rows the browser remembered from before the directory carried them) it falls back to
 * the first and last word of the display name, which is what the employee identity bar does.
 */
export function initialsOf(name: AvatarName): string {
  const preferred = words(name.preferredName);
  if (preferred.length > 0) {
    return firstAndLast(preferred);
  }
  const first = name.firstName?.trim();
  const surname = name.lastName1?.trim();
  if (first && surname) {
    return (first[0] + surname[0]).toUpperCase();
  }
  const shown = words(name.displayName);
  return shown.length > 0 ? firstAndLast(shown) : '?';
}

function words(text: string | null | undefined): string[] {
  return (text ?? '').trim().split(/\s+/).filter(Boolean);
}

function firstAndLast(parts: string[]): string {
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A round 32 px portrait: the photo when there is one, the initials on a neutral ground when not.
 *
 * Decorative: the name always sits next to it, so it is hidden from assistive technology. Without a
 * photo there is no <img> and no request; null is null. The image loads lazily and has a fixed size,
 * so a page of fifty rows does not jump while the photos arrive, and if one fails to load the
 * initials take its place instead of a broken image. No colour per person (ADR-050: colour is not
 * spent on identity).
 */
@Component({
  selector: 'app-ui-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="ui-avatar" aria-hidden="true">
      @if (showPhoto()) {
        <img
          class="ui-avatar__photo"
          [src]="photoUrl()"
          alt=""
          width="32"
          height="32"
          loading="lazy"
          decoding="async"
          (error)="photoFailed.set(true)"
        />
      } @else {
        <span class="ui-avatar__initials">{{ initials() }}</span>
      }
    </span>
  `,
  styleUrl: './ui-avatar.component.scss',
})
export class UiAvatarComponent {
  readonly photoUrl = input<string | null | undefined>(null);
  readonly firstName = input<string | null | undefined>(null);
  readonly lastName1 = input<string | null | undefined>(null);
  readonly preferredName = input<string | null | undefined>(null);
  readonly displayName = input<string | null | undefined>(null);

  protected readonly photoFailed = signal(false);
  protected readonly showPhoto = computed(() => !!this.photoUrl() && !this.photoFailed());
  protected readonly initials = computed(() =>
    initialsOf({
      firstName: this.firstName(),
      lastName1: this.lastName1(),
      preferredName: this.preferredName(),
      displayName: this.displayName(),
    }),
  );
}
