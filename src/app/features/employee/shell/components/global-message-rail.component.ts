import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { B4IconComponent } from '../../../../shared/ui/icon/b4-icon.component';
import { B4IconName } from '../../../../shared/ui/icon/icon-names';

import { employeeTexts } from '../../employee.texts';
import {
  GlobalMessageSummary,
  GlobalUiMessage,
  GlobalUiMessageLevel,
} from '../../models/global-ui-message.model';

const MAX_VISIBLE = 4;

@Component({
  selector: 'app-global-message-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, B4IconComponent],
  animations: [
    trigger('toastEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(110%) scale(0.96)' }),
        animate(
          '280ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateX(0) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateX(110%) scale(0.96)' }),
        ),
      ]),
    ]),
  ],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (msg of visibleMessages(); track msg.id) {
        <div
          @toastEnter
          class="toast"
          [class]="toastClass(msg)"
          role="alert"
          [attr.aria-label]="msg.text"
        >
          @if (isTransient(msg)) {
            <div class="toast__progress" [style.animation-duration.ms]="msg.dismissAfterMs"></div>
          }

          <div class="toast__icon-shell">
            <b4-icon [name]="iconName(msg.level)" [size]="16" />
          </div>

          <div class="toast__body">
            <p class="toast__eyebrow">{{ eyebrow(msg.level) }}</p>
            <p class="toast__text">{{ msg.text }}</p>
            @if (msg.sectionLabel) {
              <p class="toast__section">{{ msg.sectionLabel }}</p>
            }
            @if (msg.sectionId) {
              <button class="toast__link" type="button" (click)="sectionRequested.emit(msg)">
                Ir a la sección
                <b4-icon class="toast__link-icon" name="flecha-derecha" [size]="16" />
              </button>
            }
          </div>

          <button
            class="toast__close"
            type="button"
            [attr.aria-label]="texts.globalMessageRailCloseDetailAction"
            (click)="closeRequested.emit()"
          >
            <b4-icon name="cerrar" [size]="16" />
          </button>
        </div>
      }

      @if (hiddenCount() > 0) {
        <div class="toast toast--overflow">
          <b4-icon class="toast__overflow-icon" name="mas-opciones" [size]="16" />
          <span class="toast__overflow-text"
            >+{{ hiddenCount() }} mensaje{{ hiddenCount() === 1 ? '' : 's' }} más</span
          >
          <button class="toast__close" type="button" (click)="closeRequested.emit()">
            <b4-icon name="cerrar" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './global-message-rail.component.scss',
})
export class GlobalMessageRailComponent {
  // Unused but kept for API compatibility with shell page
  readonly expanded = input(false);

  readonly messages = input<ReadonlyArray<GlobalUiMessage>>([]);
  readonly summary = input<GlobalMessageSummary>({
    total: 0,
    errorCount: 0,
    warningCount: 0,
    successCount: 0,
    infoCount: 0,
    dominantLevel: null,
  });

  readonly toggleRequested = output<void>();
  readonly closeRequested = output<void>();
  readonly sectionRequested = output<GlobalUiMessage>();

  protected readonly texts = employeeTexts;

  protected readonly visibleMessages = computed(() => this.messages().slice(0, MAX_VISIBLE));

  protected readonly hiddenCount = computed(() =>
    Math.max(this.messages().length - MAX_VISIBLE, 0),
  );

  protected toastClass(msg: GlobalUiMessage): string {
    return `toast toast--${msg.level}`;
  }

  protected isTransient(msg: GlobalUiMessage): boolean {
    return !!msg.dismissAfterMs && !msg.sticky;
  }

  protected iconName(level: GlobalUiMessageLevel): B4IconName {
    const map: Record<GlobalUiMessageLevel, B4IconName> = {
      success: 'comprobar',
      error: 'error',
      warning: 'aviso',
      info: 'informacion',
    };
    return map[level];
  }

  protected eyebrow(level: GlobalUiMessageLevel): string {
    const map: Record<GlobalUiMessageLevel, string> = {
      success: 'Éxito',
      error: 'Error',
      warning: 'Aviso',
      info: 'Info',
    };
    return map[level];
  }
}
