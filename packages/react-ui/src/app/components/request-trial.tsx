import { t } from 'i18next';

export type FeatureKey =
  | 'PROJECTS'
  | 'BRANDING'
  | 'PIECES'
  | 'TEMPLATES'
  | 'TEAM'
  | 'GLOBAL_CONNECTIONS'
  | 'USERS'
  | 'API'
  | 'SSO'
  | 'AUDIT_LOGS'
  | 'ENVIRONMENT'
  | 'ISSUES'
  | 'ANALYTICS'
  | 'ALERTS'
  | 'ENTERPRISE_PIECES'
  | 'UNIVERSAL_AI'
  | 'SIGNING_KEYS'
  | 'CUSTOM_ROLES'
  | 'AGENTS'
  | 'TABLES'
  | 'TODOS'
  | 'MCPS';

type RequestTrialProps = {
  featureKey: FeatureKey;
  customButton?: React.ReactNode;
  buttonVariant?: 'default' | 'outline-primary';
};

export const RequestTrial = (_props: RequestTrialProps) => {
  return (
    <p className="text-sm text-muted-foreground text-center max-w-md">
      {t('Flowlytics Community Feature Locked Message')}
    </p>
  );
};
