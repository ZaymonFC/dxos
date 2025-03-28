//
// Copyright 2022 DXOS.org
//

import { expect } from 'chai';

import { sleep, Trigger } from '@dxos/async';
import { type Space } from '@dxos/client/echo';
import { Invitation } from '@dxos/client/invitations';
import { TestBuilder } from '@dxos/client/testing';
import { type ConfigProto } from '@dxos/config';
import { PublicKey } from '@dxos/keys';
import { log } from '@dxos/log';
import { type AgentSpec, type Command } from '@dxos/protocols/proto/dxos/gravity';
import { describe, test, afterTest } from '@dxos/test';

import { Agent } from './agent';
import { AgentStateMachine, type StateMachineFactory } from './statemachine';

// TODO(burdon): Run local signal server for tests.
describe('Agent', () => {
  test('creates and starts a basic agent', async () => {
    const config: ConfigProto = { version: 1 };
    const agent = new Agent({ config });
    await agent.initialize();
    expect(agent.client).to.exist;
    expect(agent.started).to.be.false;
    await agent.start();
    expect(agent.started).to.be.true;
    await agent.stop();
    expect(agent.started).to.be.false;
    await agent.destroy();
  });

  // TODO(burdon): Skipped since hangs on closing.
  test.skip('creates a space', async () => {
    const config: ConfigProto = { version: 1 };
    const agent = new Agent({ config });
    await agent.initialize();
    const space = await agent.client!.spaces.create();
    expect(space.key).to.exist;
    expect(space.properties).to.exist;
    await agent.destroy();
  });

  // TODO(burdon): Skipped since hangs on closing.
  test.skip('tests two agents', async () => {
    const config: ConfigProto = { version: 1 };
    const swarmKey = PublicKey.random();

    const spec1: AgentSpec = {
      stateMachine: 'test-host',
      startSequence: {
        commands: [
          {
            createProfile: {},
          },
        ],
      },
      testSequences: [
        {
          commands: [
            {
              createSpace: {
                id: 'space-1',
              },
            },
            {
              createSpaceInvitation: {
                id: 'space-1',
                swarmKey: swarmKey.toHex(),
              },
            },
          ],
        },
      ],
    };

    const spec2: AgentSpec = {
      stateMachine: 'test-guest',
      startSequence: {
        commands: [
          {
            createProfile: {},
          },
        ],
      },
      testSequences: [
        {
          commands: [
            {
              acceptSpaceInvitation: {
                swarmKey: swarmKey.toHex(),
              },
            },
          ],
        },
      ],
    };

    // TODO(burdon): Capture logs/stats.
    // TODO(burdon): Error handling.

    const testBuilder = new TestBuilder();

    // TODO(burdon): Extend TestBuilder pattern for gravity-agent package.
    const agent1 = new Agent({
      config,
      services: testBuilder.createLocal(),
      spec: spec1,
      stateMachine: testStateMachineFactory(spec1.stateMachine!),
    });
    const agent2 = new Agent({
      config,
      services: testBuilder.createLocal(),
      spec: spec2,
      stateMachine: testStateMachineFactory(spec2.stateMachine!),
    });

    // Initialize.
    await Promise.all([agent1.initialize(), agent2.initialize()]);
    afterTest(() => Promise.all([agent1.destroy(), agent2.destroy()]));

    // Run sequences.
    const space1 = new Trigger<Space>();
    const space2 = new Trigger<Space>();

    agent1.sequenceComplete.once(() => {
      space1.wake(agent1.client.spaces.get()[0]!);
    });
    agent2.sequenceComplete.once(() => {
      space2.wake(agent2.client.spaces.get()[0]!);
    });

    // Test invitation happened.
    await Promise.all([agent1.start(), agent2.start()]);
    const [s1, s2] = await Promise.all([space1.wait(), space2.wait()]);
    log('synchronized', { space1: s1.key, space2: s2.key });
    expect(s1.key).to.deep.eq(s2.key);

    // TODO(burdon): Stopping too early (before items can be created).
    log('sleeping...');
    await sleep(100);

    // TODO(burdon): Test passes but hangs (protocol ETIMEOUT).
    await Promise.all([agent1.stop(), agent2.stop()]);
  });
});

/**
 * Required by test set-up.
 */
// TODO(burdon): Configurable by map/annotations?
const testStateMachineFactory: StateMachineFactory = (id: string): AgentStateMachine => {
  switch (id) {
    case 'test-host': {
      return new HostAgentStateMachine();
    }
    case 'test-guest': {
      return new GuestAgentStateMachine();
    }
    default: {
      throw new Error(`Invalid state machine: ${id}`);
    }
  }
};

/**
 * Host creates space and invitations.
 */
class HostAgentStateMachine extends AgentStateMachine {
  public readonly spaces = new Map<string, Space>();

  async processCommand(command: Command) {
    if (command.createProfile) {
      await this.agent.client.halo.createIdentity();
    } else if (command.createSpace) {
      const id = command.createSpace.id;
      const space = await this.agent.client.spaces.create();
      if (id) {
        this.spaces.set(id, space);
      }
    } else if (command.createSpaceInvitation) {
      const id = command.createSpaceInvitation.id;
      const space = this.spaces.get(id)!;
      const observable = await space.share({
        authMethod: Invitation.AuthMethod.NONE,
        swarmKey: PublicKey.fromHex(command.createSpaceInvitation.swarmKey),
      });

      const trigger = new Trigger();
      observable.subscribe(
        (invitation: Invitation) => {
          if (invitation.state === Invitation.State.SUCCESS) {
            trigger.wake();
          }
        },
        (err: Error) => {
          throw err;
        },
      );

      await trigger.wait();
    } else {
      throw new Error('Invalid command');
    }
  }
}

/**
 * Guest receives invitations.
 */
class GuestAgentStateMachine extends AgentStateMachine {
  async processCommand(command: Command) {
    if (command.createProfile) {
      await this.agent.client.halo.createIdentity();
    } else if (command.acceptSpaceInvitation) {
      const observable = await this.agent.client.spaces.join({
        invitationId: PublicKey.random().toHex(),
        type: Invitation.Type.INTERACTIVE,
        kind: Invitation.Kind.SPACE,
        authMethod: Invitation.AuthMethod.NONE,
        swarmKey: PublicKey.fromHex(command.acceptSpaceInvitation.swarmKey),
        state: Invitation.State.INIT,
      });

      const trigger = new Trigger();
      observable.subscribe(
        (invitation: Invitation) => {
          if (invitation.state === Invitation.State.SUCCESS) {
            trigger.wake();
          }
        },
        (err: Error) => {
          throw err;
        },
      );

      await trigger.wait();
    } else {
      throw new Error('Invalid command');
    }
  }
}
