//
// Copyright 2023 DXOS.org
//

import { Bug, type IconProps } from '@phosphor-icons/react';
import { batch } from '@preact/signals-react';
import React, { useEffect, useState } from 'react';

import { type ClientPluginProvides } from '@braneframe/plugin-client';
import { Graph } from '@braneframe/plugin-graph';
import { SpaceAction } from '@braneframe/plugin-space';
import { Folder } from '@braneframe/types';
import {
  getPlugin,
  resolvePlugin,
  type Plugin,
  type PluginDefinition,
  type IntentPluginProvides,
  parseGraphPlugin,
  parseIntentPlugin,
} from '@dxos/app-framework';
import { Timer } from '@dxos/async';
import { LocalStorageStore } from '@dxos/local-storage';
import { SpaceProxy } from '@dxos/react-client/echo';

import { DebugGlobal, DebugSettings, DebugSpace, DebugStatus, DevtoolsMain } from './components';
import { DEBUG_PLUGIN, DebugContext, type DebugSettingsProps, type DebugPluginProvides } from './props';
import translations from './translations';

export const SETTINGS_KEY = DEBUG_PLUGIN + '/settings';

export const DebugPlugin = (): PluginDefinition<DebugPluginProvides> => {
  const settings = new LocalStorageStore<DebugSettingsProps>(DEBUG_PLUGIN);

  let intentPlugin: Plugin<IntentPluginProvides>;

  return {
    meta: {
      id: DEBUG_PLUGIN,
    },
    ready: async () => {
      settings
        .prop(settings.values.$debug!, 'debug', LocalStorageStore.bool)
        .prop(settings.values.$devtools!, 'devtools', LocalStorageStore.bool);
    },
    unload: async () => {
      settings.close();
    },
    provides: {
      settings: settings.values,
      translations,
      context: ({ children }) => {
        const [timer, setTimer] = useState<Timer>();
        useEffect(() => timer?.state.on((value) => !value && setTimer(undefined)), [timer]);
        useEffect(() => {
          timer?.stop();
        }, []);

        return (
          <DebugContext.Provider
            value={{
              running: !!timer,
              start: (cb, options) => {
                timer?.stop();
                setTimer(new Timer(cb).start(options));
              },
              stop: () => timer?.stop(),
            }}
          >
            {children}
          </DebugContext.Provider>
        );
      },
      graph: {
        builder: ({ parent, plugins }) => {
          if (parent.id !== 'root') {
            return;
          }

          const subscriptions: (() => void)[] = [];

          // Devtools node.
          subscriptions.push(
            settings.values.$devtools!.subscribe((debug) => {
              if (debug) {
                parent.addNode(DEBUG_PLUGIN, {
                  id: 'devtools',
                  label: ['devtools label', { ns: DEBUG_PLUGIN }],
                  icon: (props) => <Bug {...props} />,
                  data: 'devtools',
                });
              } else {
                parent.removeNode('devtools');
              }
            }),
          );

          const graphPlugin = resolvePlugin(plugins, parseGraphPlugin);
          intentPlugin = resolvePlugin(plugins, parseIntentPlugin)!;

          // Root debug node.
          subscriptions.push(
            settings.values.$debug!.subscribe((debug) => {
              const nodeId = 'debug';
              if (debug) {
                const [root] = parent.addNode(DEBUG_PLUGIN, {
                  id: nodeId,
                  label: ['debug label', { ns: DEBUG_PLUGIN }],
                  data: { graph: graphPlugin?.provides.graph },
                });

                root.addAction({
                  id: 'open-devtools',
                  label: ['open devtools label', { ns: DEBUG_PLUGIN }],
                  icon: (props) => <Bug {...props} />,
                  invoke: () =>
                    intentPlugin?.provides.intent.dispatch({
                      plugin: DEBUG_PLUGIN,
                      action: 'open-devtools', // TODO(burdon): Definition.
                    }),
                  keyBinding: 'shift+meta+\\',
                  properties: {
                    testId: 'spacePlugin.openDevtools',
                  },
                });

                const clientPlugin = getPlugin<ClientPluginProvides>(plugins, 'dxos.org/plugin/client');
                subscriptions.push(
                  // TODO(burdon): Remove if hidden.
                  clientPlugin.provides.client.spaces.subscribe((spaces) => {
                    batch(() => {
                      spaces.forEach((space) => {
                        root.addNode(DEBUG_PLUGIN, {
                          id: `${space.key.toHex()}-debug`,
                          label: space.key.truncate(),
                          icon: (props: IconProps) => <Bug {...props} />,
                          data: { space },
                        });
                      });
                    });
                  }).unsubscribe,
                );
              } else {
                parent.removeNode(nodeId);
              }
            }),
          );

          return () => {
            subscriptions.forEach((unsubscribe) => unsubscribe());
          };
        },
      },
      intent: {
        resolver: async (intent, plugins) => {
          switch (intent.action) {
            case 'open-devtools': {
              const clientPlugin = getPlugin<ClientPluginProvides>(plugins, 'dxos.org/plugin/client');
              const client = clientPlugin.provides.client;
              const vaultUrl = client.config.values?.runtime?.client?.remoteSource ?? 'https://halo.dxos.org';

              // Check if we're serving devtools locally on the usual port.
              let devtoolsUrl = 'http://localhost:5174';
              try {
                // TODO(burdon): Test header to see if this is actually devtools.
                await fetch(devtoolsUrl);
              } catch {
                // Match devtools to running app.
                const isDev = window.location.href.includes('.dev.') || window.location.href.includes('localhost');
                devtoolsUrl = `https://devtools${isDev ? '.dev.' : '.'}dxos.org`;
              }

              window.open(`${devtoolsUrl}?target=${vaultUrl}`, '_blank');
              return true;
            }
          }
        },
      },
      surface: {
        component: ({ component, active }, role) => {
          if (role === 'settings' && component === 'dxos.org/plugin/layout/ProfileSettings') {
            return <DebugSettings />;
          }

          if (!settings.values.debug) {
            return null;
          }

          switch (role) {
            case 'main':
              return active === 'devtools' ? (
                <DevtoolsMain />
              ) : !active || typeof active !== 'object' ? null : 'space' in active &&
                active.space instanceof SpaceProxy ? (
                <DebugSpace
                  space={active.space}
                  onAddObjects={(objects) => {
                    // TODO(burdon): Check root folder.
                    const { objects: folders } = (active.space as SpaceProxy).db.query(Folder.filter());
                    void intentPlugin?.provides.intent.dispatch(
                      objects.map((object) => ({
                        action: SpaceAction.ADD_TO_FOLDER,
                        data: { folder: folders[0], object },
                      })),
                    );
                  }}
                />
              ) : 'graph' in active && active.graph instanceof Graph ? (
                <DebugGlobal graph={active.graph} />
              ) : null;
            case 'status':
              return <DebugStatus />;
          }

          return null;
        },
      },
    },
  };
};
