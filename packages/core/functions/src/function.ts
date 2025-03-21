//
// Copyright 2023 DXOS.org
//

import { type Client } from '@dxos/client';

export interface Response {
  status(code: number): Response;
  succeed(data?: object): Response;
}

export interface FunctionContext {
  client: Client;
  status(code: number): Response;
}

// https://www.npmjs.com/package/aws-lambda
// https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html

// TODO(burdon): Types.
export type FunctionSubscriptionEvent = {
  space: string;
  objects: string[];
};

export type FunctionHandler<T extends {}> = (params: {
  event: T;
  context: FunctionContext;
}) => Promise<Response | void>;

export type FunctionsManifest = {
  functions: FunctionConfig[];
  triggers: FunctionTrigger[];
};

export type FunctionConfig = {
  id: string;
  description?: string;
};

export type FunctionTrigger = {
  function: string;
  subscription: TriggerSubscription;
};

export type TriggerSubscription = {
  type: string;
  spaceKey: string;
  props?: Record<string, any>;
  nested?: string[];
};
