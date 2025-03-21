//
// Copyright 2022 DXOS.org
//

// import { Trigger } from '@dxos/async';
import { type Client, PublicKey } from '@dxos/client';
import { type Space } from '@dxos/client/echo';
import { Invitation } from '@dxos/client/invitations';
import { invariant } from '@dxos/invariant';
import { log } from '@dxos/log';
import { type Command } from '@dxos/protocols/proto/dxos/gravity';

import { processSyncClient, processSyncServer } from './process';

export type StateMachineFactory = (id: string) => AgentStateMachine;

/**
 * Interface for state machine to acess agent state.
 * E.g., client, stats, etc.
 */
export interface AgentContext {
  client: Client;
}

export abstract class AgentStateMachine {
  public _agent?: AgentContext;

  get agent(): AgentContext {
    invariant(this._agent);
    return this._agent;
  }

  setContext(agent: AgentContext) {
    invariant(agent);
    this._agent = agent;
    return this;
  }

  abstract processCommand(command: Command): Promise<void>;
}

/**
 * Dummy state machine.
 */
export class DummyStateMachine extends AgentStateMachine {
  public count = 0;
  override async processCommand(command: Command) {
    this.count++;
  }
}

export class GenericStateMachine extends AgentStateMachine {
  public readonly spaces = new Map<string, Space>();

  async processCommand(command: Command) {
    // --- CREATE PROFILE
    if (command.createProfile) {
      await this.agent.client.halo.createIdentity();
    }
    // --- CREATE SPACE ---
    else if (command.createSpace) {
      const id = command.createSpace.id;
      const space = await this.agent.client.spaces.create();
      if (id) {
        this.spaces.set(id, space);
      }
    }
    // --- CREATE SPACE INVITATION ---
    else if (command.createSpaceInvitation) {
      const id = command.createSpaceInvitation.id;
      const space = this.spaces.get(id)!;
      await space.share({
        authMethod: Invitation.AuthMethod.NONE,
        swarmKey: PublicKey.from(command.createSpaceInvitation.swarmKey),
      });
    }
    // --- ACCEPT SPACE INVITATIOON ---
    else if (command.acceptSpaceInvitation) {
      await this.agent.client.spaces.join({
        invitationId: PublicKey.random().toHex(),
        type: Invitation.Type.INTERACTIVE,
        kind: Invitation.Kind.SPACE,
        authMethod: Invitation.AuthMethod.NONE,
        swarmKey: PublicKey.from(command.acceptSpaceInvitation.swarmKey),
        state: Invitation.State.INIT,
      });
    }
    // --- SYNC CHANNEL: SRV ---
    else if (command.syncServer) {
      await processSyncServer(command); // <- process.ts
    }
    // --- SYNC CHANNEL: CLT ---
    else if (command.syncClient) {
      await processSyncClient(command); // <- process.ts
    }
    // --- TEAR DOWN ---
    else if (command.tearDown) {
      await this.agent.client.destroy();
    }
    //
    else {
      log('Error: invalid command ', { command });
      throw new Error('Invalid command');
    }
  }
}

/**
 * Required by test set-up.
 */
// TODO(burdon): Configurable by map/annotations?
export const testStateMachineFactory: StateMachineFactory = (id: string): AgentStateMachine => {
  switch (id) {
    case 'test-host':
    case 'test-guest':
    case 'generic': {
      return new GenericStateMachine();
    }
    case 'dummy': {
      return new DummyStateMachine();
    }
    default: {
      throw new Error(`Invalid state machine: ${id}`);
    }
  }
};
