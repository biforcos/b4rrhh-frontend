import { EmployeeBusinessKey } from './employee-business-key.model';

/**
 * El criterio de la cola: la pregunta que se le hizo al directorio, tal cual (frontend#27,
 * opción B). La cola no es una lista de gente sino esta pregunta más una posición.
 */
export interface EmployeeWorkQueueCriteria {
  q: string;
  status: string | null;
}

/**
 * La cola de trabajo (frontend#20): un cursor sobre la consulta del directorio, por el orden
 * estable del servidor. `index` es la posición (0-based) y `currentKey` quién debería estar en
 * ella; si al pedir el siguiente ya no está, la cola se ha movido bajo los pies y se avisa.
 */
export interface EmployeeWorkQueue {
  criteria: EmployeeWorkQueueCriteria;
  /** El ámbito (sistema de reglas) en que se abrió; al cambiar de ámbito la cola muere. */
  scope: string | null;
  index: number;
  total: number;
  currentKey: EmployeeBusinessKey;
}
