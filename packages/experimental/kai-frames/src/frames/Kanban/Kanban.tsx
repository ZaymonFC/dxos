//
// Copyright 2023 DXOS.org
//

import { PlusCircle } from '@phosphor-icons/react';
import React, { FC } from 'react';

import { Button } from '@dxos/react-ui';
import { getSize } from '@dxos/react-ui-theme';
import { Space, TypedObject } from '@dxos/react-client/echo';

export type KanbanCard = FC<{ space: Space; object: TypedObject }>;

export type KanbanColumnDef = {
  id?: string;
  header: string;
  title: (object: TypedObject) => string;
  filter: (object: TypedObject) => boolean;
  Card: KanbanCard;
};

// TODO(burdon): Classes.
// TODO(burdon): Drag.
// TODO(burdon): Delete item.

export type KanbanProps = {
  space: Space;
  objects: TypedObject[];
  columns: KanbanColumnDef[];
  onCreate?: (column: KanbanColumnDef) => void;
};

export const Kanban = ({ space, objects, columns, onCreate }: KanbanProps) => {
  // NOTE: On mobile (sm) the column width is set to the full screen (w-screen)
  // with different padding from other screen sized.
  return (
    <div className='flex flex-1 overflow-x-auto overflow-y-hidden snap-x px-0 md:px-2'>
      <div className='flex'>
        {/* Columns */}
        {columns.map((column, i) => {
          const filtered = objects.filter(column.filter);

          return (
            <div
              key={column.id ?? i}
              className='flex flex-col overflow-hidden w-screen md:w-column snap-center px-4 md:px-2 pb-4'
            >
              <div className='flex flex-col first:ml-0 overflow-hidden bg-paper-1-bg border rounded'>
                <div className='flex px-4 py-2 mb-2 rounded-t text-sm'>{column.header}</div>
                <div className='flex flex-col flex-1 overflow-y-auto px-2'>
                  {/* Cards. */}
                  {filtered.map((object) => {
                    const { Card } = column;
                    return (
                      <div key={object.id} className='mb-2 bg-paper-bg'>
                        <Card space={space} object={object} />
                      </div>
                    );
                  })}
                </div>

                {onCreate && (
                  <div className='flex shrink-0 items-center px-4 py-2'>
                    <div className='flex flex-1 text-sm'>
                      {filtered.length > 0 && (
                        // TODO(burdon): Obviously don't do this.
                        <span>
                          {filtered.length} record{filtered.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <div className='flex flex-1 justify-center'>
                      <Button variant='ghost' onClick={() => onCreate(column)}>
                        <PlusCircle className={getSize(6)} />
                      </Button>
                    </div>
                    <div className='flex flex-1' />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
