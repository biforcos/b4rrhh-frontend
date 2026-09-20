export interface PayrollConceptModel {
  lineNumber: number;
  conceptCode: string;
  /**
   * El identificador del concepto en el motor (`b4rrhh/backend#109`).
   *
   * Es lo que las reglas y el grafo referencian, y **no es lo que se enseña**. Hasta el
   * `backend#109` era lo único que la línea traía, ocupando el hueco de `conceptLabel`: por eso
   * el folio decía `SALARIO_BASE` donde va un nombre.
   */
  conceptMnemonic: string;
  /**
   * Cómo se llamaba el concepto **cuando se calculó esta línea** (`b4rrhh/backend#109`).
   *
   * Viene congelado y no se resuelve al leer: dos recibos del mismo concepto pueden traer
   * literales distintos si alguien renombró el catálogo entre medias, y eso es correcto — cada
   * uno dice lo que decía cuando se produjo.
   *
   * Si el concepto no tenía nombre, el backend manda aquí su mnemónico. Un literal que parece un
   * identificador significa que falta el nombre, no que el campo esté mal.
   */
  conceptLabel: string;
  amount: number | null;
  quantity: number | null;
  rate: number | null;
  conceptNatureCode: string;
  originPeriodCode: string | null;
  displayOrder: number;
  /**
   * El bloque del modelo oficial en el que se imprimió esta línea (`b4rrhh/backend#109`).
   *
   * **Es lo que decide en qué parte del folio sale, y no la naturaleza.** Viene declarado en el
   * catálogo y congelado con la línea; la `V138` lo declaró precisamente para que nadie tuviera
   * que deducirlo. Deducirlo de `conceptNatureCode` —o del rango del código— es el defecto que
   * este paso retira: la aportación empresarial se calculaba, llegaba aquí y un `if` la tiraba.
   *
   * Nulo cuando la naturaleza del concepto no tenía sección declarada. **Eso se enseña**, no se
   * coloca por defecto en un bloque cualquiera: una línea a la que nadie le declaró sitio es
   * justo lo que hay que notar.
   */
  payslipSectionCode: string | null;
  /**
   * De cuántos pasos del motor viene esta línea (`b4rrhh/backend#103`).
   *
   * Uno casi siempre. **Más de uno cuando el folio ha fundido varios tramos** del mismo concepto al
   * mismo precio, que pueden no ser contiguos: la línea es correcta y cuenta una historia falsa si
   * nada dice que es una suma.
   *
   * Una marca que saliera con `1` no marcaría nada, así que sólo se pinta cuando pasa de uno.
   */
  mergedStepCount: number;
}
