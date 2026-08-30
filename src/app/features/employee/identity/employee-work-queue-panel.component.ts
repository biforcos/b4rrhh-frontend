import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { B4IconComponent } from '../../../shared/ui/icon/b4-icon.component';
import {
  EmployeeWorkQueueNotice,
  EmployeeWorkQueueStore,
} from '../data-access/employee-work-queue.store';
import { employeeTexts } from '../employee.texts';
import { EmployeeWorkQueueCriteria } from '../models/employee-work-queue.model';

/**
 * La cola en el raíl (frontend#20, ADR-050 §3): «7 de 103 · «Sanchez» · de baja», anterior y
 * siguiente, y la vuelta a la lista. Mismo hueco que el índice, cero ancho sacrificado: solo
 * aparece cuando se llegó desde una cola, y se pliega con el raíl.
 *
 * No navega: dice qué quiere el usuario y la ficha decide a dónde ir, porque es la ficha la que
 * sabe en qué sección está y quiere conservarla.
 */
@Component({
  selector: 'app-employee-work-queue-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [B4IconComponent],
  templateUrl: './employee-work-queue-panel.component.html',
  styleUrl: './employee-work-queue-panel.component.scss',
})
export class EmployeeWorkQueuePanelComponent {
  private readonly queueStore = inject(EmployeeWorkQueueStore);

  /** Mientras la ficha está cambiando de empleado, los botones se apagan. */
  readonly busy = input(false);

  readonly previousRequested = output<void>();
  readonly nextRequested = output<void>();
  readonly backToListRequested = output<void>();
  readonly leaveRequested = output<void>();

  protected readonly texts = employeeTexts;
  protected readonly position = this.queueStore.position;
  protected readonly total = this.queueStore.total;
  protected readonly hasPrevious = this.queueStore.hasPrevious;
  protected readonly hasNext = this.queueStore.hasNext;
  protected readonly loading = this.queueStore.loading;
  protected readonly disabled = computed(() => this.busy() || this.loading());

  /** El criterio, tal como el usuario recuerda haberlo pedido: el texto entre comillas y el estado. */
  protected readonly criteriaLabel = computed(() => {
    const queue = this.queueStore.queue();
    if (!queue) return '';
    return describeCriteria(queue.criteria, this.texts);
  });

  protected readonly noticeMessage = computed(() => {
    const notice = this.queueStore.notice();
    return notice ? noticeText(notice, this.texts) : null;
  });

  protected readonly atEnd = computed(() => this.queueStore.active() && !this.hasNext());
}

export function describeCriteria(
  criteria: EmployeeWorkQueueCriteria,
  texts: typeof employeeTexts,
): string {
  const parts: string[] = [];
  if (criteria.q.trim().length > 0) {
    parts.push(`«${criteria.q.trim()}»`);
  }
  if (criteria.status === 'ACTIVE') {
    parts.push(texts.workQueueCriteriaActive);
  } else if (criteria.status === 'TERMINATED') {
    parts.push(texts.workQueueCriteriaTerminated);
  }
  return parts.length > 0 ? parts.join(' · ') : texts.workQueueCriteriaAll;
}

function noticeText(notice: EmployeeWorkQueueNotice, texts: typeof employeeTexts): string {
  switch (notice) {
    case 'last':
      return texts.workQueueEndMessage;
    case 'first':
      return texts.workQueueStartMessage;
    case 'moved':
      return texts.workQueueMovedMessage;
    case 'empty':
      return texts.workQueueEmptyMessage;
    case 'request-failed':
      return texts.workQueueFailedMessage;
  }
}
