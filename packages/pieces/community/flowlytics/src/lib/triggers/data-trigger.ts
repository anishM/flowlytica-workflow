import { 
    createTrigger, 
    TriggerStrategy, 
    Property 
} from '@activepieces/pieces-framework';
import { FlowlyticsClient } from '../client';
import { flowlyticsAuth } from '../auth';

type AuthValue = { baseUrl: string, apiKey: string };

export const flowlyticsDataTrigger = createTrigger({
    name: 'flowlytics_data_trigger',
    displayName: 'Flowlytics Data Trigger',
    description: 'Triggers when new data is available in a selected Flowlytics view',
    auth: flowlyticsAuth,
    type: TriggerStrategy.POLLING,
    props: {
        projectId: Property.Dropdown({
            displayName: 'Project',
            required: true,
            refreshers: [],
            options: async ({ auth }) => {
                if (!auth) {
                    return {
                        disabled: true,
                        options: [],
                        placeholder: 'Please authenticate first'
                    };
                }
                const { baseUrl, apiKey } = auth as AuthValue;
                const client = new FlowlyticsClient(baseUrl, apiKey);
                const projects = await client.getProjects();
                return {
                    options: projects.map(project => ({
                        label: project.name,
                        value: project.id
                    }))
                };
            }
        }),
        viewId: Property.Dropdown({
            displayName: 'View',
            required: true,
            refreshers: ['projectId'],
            options: async ({ auth, projectId }) => {
                if (!auth || !projectId) {
                    return {
                        disabled: true,
                        options: [],
                        placeholder: 'Please authenticate and select a project'
                    };
                }
                const { baseUrl, apiKey } = auth as AuthValue;
                const client = new FlowlyticsClient(baseUrl, apiKey);
                const views = await client.getViews(projectId as string | number);
                return {
                    options: views.map(view => ({
                        label: view.displayName,
                        value: view.id
                    }))
                };
            }
        })
    },
    sampleData: {
        records: [
            {
                id: 'sample-record-id-1',
                created_date: '2024-01-01T00:00:00Z',
            },
            {
                id: 'sample-record-id-2',
                created_date: '2024-01-02T00:00:00Z',
            }
        ]
    },
    async onEnable(context) {
        await context.store.put('lastCheck', new Date().toISOString());
    },
    async onDisable(context) {
        await context.store.delete('lastCheck');
    },
    async run(context) {
        const { auth, propsValue, store } = context;
        const { baseUrl, apiKey } = auth;
        const client = new FlowlyticsClient(baseUrl, apiKey);

        const lastCheck = await store.get<string>('lastCheck');
        
        const data = await client.getViewData(
            propsValue.viewId,
            lastCheck ? { since: lastCheck } : undefined
        );

        await store.put('lastCheck', new Date().toISOString());

        // Return as a single object with records array
        return [{ records: data }];
    },
    async test(context) {
        const { auth, propsValue } = context;
        const { baseUrl, apiKey } = auth as AuthValue;
        const client = new FlowlyticsClient(baseUrl, apiKey);

        const data = await client.getViewData(propsValue.viewId);

        // Return as a single object with records array
        return [{ records: data }];
    }
});