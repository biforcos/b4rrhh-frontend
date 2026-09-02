export type GlobalUiMessageLevel = 'error' | 'warning' | 'success' | 'info';

export interface GlobalUiMessage {
  id: string;
  level: GlobalUiMessageLevel;
  text: string;
  sectionId?: string;
  sectionLabel?: string;
  sticky?: boolean;
  dismissAfterMs?: number;
  createdAt: Date;
}

export interface GlobalMessageSummary {
  total: number;
  errorCount: number;
  warningCount: number;
  successCount: number;
  infoCount: number;
  dominantLevel: GlobalUiMessageLevel | null;
}
