//
// Copyright 2023 DXOS.org
//

import type {
  GraphBuilderProvides,
  IntentResolverProvides,
  TranslationsProvides,
  SurfaceProvides,
  MetadataRecordsProvides,
} from '@dxos/app-framework';
import { isTypedObject, type Expando, type TypedObject } from '@dxos/react-client/echo';

// TODO(burdon): Copy pattern to other plugins.
export const TEMPLATE_PLUGIN = 'dxos.org/plugin/template';

const TEMPLATE_ACTION = `${TEMPLATE_PLUGIN}/action`;

export enum TemplateAction {
  CREATE = `${TEMPLATE_ACTION}/create`,
}

export type TemplateProvides = {};

export type TemplatePluginProvides = SurfaceProvides &
  IntentResolverProvides &
  GraphBuilderProvides &
  MetadataRecordsProvides &
  TranslationsProvides;

// TODO(burdon): Warning: Encountered two children with the same key, `dxos.org/plugin/template`.
// TODO(burdon): Better way to detect?
export const isObject = (object: unknown): object is TypedObject => {
  return isTypedObject(object) && (object as Expando).type === 'template';
};
