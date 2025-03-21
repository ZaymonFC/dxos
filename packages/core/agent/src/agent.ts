//
// Copyright 2023 DXOS.org
//

import type WebSocket from 'isomorphic-ws';
import { mkdirSync, rmSync } from 'node:fs';
import * as http from 'node:http';
import { dirname } from 'node:path';

import { type Config, Client, PublicKey } from '@dxos/client';
import { type ClientServices, type ClientServicesProvider, fromHost } from '@dxos/client/services';
import { Context } from '@dxos/context';
import { invariant } from '@dxos/invariant';
import { log } from '@dxos/log';
import {
  createLibDataChannelTransportFactory,
  createSimplePeerTransportFactory,
  type TransportFactory,
} from '@dxos/network-manager';
import { tracer } from '@dxos/util';
import { WebsocketRpcServer } from '@dxos/websocket-rpc';

import { type Plugin } from './plugins';
import { lockFilePath, parseAddress } from './util';

interface Service {
  open(): Promise<void>;
  close(): Promise<void>;
}

export type AgentOptions = {
  config: Config;
  profile: string;
  plugins?: Plugin[];
  metrics?: boolean;
  protocol?: {
    socket: string;
    webSocket?: number;
  };
};

/**
 * The remote agent exposes Client services via multiple transports.
 */
export class Agent {
  private readonly _plugins: Plugin[];

  private _client?: Client;
  private _clientServices?: ClientServicesProvider;
  private _services: Service[] = [];

  constructor(private readonly _options: AgentOptions) {
    invariant(this._options);
    this._plugins = this._options.plugins?.filter(Boolean) ?? [];
    if (this._options.metrics) {
      tracer.start();
    }
  }

  async start() {
    invariant(!this._clientServices);
    log('starting...');

    // Create client services.

    // TODO(nf): move to config
    let transportFactory: TransportFactory;

    if (process.env.WEBRTCLIBRARY === 'LibDataChannel') {
      log.info('using LibDataChannel');
      transportFactory = createLibDataChannelTransportFactory();
    } else {
      log.info('using SimplePeer');
      transportFactory = createSimplePeerTransportFactory();
    }

    this._clientServices = await fromHost(this._options.config, {
      lockKey: lockFilePath(this._options.profile),
      transportFactory,
    });
    await this._clientServices.open(new Context());

    // Create client.
    // TODO(burdon): Move away from needing client for epochs and proxy?
    this._client = new Client({ config: this._options.config, services: this._clientServices });
    await this._client.initialize();

    //
    // Unix socket (accessed via CLI).
    // TODO(burdon): Configure ClientServices plugin with multiple endpoints.
    //
    if (this._options.protocol?.socket) {
      const { path } = parseAddress(this._options.protocol.socket);
      mkdirSync(dirname(path), { recursive: true });
      rmSync(path, { force: true });
      const httpServer = http.createServer();
      httpServer.listen(path);
      const socketServer = createServer(this._clientServices, { server: httpServer });
      await socketServer.open();
      this._services.push(socketServer);
      log.info('listening', { path });
    }

    //
    // Web socket (accessed via devtools).
    // TODO(burdon): Insecure.
    //
    if (this._options.protocol?.webSocket) {
      const port = this._options.protocol.webSocket;
      const socketServer = createServer(this._clientServices, { port });
      await socketServer.open();
      this._services.push(socketServer);
      log.info('listening', { port });
    }

    // Open plugins.
    for (const plugin of this._plugins) {
      await plugin.initialize({ client: this._client!, clientServices: this._clientServices!, plugins: this._plugins });
      await plugin.open();
      log('open', { plugin });
    }

    log('started');
  }

  async stop() {
    log('stopping...');

    // Close plugins.
    await Promise.all(this._plugins.map((plugin) => plugin.close()));
    this._plugins.length = 0;

    // Close services.
    await Promise.all(this._services.map((plugin) => plugin.close()));
    this._services.length = 0;

    // Close client and services.
    await this._client?.destroy();
    await this._clientServices?.close(new Context());
    this._client = undefined;
    this._clientServices = undefined;

    log('stopped');
  }
}

const createServer = (clientServices: ClientServicesProvider, options: WebSocket.ServerOptions) => {
  return new WebsocketRpcServer<{}, ClientServices>({
    ...options,
    onConnection: async () => {
      let start = 0;
      const connection = PublicKey.random().toHex().slice(0, 8);
      return {
        exposed: clientServices.descriptors,
        handlers: clientServices.services as ClientServices,
        // Called when client connects.
        onOpen: async () => {
          start = Date.now();
          log('open', { connection });
        },
        onClose: async () => {
          log('close', { connection, time: Date.now() - start });
        },
      };
    },
  });
};
