//
// Copyright 2023 DXOS.org
//

import { type UnsubscribeCallback } from '@dxos/async';

import { AbstractEchoObject } from './object';
import { type EchoObject, subscribe } from './types';

export type Selection = any[];

// TODO(dmaretskyi): Convert to class.
export interface SubscriptionHandle {
  update: (selection: Selection) => SubscriptionHandle;
  subscribed: boolean;
  unsubscribe: () => void;
  selected: Set<any>;
}

export type UpdateInfo = {
  // TODO(dmaretskyi): Include metadata about the update.
  updated: any[];
  added: any[];
  removed: any[];
};

/**
 * Subscribe to database updates.
 * Calls the callback when any object from the selection changes.
 * Calls the callback when the selection changes.
 * Always calls the callback on the first `selection.update` call.
 */
// TODO(burdon): Add filter?
// TODO(burdon): Immediately trigger callback.
// TODO(wittjosiah): Could signals effect be used instead?
export const createSubscription = (onUpdate: (info: UpdateInfo) => void): SubscriptionHandle => {
  let subscribed = true;
  let firstUpdate = true;
  const subscriptions = new Map<any, UnsubscribeCallback>();

  const handle = {
    update: (selection: Selection) => {
      const newSelected = new Set(selection.filter((item): item is EchoObject => item instanceof AbstractEchoObject));
      const removed = [...handle.selected].filter((item) => !newSelected.has(item));
      const added = [...newSelected].filter((item) => !handle.selected.has(item));
      handle.selected = newSelected;
      if (removed.length > 0 || added.length > 0 || firstUpdate) {
        firstUpdate = false;

        removed.forEach((obj) => {
          subscriptions.get(obj)?.();
          subscriptions.delete(obj);
        });

        added.forEach((obj) => {
          subscriptions.set(
            obj,
            obj[subscribe](() => {
              onUpdate({
                added: [],
                removed: [],
                updated: [obj],
              });
            }),
          );
        });

        onUpdate({
          added,
          removed,
          updated: [],
        });
      }

      return handle;
    },
    subscribed,
    selected: new Set<any>(),
    unsubscribe: () => {
      Array.from(subscriptions.values()).forEach((unsubscribe) => unsubscribe());
      subscriptions.clear();
      subscribed = false;
    },
  };

  return handle;
};
