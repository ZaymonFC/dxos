//
// Copyright 2023 DXOS.org
//

import type { Browser, Page } from '@playwright/test';

import { setupPage } from '@dxos/test/playwright';
import { ShellManager } from '@dxos/vault/testing';

export class AppManager {
  page!: Page;
  shell!: ShellManager;

  private readonly _inIframe: boolean | undefined = undefined;
  private _initialized = false;

  // prettier-ignore
  constructor(
    private readonly _browser: Browser,
    inIframe?: boolean,
  ) {
    this._inIframe = inIframe;
  }

  async init() {
    if (this._initialized) {
      return;
    }

    const { page } = await setupPage(this._browser, {
      waitFor: (page) => page.getByTestId('treeView.haloButton').isVisible(),
    });
    this.page = page;
    this.shell = new ShellManager(this.page, this._inIframe);
    this._initialized = true;
  }

  isAuthenticated() {
    return this.page.getByTestId('layoutPlugin.firstRunMessage').isVisible();
  }

  async createSpace() {
    await this.page.getByTestId('spacePlugin.createSpace').click();
    return this.page.getByTestId('navtree.treeItem.openTrigger').last().click();
  }

  async joinSpace() {
    await this.page.getByTestId('navtree.treeItem.actionsLevel0').nth(1).click();
    return this.page.getByTestId('spacePlugin.joinSpace').click();
  }

  // TODO(wittjosiah): This is not always a space.
  expandSpace() {
    return this.page.getByTestId('navtree.treeItem.openTrigger').last().click();
  }

  async createDocument() {
    await this.page.getByTestId('spacePlugin.createObject').last().click();
    return this.page.getByTestId('markdownPlugin.createDocument').last().click();
  }

  async getSpaceItemsCount() {
    const [openCount, closedCount] = await Promise.all([
      this.page.getByTestId('spacePlugin.personalSpace').count(),
      this.page.getByTestId('spacePlugin.space').count(),
    ]);
    return openCount + closedCount;
  }

  getObjectsCount() {
    return this.page.getByTestId('spacePlugin.object').count();
  }

  getMarkdownTextbox() {
    return this.page.getByTestId('composer.markdownRoot').getByRole('textbox');
  }

  getMarkdownActiveLineText() {
    return this.getMarkdownTextbox()
      .locator('.cm-activeLine > span:not([class=cm-ySelectionCaret])')
      .first()
      .textContent();
  }

  waitForMarkdownTextbox() {
    return this.getMarkdownTextbox().waitFor();
  }

  getDocumentTitleInput() {
    return this.page.getByTestId('composer.documentTitle');
  }

  getObjectLinks() {
    return this.page.getByTestId('spacePlugin.object');
  }

  getCollaboratorCursors() {
    return this.page.locator('.cm-ySelectionInfo');
  }
}
