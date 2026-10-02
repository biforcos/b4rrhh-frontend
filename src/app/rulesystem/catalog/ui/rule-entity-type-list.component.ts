import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { catalogTexts } from '../catalog.texts';
import { RuleEntityTypeModel } from '../models/rule-entity-type.model';

interface RuleEntityTypeLevelGroup {
  level: number;
  title: string;
  items: ReadonlyArray<RuleEntityTypeModel>;
}

@Component({
  selector: 'app-rule-entity-type-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rule-entity-type-list.component.html',
  styleUrl: './rule-entity-type-list.component.scss',
})
export class RuleEntityTypeListComponent {
  readonly items = input<ReadonlyArray<RuleEntityTypeModel>>([]);
  readonly selectedCode = input<string | null>(null);
  readonly disabled = input(false);
  readonly selected = output<string>();

  /**
   * Por nivel, de Común a Nómina de empresa (frontend#127), y dentro de cada uno en el orden en
   * que los sirve el contrato. Un nivel sin tipos no sale.
   */
  protected readonly groups = computed<ReadonlyArray<RuleEntityTypeLevelGroup>>(() => {
    const byLevel = new Map<number, RuleEntityTypeModel[]>();
    for (const item of this.items()) {
      byLevel.set(item.level, [...(byLevel.get(item.level) ?? []), item]);
    }
    return [...byLevel.keys()]
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        title: catalogTexts.levelNames[level] ?? `${level}`,
        items: byLevel.get(level) ?? [],
      }));
  });

  protected select(code: string): void {
    this.selected.emit(code);
  }
}
