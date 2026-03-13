export const environment = {
  production: true,
  apiBaseUrl: 'https://api.sruti.app/v1',
  amplify: {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_XXXXXXXXX',       // Set via CI/CD secret injection
    userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
    identityPoolId: 'ap-south-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  },
  s3: {
    bucket: 'sruti-audio-assets-prod',
    region: 'ap-south-1',
    baseUrl: 'https://d1234567890.cloudfront.net',
  },
  featureFlags: {
    aiCoach: true,
    guruClassroom: true,
    offlineMode: true,
  },
};
