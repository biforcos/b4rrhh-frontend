import {
  formatLongDisplayDate,
  formatLongDisplayDateRange,
} from '../../../../shared/utils/local-date.util';

/**
 * El plan y el conflicto de una serie temporal, con la forma que comparten las verticales de
 * tipo A (ADR-057). Los tipos son estructurales a propósito: cada vertical trae el suyo
 * —`EmployeeContractPlanModel`, `EmployeeAddressPlanModel`, …— y encaja aquí sin que ninguna
 * dependa de la otra.
 */
export interface TimelinePeriod {
  startDate: string;
  endDate: string | null;
}

export interface TimelinePlanAdjustment {
  before: TimelinePeriod;
  after: TimelinePeriod;
}

export type TimelinePlanOperation = 'ADD' | 'REMOVE' | 'CORRECT';

export type TimelinePlanRejection =
  | 'OUTSIDE_PRESENCE'
  | 'OVERLAP'
  | 'GAP_NOT_ALLOWED'
  | 'IS_A_CORRECTION';

export interface TimelinePlan {
  operation: TimelinePlanOperation;
  accepted: boolean;
  rejection: TimelinePlanRejection | null;
  correctedOccurrence: TimelinePeriod | null;
  adjustedOccurrence: TimelinePlanAdjustment | null;
  overlaps: ReadonlyArray<TimelinePeriod>;
  gaps: ReadonlyArray<TimelinePeriod>;
  stretchCandidates: ReadonlyArray<TimelinePeriod>;
}

export interface TimelineConflict {
  overlaps: ReadonlyArray<TimelinePeriod>;
  gaps: ReadonlyArray<TimelinePeriod>;
  stretchCandidates: ReadonlyArray<TimelinePeriod>;
  correctedOccurrence: TimelinePeriod | null;
}

/**
 * Cómo se llama en castellano lo que la serie guarda, y con qué códigos lo rechaza el backend.
 * Las frases se escriben enteras —no se compone el artículo— porque el género cambia entre
 * verticales: «otro contrato», «otra clasificación laboral».
 */
export interface TimelinePlanVocabulary {
  /** «El contrato» / «La clasificación laboral»: al empezar una frase. */
  subject: string;
  /** «El contrato anterior» / «La clasificación anterior». */
  previousSubject: string;
  /** «el contrato» / «la clasificación laboral»: dentro de una frase. */
  object: string;
  /** «otro contrato» / «otra clasificación laboral». */
  another: string;
  /** «ningún otro contrato» / «ninguna otra clasificación laboral». */
  noOther: string;
  /** «un contrato» / «una clasificación laboral». */
  indefinite: string;
  overlapErrorCode: string;
  gapErrorCode: string;
  isACorrectionErrorCode: string;
  /**
   * Por qué un hueco que el backend acepta es legal aquí. Solo lo llevan las series de cobertura
   * opcional —centro de coste (`backend#54`), y los tipos de dirección que no son el domicilio
   * (ADR-057, decisión 1)—: en una obligatoria el hueco es un rechazo y este texto no se usa.
   */
  acceptedGapExplanation?: string;
}

export const CONTRACT_PLAN_VOCABULARY: TimelinePlanVocabulary = {
  subject: 'El contrato',
  previousSubject: 'El contrato anterior',
  object: 'el contrato',
  another: 'otro contrato',
  noOther: 'ningún otro contrato',
  indefinite: 'un contrato',
  overlapErrorCode: 'CONTRACT_OVERLAP',
  gapErrorCode: 'CONTRACT_COVERAGE_GAP',
  isACorrectionErrorCode: 'CONTRACT_IS_A_CORRECTION',
};

export const LABOR_CLASSIFICATION_PLAN_VOCABULARY: TimelinePlanVocabulary = {
  subject: 'La clasificación laboral',
  previousSubject: 'La clasificación anterior',
  object: 'la clasificación laboral',
  another: 'otra clasificación laboral',
  noOther: 'ninguna otra clasificación laboral',
  indefinite: 'una clasificación laboral',
  overlapErrorCode: 'LABOR_CLASSIFICATION_OVERLAP',
  gapErrorCode: 'LABOR_CLASSIFICATION_INCOMPLETE_COVERAGE',
  isACorrectionErrorCode: 'LABOR_CLASSIFICATION_IS_A_CORRECTION',
};

/**
 * La serie de direcciones es una por tipo, y el plan solo habla de la del tipo que se toca: por
 * eso «otra dirección» lleva siempre «del mismo tipo». El domicilio es de cobertura obligatoria
 * y los demás tipos opcional (ADR-057, decisión 1); esa diferencia no se decide aquí, la trae el
 * plan: en el domicilio el hueco vuelve como rechazo y en los demás como consecuencia aceptada.
 */
export const ADDRESS_PLAN_VOCABULARY: TimelinePlanVocabulary = {
  subject: 'La dirección',
  previousSubject: 'La dirección anterior',
  object: 'la dirección',
  another: 'otra dirección del mismo tipo',
  noOther: 'ninguna otra dirección del mismo tipo',
  indefinite: 'una dirección de ese tipo',
  overlapErrorCode: 'ADDRESS_OVERLAP',
  gapErrorCode: 'ADDRESS_COVERAGE_GAP',
  isACorrectionErrorCode: 'ADDRESS_IS_A_CORRECTION',
  acceptedGapExplanation:
    'este tipo de dirección no es obligatorio, así que el hueco es válido y se queda como está.',
};

export const WORK_CENTER_PLAN_VOCABULARY: TimelinePlanVocabulary = {
  subject: 'La asignación de centro de trabajo',
  previousSubject: 'La asignación anterior',
  object: 'la asignación',
  another: 'otra asignación',
  noOther: 'ninguna otra asignación',
  indefinite: 'una asignación',
  overlapErrorCode: 'WORK_CENTER_OVERLAP',
  gapErrorCode: 'WORK_CENTER_COVERAGE_GAP',
  isACorrectionErrorCode: 'WORK_CENTER_IS_A_CORRECTION',
};

/**
 * La única serie del producto con cobertura opcional (`backend#54`): aquí un hueco no impide
 * nada, y el aviso tiene que decirlo con esas palabras. No se copia el de las obligatorias, que
 * dice lo contrario.
 */
export const COST_CENTER_PLAN_VOCABULARY: TimelinePlanVocabulary = {
  subject: 'La distribución',
  previousSubject: 'La distribución anterior',
  object: 'la distribución',
  another: 'otra distribución',
  noOther: 'ninguna otra distribución',
  indefinite: 'una distribución',
  overlapErrorCode: 'COST_CENTER_OVERLAP',
  gapErrorCode: 'COST_CENTER_COVERAGE_GAP',
  isACorrectionErrorCode: 'COST_CENTER_IS_A_CORRECTION',
  acceptedGapExplanation:
    'la cobertura de centro de coste es opcional, así que el hueco es válido y se queda como está.',
};

export type TimelinePlanTone = 'info' | 'warning' | 'error';

/** El plan contado en castellano y con fechas: lo que la pantalla enseña antes de confirmar. */
export interface TimelinePlanNotice {
  tone: TimelinePlanTone;
  lines: ReadonlyArray<string>;
}

/**
 * Redacta lo que un plan haría (ADR-057): qué ocurrencia se cerrará o reabrirá y hasta cuándo, o
 * por qué no se puede aplicar —el hueco o el solape con sus fechas y las vecinas que se podrían
 * alargar—. No decide nada: el plan viene del backend.
 */
export function describeTimelinePlan(
  plan: TimelinePlan,
  vocabulary: TimelinePlanVocabulary,
): TimelinePlanNotice {
  if (!plan.accepted) {
    return { tone: 'error', lines: describeRejection(plan, vocabulary) };
  }

  const lines = [
    ...(plan.adjustedOccurrence
      ? [describeAdjustment(plan.operation, plan.adjustedOccurrence, vocabulary)]
      : []),
    ...describeAcceptedGaps(plan.gaps, vocabulary),
  ];

  if (lines.length === 0) {
    return { tone: 'info', lines: [`No cambia ${vocabulary.noOther}.`] };
  }

  return { tone: 'warning', lines };
}

/**
 * El mismo relato para un rechazo que llega al aplicar (el `409`), cuando trae fechas. Null si el
 * código no es de invariante o el error no dice dónde: la pantalla cae al texto genérico.
 */
export function describeTimelineConflict(
  errorCode: string | null,
  conflict: TimelineConflict | null,
  vocabulary: TimelinePlanVocabulary,
): string | null {
  if (!conflict) {
    return null;
  }

  if (errorCode === vocabulary.gapErrorCode && conflict.gaps.length > 0) {
    return [
      ...describeGaps(conflict.gaps),
      ...describeStretchCandidates(conflict.stretchCandidates, vocabulary),
    ].join(' ');
  }

  if (errorCode === vocabulary.overlapErrorCode && conflict.overlaps.length > 0) {
    return describeOverlaps(conflict.overlaps, vocabulary).join(' ');
  }

  if (errorCode === vocabulary.isACorrectionErrorCode && conflict.correctedOccurrence) {
    return describeIsACorrection(conflict.correctedOccurrence, vocabulary);
  }

  return null;
}

/**
 * El camino que se ofrece tras un `IS_A_CORRECTION`: corregir la ocurrencia que el backend
 * nombra, sin volver a teclear lo que ya está escrito.
 */
export function describeCorrectionSwitchAction(
  correctedOccurrence: TimelinePeriod,
  vocabulary: TimelinePlanVocabulary,
): string {
  return `Corregir ${vocabulary.object} desde el ${formatLongDisplayDate(correctedOccurrence.startDate)}`;
}

function describeAdjustment(
  operation: TimelinePlanOperation,
  adjustment: TimelinePlanAdjustment,
  vocabulary: TimelinePlanVocabulary,
): string {
  const since = formatLongDisplayDate(adjustment.before.startDate);
  const until = adjustment.after.endDate;

  if (operation === 'ADD') {
    return until
      ? `${vocabulary.subject} en vigor desde el ${since} se cerrará el ${formatLongDisplayDate(until)}.`
      : `${vocabulary.subject} en vigor desde el ${since} quedará en vigor.`;
  }

  if (operation === 'REMOVE') {
    return until
      ? `${vocabulary.previousSubject}, desde el ${since}, se reabrirá hasta el ${formatLongDisplayDate(until)}.`
      : `${vocabulary.previousSubject}, desde el ${since}, se reabrirá y quedará en vigor.`;
  }

  return until
    ? `${vocabulary.subject} desde el ${since} pasará a terminar el ${formatLongDisplayDate(until)}.`
    : `${vocabulary.subject} desde el ${since} pasará a quedar en vigor.`;
}

function describeRejection(
  plan: TimelinePlan,
  vocabulary: TimelinePlanVocabulary,
): ReadonlyArray<string> {
  switch (plan.rejection) {
    case 'OUTSIDE_PRESENCE':
      return [`${vocabulary.subject} quedaría fuera de la presencia del empleado.`];
    case 'OVERLAP':
      return describeOverlaps(plan.overlaps, vocabulary);
    case 'GAP_NOT_ALLOWED':
      return [
        ...describeGaps(plan.gaps),
        ...describeStretchCandidates(plan.stretchCandidates, vocabulary),
      ];
    case 'IS_A_CORRECTION':
      return plan.correctedOccurrence
        ? [describeIsACorrection(plan.correctedOccurrence, vocabulary)]
        : [`Ya hay ${vocabulary.indefinite} que empieza ese día: sería una corrección suya.`];
    default:
      return ['El cambio no se puede aplicar.'];
  }
}

function describeIsACorrection(
  correctedOccurrence: TimelinePeriod,
  vocabulary: TimelinePlanVocabulary,
): string {
  const period = formatLongDisplayDateRange(
    correctedOccurrence.startDate,
    correctedOccurrence.endDate,
  );
  return `Ya hay ${vocabulary.indefinite} ${period}: esto no es un alta, sino una corrección suya.`;
}

/**
 * Un hueco en un plan aceptado no impide nada: la serie es de cobertura opcional y el hueco se
 * queda. Se cuenta en futuro —«quedará»— y con el motivo, porque es lo contrario de lo que dice
 * el mismo hueco en una serie obligatoria, donde es el rechazo.
 */
function describeAcceptedGaps(
  gaps: ReadonlyArray<TimelinePeriod>,
  vocabulary: TimelinePlanVocabulary,
): ReadonlyArray<string> {
  return gaps.map((gap) => {
    const period = formatLongDisplayDateRange(gap.startDate, gap.endDate);
    return vocabulary.acceptedGapExplanation
      ? `Quedará un hueco ${period}: ${vocabulary.acceptedGapExplanation}`
      : `Quedará un hueco ${period}.`;
  });
}

function describeGaps(gaps: ReadonlyArray<TimelinePeriod>): ReadonlyArray<string> {
  if (gaps.length === 0) {
    return ['Quedaría un hueco en la presencia del empleado.'];
  }

  return gaps.map(
    (gap) => `Quedaría un hueco ${formatLongDisplayDateRange(gap.startDate, gap.endDate)}.`,
  );
}

function describeOverlaps(
  overlaps: ReadonlyArray<TimelinePeriod>,
  vocabulary: TimelinePlanVocabulary,
): ReadonlyArray<string> {
  if (overlaps.length === 0) {
    return [`Se solaparía con ${vocabulary.another}.`];
  }

  return overlaps.map(
    (overlap) =>
      `Se solaparía con ${vocabulary.another} ${formatLongDisplayDateRange(overlap.startDate, overlap.endDate)}.`,
  );
}

/** Estirar una vecina lo hace el usuario (ADR-057 §3): aquí solo se dice cuál. */
function describeStretchCandidates(
  candidates: ReadonlyArray<TimelinePeriod>,
  vocabulary: TimelinePlanVocabulary,
): ReadonlyArray<string> {
  return candidates.map(
    (candidate) =>
      `Antes se puede alargar ${vocabulary.object} ${formatLongDisplayDateRange(candidate.startDate, candidate.endDate)}.`,
  );
}
