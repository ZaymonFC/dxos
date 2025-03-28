//
// Copyright 2021 DXOS.org
//

import { Event } from '@dxos/async';
import { raise } from '@dxos/debug';
import { PublicKey } from '@dxos/keys';
import { type SwarmInfo, type ConnectionInfo } from '@dxos/protocols/proto/dxos/devtools/swarm';
import { type MuxerStats } from '@dxos/teleport';
import { ComplexMap } from '@dxos/util';

import { ConnectionState, type Swarm } from './swarm';
import { type WireProtocol } from './wire-protocol';

export enum EventType {
  CONNECTION_STATE_CHANGED = 'CONNECTION_STATE_CHANGED',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  PROTOCOL_EXTENSIONS_INITIALIZED = 'PROTOCOL_EXTENSIONS_INITIALIZED',
  PROTOCOL_EXTENSIONS_HANDSHAKE = 'PROTOCOL_EXTENSIONS_HANDSHAKE',
  PROTOCOL_HANDSHAKE = 'PROTOCOL_HANDSHAKE',
}

export class ConnectionLog {
  /**
   * SwarmId => info
   */
  private readonly _swarms = new ComplexMap<PublicKey, SwarmInfo>(PublicKey.hash);

  readonly update = new Event();

  getSwarmInfo(swarmId: PublicKey) {
    return this._swarms.get(swarmId) ?? raise(new Error(`Swarm not found: ${swarmId}`));
  }

  get swarms(): SwarmInfo[] {
    return Array.from(this._swarms.values());
  }

  joinedSwarm(swarm: Swarm) {
    const info: SwarmInfo = {
      id: PublicKey.from(swarm._instanceId),
      topic: swarm.topic,
      isActive: true,
      label: swarm.label,
      connections: [],
    };

    this._swarms.set(PublicKey.from(swarm._instanceId), info);
    this.update.emit();

    swarm.connectionAdded.on((connection) => {
      const connectionInfo: ConnectionInfo = {
        state: ConnectionState.CREATED,
        closeReason: connection.closeReason,
        remotePeerId: connection.remoteId,
        sessionId: connection.sessionId,
        transport: connection.transport && Object.getPrototypeOf(connection.transport).constructor.name,
        protocolExtensions: [], // TODO(dmaretskyi): Fix.
        events: [],
      };
      info.connections!.push(connectionInfo);
      this.update.emit();

      connection.stateChanged.on((state) => {
        connectionInfo.state = state;
        connectionInfo.closeReason = connection.closeReason;
        connectionInfo.events!.push({
          type: EventType.CONNECTION_STATE_CHANGED,
          newState: state,
        });
        this.update.emit();
      });

      (connection.protocol as WireProtocol & { stats: Event<MuxerStats> })?.stats?.on((stats) => {
        connectionInfo.readBufferSize = stats.readBufferSize;
        connectionInfo.writeBufferSize = stats.writeBufferSize;
        connectionInfo.streams = stats.channels;
        this.update.emit();
      });

      // connection.protocol.protocol?.error.on((error) => {
      //   connectionInfo.events!.push({
      //     type: EventType.PROTOCOL_ERROR,
      //     error: error.stack ?? error.message
      //   });
      //   this.update.emit();
      // });
      // connection.protocol.protocol?.extensionsInitialized.on(() => {
      //   connectionInfo.events!.push({
      //     type: EventType.PROTOCOL_EXTENSIONS_INITIALIZED
      //   });
      //   this.update.emit();
      // });
      // connection.protocol.protocol?.extensionsHandshake.on(() => {
      //   connectionInfo.events!.push({
      //     type: EventType.PROTOCOL_EXTENSIONS_HANDSHAKE
      //   });
      //   this.update.emit();
      // });
      // connection.protocol.protocol?.handshake.on(() => {
      //   connectionInfo.events!.push({
      //     type: EventType.PROTOCOL_HANDSHAKE
      //   });
      //   this.update.emit();
      // });
    });
  }

  leftSwarm(swarm: Swarm) {
    this.getSwarmInfo(PublicKey.from(swarm._instanceId)).isActive = false;
    this.update.emit();
  }
}
