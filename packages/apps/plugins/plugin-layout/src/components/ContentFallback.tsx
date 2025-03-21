//
// Copyright 2023 DXOS.org
//

import React from 'react';

import { useTranslation } from '@dxos/react-ui';
import { baseSurface, descriptionText, mx } from '@dxos/react-ui-theme';

import { LAYOUT_PLUGIN } from '../types';

export const ContentFallback = () => {
  const { t } = useTranslation(LAYOUT_PLUGIN);

  return (
    <div role='none' className={mx(baseSurface, 'min-bs-screen is-full flex items-center justify-center p-8')}>
      <p role='alert' className='border border-dashed border-neutral-400/50 rounded-xl text-center p-8 max-is-[24rem]'>
        <span className='block font-system-normal text-lg mbe-2'>{t('content fallback message')}</span>
        <span className={mx(descriptionText)}>{t('content fallback description')}</span>
      </p>
    </div>
  );
};
