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
  styles: [
    `
      :host {
        display: block;
        pointer-events: none;
      }

      .toast-stack {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 0.52rem;
        width: min(22rem, calc(100vw - 2rem));
        pointer-events: none;
      }

      /* ─── BASE TOAST ─── */
      .toast {
        pointer-events: auto;
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 0.72rem;
        padding: 0.82rem 0.78rem 0.82rem 0.82rem;
        border-radius: 0.92rem;
        border: 1px solid transparent;
        overflow: hidden;
        box-shadow:
          0 4px 6px -1px rgba(0, 0, 0, 0.08),
          0 10px 28px -8px rgba(0, 0, 0, 0.16),
          0 0 0 1px rgba(255, 255, 255, 0.12) inset;
      }

      /* ─── PROGRESS BAR ─── */
      .toast__progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 0.2rem;
        width: 100%;
        transform-origin: left center;
        animation: toast-progress linear forwards;
        border-radius: 0 0 0.92rem 0.92rem;
      }

      @keyframes toast-progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      /* ─── ICON ─── */
      .toast__icon-shell {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 0.04rem;
      }

      /* ─── BODY ─── */
      .toast__body {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 0.12rem;
      }

      .toast__eyebrow {
        font-size: 0.58rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        line-height: 1.2;
      }

      .toast__text {
        font-size: 0.82rem;
        font-weight: 600;
        line-height: 1.35;
      }

      .toast__section {
        font-size: 0.7rem;
        font-weight: 500;
        opacity: 0.7;
        line-height: 1.2;
      }

      .toast__link {
        display: inline-flex;
        align-items: center;
        gap: 0.28rem;
        margin-top: 0.18rem;
        font-size: 0.72rem;
        font-weight: 700;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      /* ─── CLOSE ─── */
      .toast__close {
        flex-shrink: 0;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 0.02rem;
        transition: background 120ms ease;
      }

      /* ─── SUCCESS ─── */
      .toast--success {
        background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
        border-color: #bbf7d0;
      }

      .toast--success .toast__icon-shell {
        background: #dcfce7;
      }

      .toast--success .toast__icon-shell b4-icon {
        color: #16a34a;
      }

      .toast--success .toast__eyebrow {
        color: #15803d;
      }
      .toast--success .toast__text {
        color: #14532d;
      }
      .toast--success .toast__section {
        color: #4ade80;
      }
      .toast--success .toast__link {
        color: #16a34a;
      }

      .toast--success .toast__progress {
        background: linear-gradient(90deg, #16a34a, #4ade80);
      }

      .toast--success .toast__close {
        background: rgba(22, 163, 74, 0.1);
        color: #16a34a;
      }

      .toast--success .toast__close:hover {
        background: rgba(22, 163, 74, 0.2);
      }

      /* ─── ERROR ─── */
      .toast--error {
        background: linear-gradient(135deg, #fff1f2 0%, #ffffff 100%);
        border-color: #fecdd3;
      }

      .toast--error .toast__icon-shell {
        background: #ffe4e6;
      }

      .toast--error .toast__icon-shell b4-icon {
        color: #dc2626;
      }

      .toast--error .toast__eyebrow {
        color: #b91c1c;
      }
      .toast--error .toast__text {
        color: #7f1d1d;
      }
      .toast--error .toast__link {
        color: #dc2626;
      }

      .toast--error .toast__close {
        background: rgba(220, 38, 38, 0.08);
        color: #dc2626;
      }

      .toast--error .toast__close:hover {
        background: rgba(220, 38, 38, 0.18);
      }

      /* ─── WARNING ─── */
      .toast--warning {
        background: linear-gradient(135deg, #fffbeb 0%, #ffffff 100%);
        border-color: #fde68a;
      }

      .toast--warning .toast__icon-shell {
        background: #fef3c7;
      }

      .toast--warning .toast__icon-shell b4-icon {
        color: #d97706;
      }

      .toast--warning .toast__eyebrow {
        color: #b45309;
      }
      .toast--warning .toast__text {
        color: #78350f;
      }
      .toast--warning .toast__link {
        color: #d97706;
      }

      .toast--warning .toast__close {
        background: rgba(217, 119, 6, 0.08);
        color: #d97706;
      }

      .toast--warning .toast__close:hover {
        background: rgba(217, 119, 6, 0.18);
      }

      /* ─── INFO ─── */
      .toast--info {
        background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
        border-color: #bae6fd;
      }

      .toast--info .toast__icon-shell {
        background: #e0f2fe;
      }

      .toast--info .toast__icon-shell .pi {
        color: #0284c7;
      }

      .toast--info .toast__eyebrow {
        color: #0369a1;
      }
      .toast--info .toast__text {
        color: #0c4a6e;
      }
      .toast--info .toast__link {
        color: #0284c7;
      }

      .toast--info .toast__progress {
        background: linear-gradient(90deg, #0284c7, #38bdf8);
      }

      .toast--info .toast__close {
        background: rgba(2, 132, 199, 0.08);
        color: #0284c7;
      }

      .toast--info .toast__close:hover {
        background: rgba(2, 132, 199, 0.18);
      }

      /* ─── OVERFLOW ─── */
      .toast--overflow {
        background: #f8fafc;
        border-color: #e2e8f0;
        align-items: center;
        padding: 0.56rem 0.78rem;
      }

      .toast__overflow-icon {
        color: #64748b;
        font-size: 0.88rem;
      }

      .toast__overflow-text {
        flex: 1;
        font-size: 0.76rem;
        font-weight: 600;
        color: #64748b;
      }

      .toast--overflow .toast__close {
        background: rgba(100, 116, 139, 0.1);
        color: #64748b;
      }

      /* ─── RESPONSIVE ─── */
      @media (max-width: 640px) {
        .toast-stack {
          bottom: 0.75rem;
          right: 0.75rem;
          left: 0.75rem;
          width: auto;
        }
      }
    `,
  ],
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
