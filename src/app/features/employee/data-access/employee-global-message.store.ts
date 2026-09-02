import { Injectable, computed, effect, signal, untracked } from '@angular/core';

import { GlobalMessageSummary, GlobalUiMessage } from '../models/global-ui-message.model';

type GlobalUiMessageInput = Omit<GlobalUiMessage, 'createdAt'>;

@Injectable({
  providedIn: 'root',
})
export class GlobalMessageService {
  private readonly sourceMessagesState = signal<Record<string, ReadonlyArray<GlobalUiMessage>>>({});
  private readonly transientMessagesState = signal<ReadonlyArray<GlobalUiMessage>>([]);
  private readonly expandedState = signal(false);

  private readonly transientTimeouts = new Map<string, number>();
  private dismissedBlockingSignature = '';

  readonly messages = computed(() => {
    const sourceMessages = Object.values(this.sourceMessagesState()).flat();
    return [...sourceMessages, ...this.transientMessagesState()].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
  });

  readonly summary = computed<GlobalMessageSummary>(() => {
    const messages = this.messages();
    const errorCount = messages.filter((message) => message.level === 'error').length;
    const warningCount = messages.filter((message) => message.level === 'warning').length;
    const successCount = messages.filter((message) => message.level === 'success').length;
    const infoCount = messages.filter((message) => message.level === 'info').length;

    return {
      total: messages.length,
      errorCount,
      warningCount,
      successCount,
      infoCount,
      dominantLevel:
        errorCount > 0
          ? 'error'
          : warningCount > 0
            ? 'warning'
            : successCount > 0
              ? 'success'
              : infoCount > 0
                ? 'info'
                : null,
    };
  });

  readonly expanded = this.expandedState.asReadonly();

  constructor() {
    effect(() => {
      const blockingSignature = this.buildBlockingSignature(this.messages());

      if (!blockingSignature) {
        this.dismissedBlockingSignature = '';
        this.expandedState.set(false);
        return;
      }

      if (blockingSignature !== this.dismissedBlockingSignature) {
        this.expandedState.set(true);
      }
    });
  }

  setSourceMessages(sourceKey: string, messages: ReadonlyArray<GlobalUiMessageInput>): void {
    const existingMessages = untracked(() => this.sourceMessagesState()[sourceKey] ?? []);
    const existingCreatedAtById = new Map(
      existingMessages.map((message) => [message.id, message.createdAt]),
    );
    const now = Date.now();

    const normalizedMessages = messages.map((message, index) => ({
      ...message,
      createdAt: existingCreatedAtById.get(message.id) ?? new Date(now + index),
    }));

    this.sourceMessagesState.update((current) => ({
      ...current,
      [sourceKey]: normalizedMessages,
    }));
  }

  clearSourceMessages(sourceKey: string): void {
    this.sourceMessagesState.update((current) => {
      if (!(sourceKey in current)) {
        return current;
      }

      const { [sourceKey]: _removed, ...rest } = current;
      return rest;
    });
  }

  publishTransientMessage(message: GlobalUiMessageInput, autoHideMs = 5000): void {
    const normalizedMessage: GlobalUiMessage = {
      ...message,
      dismissAfterMs: autoHideMs,
      createdAt: new Date(),
    };

    this.transientMessagesState.update((current) => [
      normalizedMessage,
      ...current.filter((item) => item.id !== normalizedMessage.id),
    ]);

    const existingTimeout = this.transientTimeouts.get(normalizedMessage.id);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(() => {
      this.removeTransientMessage(normalizedMessage.id);
    }, autoHideMs);

    this.transientTimeouts.set(normalizedMessage.id, timeoutId);
  }

  dismissTransientMessages(): void {
    this.transientMessagesState.set([]);
    this.transientTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.transientTimeouts.clear();
  }

  success(
    text: string,
    options: { id: string; sectionId?: string; sectionLabel?: string; autoHideMs?: number },
  ): void {
    this.publishTransientMessage(
      {
        id: options.id,
        level: 'success',
        text,
        sectionId: options.sectionId,
        sectionLabel: options.sectionLabel,
      },
      options.autoHideMs,
    );
  }

  info(
    text: string,
    options: { id: string; sectionId?: string; sectionLabel?: string; autoHideMs?: number },
  ): void {
    this.publishTransientMessage(
      {
        id: options.id,
        level: 'info',
        text,
        sectionId: options.sectionId,
        sectionLabel: options.sectionLabel,
      },
      options.autoHideMs,
    );
  }

  expand(): void {
    this.expandedState.set(true);
    this.dismissedBlockingSignature = '';
  }

  collapse(): void {
    this.expandedState.set(false);
    this.dismissedBlockingSignature = this.buildBlockingSignature(this.messages());
  }

  toggleExpanded(): void {
    if (this.expandedState()) {
      this.collapse();
      return;
    }

    this.expand();
  }

  reset(): void {
    this.sourceMessagesState.set({});
    this.transientMessagesState.set([]);
    this.expandedState.set(false);
    this.dismissedBlockingSignature = '';
    this.transientTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    this.transientTimeouts.clear();
  }

  private removeTransientMessage(id: string): void {
    this.transientMessagesState.update((current) => current.filter((message) => message.id !== id));
    const timeoutId = this.transientTimeouts.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      this.transientTimeouts.delete(id);
    }
  }

  private buildBlockingSignature(messages: ReadonlyArray<GlobalUiMessage>): string {
    return messages
      .filter((message) => message.level === 'error' || message.level === 'warning')
      .map((message) => `${message.level}:${message.id}`)
      .sort()
      .join('|');
  }
}

export { GlobalMessageService as EmployeeGlobalMessageStore };
