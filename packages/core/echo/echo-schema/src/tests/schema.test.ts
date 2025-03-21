//
// Copyright 2022 DXOS.org
//

import { expect } from 'chai';

import { describe, test } from '@dxos/test';

import { Contact, Container, Task, types } from './proto';
import { immutable, Expando } from '../object';
import { Schema } from '../proto';
import { TestBuilder, createDatabase } from '../testing';

// TODO(burdon): Test with database.
// TODO(burdon): Implement Task.from to deserialize JSON string.

describe('static schema', () => {
  test('keys', () => {
    const contact = new Contact({ name: 'Test User' });
    expect(contact.id).to.exist;
    expect(Object.keys(contact).length).to.eq(6);
    contact.email = 'test@example.com';

    // TODO(burdon): Address should be auto-created?
    // contact.address.zip = '11205';

    // TODO(burdon): Test after saved with test database.
    expect(contact.id).to.be.a('string'); // TODO(burdon): Expose as property.
  });

  test('json', () => {
    const contact = new Contact();
    contact.name = 'User 1';
    expect(contact.name).to.eq('User 1');
    expect(contact.toJSON()).to.contain({ name: 'User 1' });

    const task1 = new Task();
    task1.title = 'Task 1';
    expect(task1.title).to.eq('Task 1');
    expect(task1.toJSON()).to.contain({ title: 'Task 1' });

    task1.assignee = contact;
    expect(task1.assignee.name).to.eq('User 1');
    expect(task1.toJSON()).to.deep.contain({ title: 'Task 1', assignee: { '@id': contact.id } });
    expect(JSON.stringify(task1, null, 4)).to.equal(
      JSON.stringify(
        {
          '@id': task1.id,
          '@type': task1.__typename,
          '@model': 'dxos.org/model/document',
          '@meta': { keys: [] },
          subTasks: [],
          description: { '@id': task1.description.id },
          title: 'Task 1',
          assignee: { '@id': contact.id },
        },
        null,
        4,
      ),
    );
  });

  test('json with recursion', () => {
    const contact = new Contact({ name: 'User 1' });
    contact.tasks.push(new Task({ title: 'Task 1', assignee: contact }));
    contact.tasks.push(new Task({ title: 'Task 2', assignee: contact }));

    expect(contact.toJSON()).to.deep.eq({
      '@id': contact.id,
      '@type': contact.__typename,
      '@model': 'dxos.org/model/document',
      '@meta': { keys: [] },
      name: 'User 1',
      tasks: [
        {
          '@id': contact.tasks[0].id,
        },
        {
          '@id': contact.tasks[1].id,
        },
      ],
    });
  });

  test('destructuring', () => {
    const contact = new Contact({ name: 'user', address: { coordinates: { lat: -90, lng: 10 } } });
    const { lat, lng } = contact.address.coordinates!;
    expect({ lat, lng }).to.deep.eq({ lat: -90, lng: 10 });
  });

  test('enums', () => {
    const container = new Container({ records: [{ type: Container.Record.Type.PERSONAL }] });
    expect(container.records[0].type).to.eq(Container.Record.Type.PERSONAL);
  });

  test('runtime schema', async () => {
    const { db: database } = await createDatabase();

    const orgSchema = new Schema({
      typename: 'example.Org',
      props: [
        {
          id: 'name',
          type: Schema.PropType.STRING,
        },
        {
          id: 'website',
          type: Schema.PropType.STRING,
        },
      ],
    });
    database.add(orgSchema);

    const org = new Expando(
      {
        name: 'DXOS',
        website: 'dxos.org',
      },
      { schema: orgSchema },
    );
    database.add(org);

    expect(org.name).to.eq('DXOS');
    expect(org.website).to.eq('dxos.org');
    expect(org.__schema).to.eq(orgSchema);
    expect(org.__schema?.[immutable]).to.eq(false);
  });

  test('restart with static schema', async () => {
    const builder = new TestBuilder();
    builder.graph.addTypes(types);

    const peer = await builder.createPeer();
    const task = peer.db.add(new Task({ title: 'Task 1' }));
    await peer.base.confirm();
    expect(task).to.be.instanceOf(Task);

    await peer.reload();
    {
      const task2 = peer.db.getObjectById<Task>(task.id);
      expect(task2).to.be.instanceOf(Task);
      expect(task2!.__typename).to.eq('example.test.Task');
      expect(task2!.__schema?.typename).to.eq('example.test.Task');
    }
  });

  test('restart with static schema and schema is registered later', async () => {
    const builder = new TestBuilder();

    const peer = await builder.createPeer();
    const task = peer.db.add(new Task({ title: 'Task 1' }));
    await peer.base.confirm();
    expect(task).to.be.instanceOf(Task);

    await peer.reload();
    {
      const task2 = peer.db.getObjectById<Task>(task.id);
      expect(task2).to.be.instanceOf(Task);
      expect(task2!.__typename).to.eq('example.test.Task');
      expect(task2!.__schema).to.eq(undefined);

      builder.graph.addTypes(types);
      expect(task2!.__schema?.typename).to.eq('example.test.Task');
    }
  });
});
