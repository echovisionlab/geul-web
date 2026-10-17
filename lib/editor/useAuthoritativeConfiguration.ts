'use client';

import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  getEditorWriteToken,
  hasAdoptedConfigurationOrigin,
  registerConfigurationOriginWrite,
} from './editor-write-origin';

type Patch<T> = Partial<T>;
export interface ConfigurationRead {
  scope: symbol;
  generation: number;
  writeGeneration: number;
}
export interface ConfigurationWrite<T> {
  origin: string;
  acknowledge: (canonical: Patch<T>, options?: { full?: boolean; authoritative?: boolean }) => boolean;
  fail: () => void;
  rebase: () => void;
}

/** Owns field intent, write completion and read ordering independently from queue timing. */
export class AuthoritativeConfiguration<T extends object> {
  active = true;
  isActive = (): boolean => this.active;
  readonly scope = Symbol('configuration-scope');
  private canonical: T;
  private visible: T;
  private snapshot: { source: T; value: T } | null = null;
  private intents = new Map<keyof T, { sequence: number; value: unknown }>();
  private pending = new Map<keyof T, Set<symbol>>();
  private sequence = 0;
  private readGeneration = 0;
  private writeGeneration = 0;
  private observationGeneration = 0;
  private latestAcknowledgedOrder = 0;
  private acknowledgedVersions = new Map<keyof T, number>();

  constructor(
    readonly document: string,
    initial: T,
    private changed: (patch: Patch<T>) => void = () => {},
  ) {
    this.canonical = initial;
    this.visible = initial;
  }

  getCanonical = (): T => this.canonical;
  getConfiguration = (): T => {
    if (this.snapshot?.source === this.visible) {
      return this.snapshot.value;
    }
    const next = { ...this.visible };
    for (const [field, intent] of this.intents) {
      next[field] = intent.value as T[keyof T];
    }
    // Consumers synchronize this projection into editor state. Unchanged settings
    // must retain their identity rather than retriggering that synchronization.
    this.snapshot = { source: this.visible, value: next };
    return next;
  };
  isDraft = (field: keyof T): boolean => this.intents.has(field);
  hasPending = (): boolean => Boolean(this.intents.size || this.pending.size);

  edit = (patch: Patch<T>): void => {
    const sequence = ++this.sequence;
    for (const field of Object.keys(patch) as Array<keyof T>) {
      this.intents.set(field, { sequence, value: patch[field] });
    }
    this.visible = { ...this.visible, ...patch };
    this.changed(patch);
  };
  setDraft = <K extends keyof T>(field: K, value: T[K]): void => this.edit({ [field]: value } as unknown as Patch<T>);

  discard = (fields: readonly (keyof T)[]): void => {
    const adopted: Patch<T> = {};
    for (const field of fields) {
      this.intents.delete(field);
      if (!this.pending.get(field)?.size) {
        adopted[field] = this.canonical[field];
      }
    }
    this.visible = { ...this.visible, ...adopted };
    this.changed(adopted);
  };

  beginRead = (): ConfigurationRead => ({
    scope: this.scope,
    generation: ++this.readGeneration,
    writeGeneration: this.writeGeneration,
  });

  adoptRead = (read: ConfigurationRead, snapshot: Patch<T>): boolean => {
    if (
      read.scope !== this.scope ||
      read.generation !== this.readGeneration ||
      read.writeGeneration !== this.writeGeneration
    ) {
      return false;
    }
    this.canonical = { ...this.canonical, ...snapshot };
    this.observationGeneration += 1;
    const adopted: Patch<T> = {};
    for (const field of Object.keys(snapshot) as Array<keyof T>) {
      if (this.pending.get(field)?.size || this.intents.has(field)) {
        continue;
      }
      adopted[field] = snapshot[field];
    }
    this.visible = { ...this.visible, ...adopted };
    this.changed(adopted);
    return true;
  };

  beginWrite = (patchOrFields: Patch<T> | readonly (keyof T)[]): ConfigurationWrite<T> => {
    const fields = Array.isArray(patchOrFields)
      ? ([...patchOrFields] as Array<keyof T>)
      : (Object.keys(patchOrFields) as Array<keyof T>);
    if (!Array.isArray(patchOrFields)) {
      // Recovery queues can start writes without replaying their original UI handler.
      const missing: Patch<T> = {};
      for (const field of fields) {
        if (!this.intents.has(field)) {
          missing[field] = (patchOrFields as Patch<T>)[field];
        }
      }
      if (Object.keys(missing).length) {
        this.edit(missing);
      }
    }
    const token = Symbol('configuration-write');
    const versions = new Map(
      fields.map((field) => {
        const intent = this.intents.get(field);
        const matches =
          Array.isArray(patchOrFields) || sameConfigurationValue(intent?.value, (patchOrFields as Patch<T>)[field]);
        return [field, matches ? (intent?.sequence ?? 0) : -1];
      }),
    );
    let observationGeneration = this.observationGeneration;
    const order = ++this.writeGeneration;
    for (const field of fields) {
      const entries = this.pending.get(field) ?? new Set<symbol>();
      entries.add(token);
      this.pending.set(field, entries);
    }
    const completeOrigin = registerConfigurationOriginWrite(this.document, this.scope);
    let finished = false;
    const finish = () => {
      if (finished) {
        return false;
      }
      finished = true;
      // A read begun during the request can still contain its pre-write state.
      this.writeGeneration += 1;
      for (const field of fields) {
        const entries = this.pending.get(field);
        entries?.delete(token);
        if (!entries?.size) {
          this.pending.delete(field);
        }
      }
      return true;
    };
    return {
      origin: getEditorWriteToken(),
      rebase: () => {
        observationGeneration = this.observationGeneration;
      },
      acknowledge: (snapshot, options) => {
        if (!finish()) {
          return false;
        }
        const safeFull =
          observationGeneration === this.observationGeneration &&
          (!options?.full || this.latestAcknowledgedOrder <= order);
        this.latestAcknowledgedOrder = Math.max(this.latestAcknowledgedOrder, order);
        const adopted: Patch<T> = {};
        for (const field of fields) {
          const version = versions.get(field) ?? 0;
          if (this.intents.get(field)?.sequence === version) {
            this.intents.delete(field);
          }
          if ((this.acknowledgedVersions.get(field) ?? -1) > order) {
            if (!this.intents.has(field) && !this.pending.get(field)?.size) {
              adopted[field] = this.canonical[field];
            }
            continue;
          }
          this.acknowledgedVersions.set(field, order);
          if (safeFull && Object.hasOwn(snapshot, field)) {
            this.canonical = { ...this.canonical, [field]: snapshot[field] };
          }
          if (!this.intents.has(field) && !this.pending.get(field)?.size) {
            adopted[field] = this.canonical[field];
          }
        }
        if (options?.full && safeFull) {
          for (const field of Object.keys(snapshot) as Array<keyof T>) {
            if (fields.includes(field) || (this.acknowledgedVersions.get(field) ?? -1) > order) {
              continue;
            }
            this.acknowledgedVersions.set(field, order);
            this.canonical = { ...this.canonical, [field]: snapshot[field] };
            if (!this.intents.has(field) && !this.pending.get(field)?.size) {
              adopted[field] = snapshot[field];
            }
          }
        }
        this.visible = { ...this.visible, ...adopted };
        completeOrigin(
          options?.authoritative !== false && safeFull && fields.every((field) => Object.hasOwn(snapshot, field)),
        );
        this.changed(adopted);
        return safeFull;
      },
      fail: () => {
        if (finish()) {
          completeOrigin(false);
          const adopted: Patch<T> = {};
          for (const field of fields) {
            if (!this.pending.get(field)?.size && !this.intents.has(field)) {
              adopted[field] = this.canonical[field];
            }
          }
          this.visible = { ...this.visible, ...adopted };
          this.changed(adopted);
        }
      },
    };
  };

  captureOwnChange =
    (origin?: string): (() => boolean) =>
    () =>
      !this.hasPending() && hasAdoptedConfigurationOrigin(this.document, this.scope, origin);
}

export function useAuthoritativeConfiguration<T extends object>({
  document,
  initialConfiguration,
  onAdopt,
}: {
  document: string;
  initialConfiguration: T;
  onAdopt?: (patch: Patch<T>) => void;
}) {
  const [, rerender] = useReducer((version: number) => version + 1, 0);
  const callback = useRef(onAdopt);
  callback.current = onAdopt;
  const active = useRef<AuthoritativeConfiguration<T> | null>(null);
  const controller = useMemo(() => {
    const next = new AuthoritativeConfiguration(document, initialConfiguration, (patch) => {
      if (active.current === next && next.active) {
        callback.current?.(patch);
        rerender();
      }
    });
    return next;
    // Same entity refreshed props never erase its pending intents or canonical ordering.
  }, [document]);
  if (active.current && active.current !== controller) {
    active.current.active = false;
  }
  active.current = controller;
  controller.active = true;
  useEffect(() => {
    controller.active = true;
    return () => {
      controller.active = false;
    };
  }, [controller]);
  return controller;
}

export function sameConfigurationValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameConfigurationValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}
