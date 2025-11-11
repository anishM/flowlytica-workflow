import { createPiece } from '@activepieces/pieces-framework';
import { flowlyticsAuth } from './lib/auth';
import { flowlyticsDataTrigger } from './lib/triggers/data-trigger';

export const flowlytics = createPiece({
    displayName: 'Flowlytics',
    logoUrl: '/images/flowlytics-favicon.svg',
    minimumSupportedRelease: '0.5.0',
    authors: ['Flowlytics'],
    auth: flowlyticsAuth,
    triggers: [flowlyticsDataTrigger],
    actions: [],
});