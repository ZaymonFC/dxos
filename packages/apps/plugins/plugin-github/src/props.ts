//
// Copyright 2023 DXOS.org
//

import { type Dispatch, type SetStateAction } from 'react';

import { type Document } from '@braneframe/types';
import { type Space } from '@dxos/react-client/echo';

export const GITHUB_PLUGIN = 'dxos.org/plugin/github';
export const GITHUB_PLUGIN_SHORT_ID = 'github';

export type EditorViewState = 'editor' | 'preview';

export type MarkdownDocumentProps = {
  space: Space;
  document: Document;
  layout: 'standalone' | 'embedded';
  editorViewState: EditorViewState;
  setEditorViewState: Dispatch<SetStateAction<EditorViewState>>;
};

export type GhSharedProps = {
  owner: string;
  repo: string;
};

export type GhFileIdentifier = GhSharedProps & {
  ref: string;
  path: string;
};

export type GhIssueIdentifier = GhSharedProps & {
  issueNumber: number;
};

export type GhIdentifier = GhFileIdentifier | GhIssueIdentifier;

export type ExportViewState = 'create-pr' | 'pending' | 'response' | null;
