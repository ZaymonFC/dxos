//
// Copyright 2023 DXOS.org
//

import { Circle, type IconProps, Lightning, LightningSlash } from '@phosphor-icons/react';
import React, { type FC, useEffect, useRef, useState } from 'react';

import { getActiveSpace } from '@braneframe/plugin-space';
import { parseGraphPlugin, parseLayoutPlugin, useResolvePlugin } from '@dxos/app-framework';
import { TimeoutError } from '@dxos/async';
import { ConnectionState } from '@dxos/protocols/proto/dxos/client/services';
import { useNetworkStatus } from '@dxos/react-client/mesh';
import { getSize, mx } from '@dxos/react-ui-theme';

const styles = {
  success: 'text-sky-300 dark:text-green-700',
  warning: 'text-orange-300 dark:text-orange-600',
  error: 'text-red-300 dark:text-red-600',
};

// TODO(burdon): Move out of debug plugin.
// TODO(burdon): Make pluggable (move indicators to relevant plugins).
// TODO(burdon): Vault heartbeat indicator (global scope)?

/**
 * Ensure light doesn't flicker immediately after start.
 */
// TODO(burdon): Move to @dxos/async (debounce?)
const timer = (cb: (err?: Error) => void, options?: { min?: number; max?: number }) => {
  const min = options?.min ?? 500;
  let start: number;
  let pending: NodeJS.Timeout;
  let timeout: NodeJS.Timeout;
  return {
    start: () => {
      start = Date.now();
      clearTimeout(pending);
      if (options?.max) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          cb(new TimeoutError(options.max));
        }, options.max);
      }
    },
    stop: () => {
      clearTimeout(timeout);
      const delta = Date.now() - start;
      if (delta < min) {
        pending = setTimeout(() => {
          cb();
        }, min - delta);
      }
    },
  };
};

/**
 * Global error handler.
 */
// TODO(burdon): Integrate with Sentry?
const ErrorIndicator: FC<IconProps> = (props) => {
  const [, forceUpdate] = useState({});
  const error = useRef<Error>();
  const debug = true; // TODO(burdon): From config?
  useEffect(() => {
    const errorListener = (event: any) => {
      // event.preventDefault();
      // TODO(burdon): Handler is called twice.
      if (error.current !== event.error) {
        console.error(event);
        error.current = event.error;
        if (debug) {
          console.error(event.error);
        }
        forceUpdate({});
      }
    };

    // TODO(burdon): Register globally?
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event
    window.addEventListener('error', errorListener);

    // https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event
    window.addEventListener('unhandledrejection', errorListener);

    return () => {
      window.removeEventListener('error', errorListener);
      window.removeEventListener('unhandledrejection', errorListener);
    };
  }, []);

  const handleReset = () => {
    error.current = undefined;
    forceUpdate({});
  };

  if (error.current) {
    return (
      <span title={error.current.message} onClick={handleReset}>
        <Circle weight='fill' className={mx(styles.error, getSize(3))} {...props} />
      </span>
    );
  } else {
    return (
      <span title='No errors.'>
        <Circle weight='fill' className={getSize(3)} {...props} />
      </span>
    );
  }
};

/**
 * Swarm connection handler.
 */
const SwarmIndicator: FC<IconProps> = (props) => {
  const [state, setState] = useState(0);
  const { swarm } = useNetworkStatus();
  useEffect(() => {
    setState(swarm === ConnectionState.ONLINE ? 0 : 1);
  }, [swarm]);

  if (state === 0) {
    return (
      <span title='Connected to swarm.'>
        <Lightning className={getSize(4)} {...props} />
      </span>
    );
  } else {
    return (
      <span title='Disconnected from swarm.'>
        <LightningSlash className={mx(styles.warning, getSize(4))} {...props} />
      </span>
    );
  }
};

/**
 * Space saving indicator.
 */
const SavingIndicator: FC<IconProps> = (props) => {
  const [state, setState] = useState(0);
  const layoutPlugin = useResolvePlugin(parseLayoutPlugin);
  const graphPlugin = useResolvePlugin(parseGraphPlugin);
  const layout = layoutPlugin?.provides.layout;
  const graph = graphPlugin?.provides.graph;
  const space = layout && graph ? getActiveSpace(graph, layout.active) : undefined;
  useEffect(() => {
    if (!space) {
      return;
    }
    const { start, stop } = timer(() => setState(0), { min: 250 });
    return space.db.pendingBatch.on(({ duration, error }) => {
      if (error) {
        setState(2);
        stop();
      } else if (duration === undefined) {
        setState(1);
        start();
      } else {
        stop();
      }
    });
  }, [space]);

  switch (state) {
    case 2:
      return (
        <span title='Edit not saved.'>
          <Circle weight='fill' className={mx(styles.warning, getSize(3))} {...props} />
        </span>
      );
    case 1:
      return (
        <span title='Saving...'>
          <Circle weight='fill' className={mx(styles.success, getSize(3))} {...props} />
        </span>
      );
    case 0:
    default:
      return (
        <span title='Modified indicator.'>
          <Circle weight='fill' className={getSize(3)} {...props} />
        </span>
      );
  }
};

export const DebugStatus = () => {
  const indicators = [SavingIndicator, ErrorIndicator, SwarmIndicator];
  return (
    <div className='flex items-center px-1 gap-1 h-6 text-neutral-200 dark:text-neutral-800'>
      {indicators.map((Indicator) => (
        <Indicator key={Indicator.name} />
      ))}
    </div>
  );
};

export default DebugStatus;
