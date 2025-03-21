//
// Copyright 2023 DXOS.org
//

import '@dxosTheme';

import React from 'react';

import { Invitation } from '@dxos/react-client/invitations';
import { Tooltip } from '@dxos/react-ui';

import { InvitationList } from './InvitationList';
import { inviteWithState } from '../../testing/fixtures/invitations';

export default {
  component: InvitationList,
  actions: { argTypesRegex: '^on.*' },
};

export const Normal = () => {
  return (
    <Tooltip.Provider>
      <InvitationList
        invitations={[
          inviteWithState(Invitation.State.INIT),
          inviteWithState(Invitation.State.CONNECTING),
          inviteWithState(Invitation.State.CONNECTED),
          inviteWithState(Invitation.State.READY_FOR_AUTHENTICATION),
          inviteWithState(Invitation.State.AUTHENTICATING),
          inviteWithState(Invitation.State.SUCCESS),
          inviteWithState(Invitation.State.TIMEOUT),
          inviteWithState(Invitation.State.ERROR),
          inviteWithState(Invitation.State.CANCELLED),
        ]}
        send={() => {}}
        createInvitationUrl={(invite) => invite}
      />
    </Tooltip.Provider>
  );
};
