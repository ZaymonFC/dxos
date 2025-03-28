//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';

import React, { useEffect, useState } from 'react';

import { TextObject } from '@dxos/client/echo';
import { createSpaceObjectGenerator } from '@dxos/echo-generator';
import { TextKind } from '@dxos/protocols/proto/dxos/echo/model/text';
import { useClient } from '@dxos/react-client';
import { ClientSpaceDecorator } from '@dxos/react-client/testing';

// @ts-ignore
import mainUrl from './FrameContainer/frame?url';
import { ScriptMain, ScriptSection } from './ScriptMain';

const code = [
  "import { Filter, useQuery, useSpaces} from '@dxos/react-client/echo';",
  "import { Chart, Explorer, Globe } from '@braneframe/plugin-explorer';",
  '',
  'export default () => {',
  '  const spaces = useSpaces();',
  '  const space = spaces[1]',
  "  const objects = useQuery(space, Filter._typename('example.com/schema/person'));",
  '  return <Chart items={objects} accessor={object => ({ x: object.lat, y: object.lng })} />',
  '}',
].join('\n');

const Story = () => {
  const [source, setSource] = useState<TextObject>();
  useEffect(() => {
    setSource(new TextObject(code, TextKind.PLAIN));
  }, []);

  const client = useClient();
  useEffect(() => {
    const generator = createSpaceObjectGenerator(client.spaces.default);
    generator.addSchemas();
    generator.createObjects({ count: 300 });
  }, []);

  if (!source) {
    return null;
  }

  // TODO(dmaretskyi): Not sure how to provide `containerUrl` here since the html now lives in labs-app.
  return (
    <div className={'flex fixed inset-0'}>
      <ScriptSection id='test' source={source} containerUrl={mainUrl} />
    </div>
  );
};

export default {
  component: ScriptMain,
  render: Story,
  decorators: [ClientSpaceDecorator()],
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = {};
