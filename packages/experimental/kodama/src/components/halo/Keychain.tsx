//
// Copyright 2022 DXOS.org
//

import format from 'date-format';
import { Box } from 'ink';
import React from 'react';

import { truncateKey } from '@dxos/debug';
import { KeyType, useDevtools, useStream } from '@dxos/react-client/devtools';

import { Table } from '../util';

const formatDate = (date: Date) => format('yyyy-mm-dd hh:mm', new Date(date));

export const Keychain = () => {
  const skip = true;
  if (skip) {
    return null;
  }

  const devtoolsHost = useDevtools();
  if (!devtoolsHost) {
    return null;
  }

  const { keys } = useStream(() => devtoolsHost.subscribeToKeyringKeys({}), {});
  if (keys === undefined) {
    return null;
  }

  return (
    <Box flexDirection='column'>
      <Table
        showHeader
        columns={[
          {
            key: 'type',
            width: 12,
            value: (type) => KeyType[type],
          },
          {
            key: 'own',
            width: 8,
          },
          {
            key: 'trusted',
            width: 8,
          },
          {
            key: 'created',
            width: 18,
            color: 'gray',
            value: (date) => formatDate(date),
          },
          {
            key: 'public_key',
            width: 20,
            color: 'green',
            value: (key) => truncateKey(key),
          },
        ]}
        rows={keys}
      />
    </Box>
  );
};
