//
// Copyright 2020 DXOS.org
//

import { faker } from '@faker-js/faker';
import { expect } from 'chai';

import { latch } from '@dxos/async';
import { log } from '@dxos/log';
import { describe, test } from '@dxos/test';

import { type FeedBlockSelector, FeedSetIterator } from './feed-set-iterator';
import { TestItemBuilder } from './testing';
import { type FeedBlock } from './types';

// Random selector.
const randomFeedBlockSelector: FeedBlockSelector<any> = (blocks: FeedBlock<any>[]) =>
  faker.number.int({ min: 0, max: blocks.length - 1 });

// TODO(burdon): Create randomized setTimeout to test race conditions.

describe('FeedSetIterator', () => {
  // TODO(burdon): Test when feed is added on-the-fly.

  test('opens and closes multiple times', async () => {
    const iterator = new FeedSetIterator(randomFeedBlockSelector);
    await iterator.open();
    await iterator.open();
    expect(iterator.isOpen).to.be.true;
    expect(iterator.isRunning).to.be.true;

    await iterator.start();
    await iterator.start();
    expect(iterator.isOpen).to.be.true;
    expect(iterator.isRunning).to.be.true;

    await iterator.stop();
    await iterator.stop();
    expect(iterator.isOpen).to.be.true;
    expect(iterator.isRunning).to.be.false;

    await iterator.start();
    await iterator.start();
    expect(iterator.isOpen).to.be.true;
    expect(iterator.isRunning).to.be.true;

    await iterator.close();
    await iterator.close();
    expect(iterator.isOpen).to.be.false;
    expect(iterator.isRunning).to.be.false;
  });

  test('responds immediately when a feed is appended', async () => {
    const builder = new TestItemBuilder();
    const feedStore = builder.createFeedStore();
    const iterator = new FeedSetIterator(randomFeedBlockSelector);
    await iterator.open();

    const numFeeds = 3;
    const numBlocks = 10;
    const feeds = await Promise.all(
      Array.from(Array(numFeeds)).map(async () => {
        const key = await builder.keyring.createKey();
        const feed = await feedStore.openFeed(key, { writable: true });
        await iterator.addFeed(feed);
        return feed;
      }),
    );

    const [done, received] = latch({ count: numBlocks });

    {
      // Read block.
      setTimeout(async () => {
        for await (const block of iterator) {
          log('received', block);
          received();
        }
      });

      // Write block.
      setTimeout(async () => {
        const feed = faker.helpers.arrayElement(feeds);
        await builder.generator.writeBlocks(feed.createFeedWriter(), {
          count: numBlocks,
        });
      }, 100);
    }

    await done();
    await iterator.stop();
    await iterator.close();
  });

  test('reads blocks in order', async () => {
    const builder = new TestItemBuilder();
    const feedStore = builder.createFeedStore();

    // TODO(burdon): Randomize?
    const numFeeds = 3;
    const numBlocks = 30;

    // TODO(burdon): Test with starting index.
    const iterator = new FeedSetIterator(randomFeedBlockSelector);

    // Write blocks.
    setTimeout(async () => {
      // Create feeds.
      // TODO(burdon): Test adding feeds on-the-fly.
      const writers = await Promise.all(
        Array.from(Array(numFeeds)).map(async () => {
          const key = await builder.keyring.createKey();
          const feed = await feedStore.openFeed(key, { writable: true });
          await iterator.addFeed(feed);
          return feed.createFeedWriter();
        }),
      );

      expect(iterator.size).to.eq(numFeeds);

      for (const _ of Array.from(Array(numBlocks))) {
        const writer = faker.helpers.arrayElement(writers);
        const receipts = await builder.generator.writeBlocks(writer, {
          count: 1,
        });
        log('wrote', receipts);
      }
    }, faker.number.int({ min: 0, max: 100 }));

    // Open and start iterator.
    await iterator.open();
    expect(iterator.isOpen).to.be.true;
    expect(iterator.isRunning).to.be.true;

    // Read blocks.
    const [readAll, read] = latch({ count: numBlocks });
    setTimeout(async () => {
      for await (const block of iterator) {
        const { feedKey, seq } = block;
        const count = read();
        log('read', { feedKey, seq, count });
        if (count === numBlocks) {
          await iterator.stop();
        }
      }
    }, faker.number.int({ min: 0, max: 100 }));

    // Wait until all written and read.
    const count = await readAll();
    expect(count).to.eq(numBlocks);

    // Written blocks.
    const written = feedStore.feeds.reduce((count, feed) => count + feed.properties.length, 0);
    const feeds = feedStore.feeds.map((feed) => ({
      feedKey: feed.key,
      length: feed.properties.length,
    }));

    log('written', { feeds, written });
    expect(written).to.eq(numBlocks);

    expect(iterator.isRunning).to.be.false;
    await iterator.close();
    await feedStore.close();
  }).timeout(3_000);

  test('start from non-zero index', async () => {
    const builder = new TestItemBuilder();
    const feedStore = builder.createFeedStore();

    const key = await builder.keyring.createKey();
    const feed = await feedStore.openFeed(key, { writable: true });

    const iterator = new FeedSetIterator(randomFeedBlockSelector, {
      start: [
        {
          feedKey: feed.key,
          index: 2,
        },
      ],
    });
    await iterator.open();
    await iterator.addFeed(feed);

    await builder.generator.writeBlocks(feed.createFeedWriter(), {
      count: 10,
    });

    let index = 2;
    for await (const block of iterator) {
      log('received', block);
      expect(block.seq).to.eq(index);

      if (++index === 10) {
        break;
      }
    }

    await iterator.stop();
    await iterator.close();
  });
});
