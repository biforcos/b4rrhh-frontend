import { B4IconName } from '../../../shared/ui/icon/icon-names';

/** Una entrada del menú: destino, rótulo e icono ya resueltos. */
export interface MenuEntry {
  readonly label: string;
  readonly icon: B4IconName;
  readonly link: string;
}

/** Un grupo del menú (ADR-054 §5): el código, el nombre y el orden vienen del modelo. */
export interface MenuGroup {
  readonly code: string;
  readonly name: string;
  readonly displayOrder: number;
  readonly entries: ReadonlyArray<MenuEntry>;
}
