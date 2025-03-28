//
// Copyright 2023 DXOS.org
//

import { MagnifyingGlass, Chat } from '@phosphor-icons/react';
import React, { useState } from 'react';

import { Surface } from '@dxos/app-framework';
import { Button, DensityProvider } from '@dxos/react-ui';
import { getSize, mx } from '@dxos/react-ui-theme';

enum Role {
  SEARCH = 'context-search',
  THREAD = 'context-thread',
}

const selected = 'bg-neutral-100 dark:bg-neutral-800'; // TODO(burdon): Factor out.

export const ContextView = () => {
  const [role, setRole] = useState(Role.SEARCH);

  return (
    <div className='flex h-full overflow-hidden'>
      <div className='flex grow overflow-hidden'>
        <Surface role={role} />
      </div>
      <div className='absolute inset-y-1/2 right-0 flex flex-col justify-center'>
        <div className='flex flex-col border-2 border-r-0 rounded rounded-r-none border-black bg-white dark:bg-black'>
          <DensityProvider density='fine'>
            <Button
              variant='ghost'
              onClick={() => setRole(Role.SEARCH)}
              classNames={mx('p-2 rounded-none rounded-tl-sm', role === Role.SEARCH && selected)}
            >
              <MagnifyingGlass className={getSize(4)} />
            </Button>
            <Button
              variant='ghost'
              onClick={() => setRole(Role.THREAD)}
              classNames={mx('p-2 rounded-none rounded-bl-sm', role === Role.THREAD && selected)}
            >
              <Chat className={getSize(4)} />
            </Button>
          </DensityProvider>
        </div>
      </div>
    </div>
  );
};
