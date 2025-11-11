import { PieceAuth, Property } from '@activepieces/pieces-framework';

export const flowlyticsAuth = PieceAuth.CustomAuth({
    description: 'Authentication for Flowlytics API',
    required: true,
    props: {
        baseUrl: Property.ShortText({
            displayName: 'Base URL',
            description: 'The base URL of your Flowlytics API (e.g., http://localhost:3000/api/v1)',
            required: true,
        }),
        apiKey: PieceAuth.SecretText({
            displayName: 'API Key',
            description: 'Your Flowlytics API key for authentication',
            required: true,
        }),
    },
});
