import { httpClient, HttpMessageBody, HttpMethod, HttpResponse } from '@activepieces/pieces-common';

export class FlowlyticsClient {
    constructor(
        private baseUrl: string,
        private apiKey: string
    ) {}

    private async makeRequest<T extends HttpMessageBody>(
        endpoint: string,
        method: HttpMethod = HttpMethod.GET,
        body?: unknown
    ): Promise<T> {
        const headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };

        const response: HttpResponse<T> = await httpClient.sendRequest<T>({
            method,
            url: `${this.baseUrl}${endpoint}`,
            headers,
            body
        });

        if (response.status >= 400) {
            throw new Error(`Flowlytics API Error: ${response.status}`);
        }

        return response.body;
    }

    async getProjects(): Promise<Project[]> {
        const response = await this.makeRequest<ProjectResponse | ProjectResponse[]>('/api/v1/integrations/projects');
        if (Array.isArray(response)) {
            return response.map(item => item.project);
        }
        return [response.project];
    }

    async getViews(projectId: string | number): Promise<View[]> {
        const response = await this.makeRequest<ViewsResponse>(`/api/v1/integrations/projects/${projectId}/views`);
        return response.views;
    }

    async getViewData(viewId: string | number, params?: { since?: string }) {
        const queryParams = params?.since ? `?since=${params.since}` : '';
        const response = await this.makeRequest<ViewDataResponse>(
            `/api/v1/integrations/views/${viewId}/data${queryParams}`
        );
        return response.data.rows;
    }
}

export interface Project {
    id: number;
    name: string;
    description?: string;
}

// This interface represents the full API response for a single project
interface ProjectResponse {
    project: Project;
}

interface ViewsResponse {
    views: View[];
}

export interface View {
    id: number;
    name: string;
    displayName: string;
}

interface ViewDataResponse {
    data: {
        rows: Record<string, unknown>[];
    };
}
