//
// Copyright 2020 DXOS.org
//

import { faker } from '@faker-js/faker';
import update from 'immutability-helper';

import { useStateRef } from '@dxos/gem-core';

import { createNode, createLink } from './data';
import { type TestNode } from './types';
import { type GraphData } from '../graph';

export type ObjectMutator<T> = [
  T, // Current value.
  (data: T) => void, // Set value.
  (mutation: any) => T, // Apply update mutation.
];

/**
 * Returns a state object and setter, with addition live getter and updater (for the current up-to-date reference).
 * https://reactjs.org/docs/hooks-faq.html#why-am-i-seeing-stale-props-or-state-inside-my-function
 */
export const useObjectMutator = <T>(initalValue: T): ObjectMutator<T> => {
  const [data, setData, dataRef] = useStateRef<T>(initalValue);

  return [
    // Get data state (snapshot).
    data,

    // Update data state.
    (data: T) => {
      setData(data);
    },

    // Updater.
    // https://github.com/kolodny/immutability-helper
    // NOTE: Use $apply to update variable (e.g., push to potentially null object).
    (mutation: any): T => {
      setData((current) => update<T>(current, mutation));
      return dataRef.current;
    },
  ];
};

/**
 * Test data set generator and mutator.
 */
export const useGraphGenerator = (options: { data?: GraphData<any> } = {}) => {
  const [data, setData, updateData] = useObjectMutator(options.data || { nodes: [], links: [] });

  let interval;

  const mutator = () => {
    const parent = data.nodes.length ? faker.helpers.arrayElement(data.nodes) : undefined;
    const node = createNode();

    updateData({
      nodes: {
        $push: [node],
      },
      links: Object.assign(
        {},
        parent && {
          $push: [createLink(parent as TestNode, node)],
        },
      ),
    });
  };

  const reset = (options = { count: 0 }) => {
    const { count = 0 } = options;
    setData({
      nodes: [],
      links: [],
    });

    for (let i = 0; i < count; i++) {
      mutator();
    }
  };

  const start = ({ delay = 250 } = {}) => {
    stop();
    interval = setInterval(mutator, delay);
    return stop;
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };

  return {
    data,
    mutator,
    reset,
    start,
    stop,
  };
};
