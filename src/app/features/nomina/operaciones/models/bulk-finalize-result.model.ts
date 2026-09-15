/**
 * La cuenta de un cierre masivo (`b4rrhh/backend#102`).
 *
 * Los contadores son el entregable y no el adorno: `NOT_VALID → DEFINITIVE` no existe, así que un
 * cierre de 873 recibos cerrará los calculados y los validados y dejará fuera el resto. Un contador
 * que separa **no apta por su estado** de todo lo demás enseña la máquina de estados en vez de
 * explicarla, y por eso nada cae en un «fallidas» genérico: no falla nada.
 */
export interface BulkFinalizeResult {
  totalCandidates: number;
  totalFound: number;
  totalFinalized: number;
  totalSkippedAlreadyDefinitive: number;
  totalSkippedNotEligibleByStatus: number;
  totalSkippedNotFound: number;
}
