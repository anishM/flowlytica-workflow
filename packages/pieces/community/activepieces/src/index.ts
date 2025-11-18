import {
  createPiece,
  PieceAuth,
  Property,
} from '@activepieces/pieces-framework';
import { createProject } from './lib/actions/create-project';
import { listProject } from './lib/actions/list-project';
import { updateProject } from './lib/actions/update-project';
import { createCustomApiCallAction } from '@activepieces/pieces-common';

const markdown = `
Activepieces Platform API is available under the Platform Edition.
(https://www.flowlytics.com/docs/admin-console/overview)

**Note**: The API Key is available in the Platform Dashboard.

`;

export const activePieceAuth = PieceAuth.CustomAuth({
  description: markdown,
  required: true,
  props: {
    baseApiUrl: Property.ShortText({
      displayName: 'Base URL',
      required: true,
      defaultValue: 'https://cloud.flowlytics.com/api/v1',
    }),
    apiKey: PieceAuth.SecretText({
      displayName: 'API Key',
      required: true,
    }),
  },
});

export const activepieces = createPiece({
  displayName: 'Activepieces Platform',
  description: 'Open source no-code business automation',
  auth: activePieceAuth,
  minimumSupportedRelease: '0.30.0',
  logoUrl: '/images/pieces/activepieces.png',
  authors: ['doskyft', 'abuaboud', 'AdamSelene'],
  actions: [
    createProject,
    updateProject,
    listProject,
    createCustomApiCallAction({
      baseUrl: (auth) => {
        return `${(auth as { baseApiUrl: string }).baseApiUrl}`;
      },
      auth: activePieceAuth,
      authMapping: async (auth) => ({
        Authorization: `Bearer ${(auth as { apiKey: string }).apiKey}`,
      }),
    }),
  ],
  triggers: [],
});
