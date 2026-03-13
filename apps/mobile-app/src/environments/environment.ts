export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  amplify: {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_XXXXXXXXX',       // Replace with your Cognito User Pool ID
    userPoolClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX', // Replace with your App Client ID
    identityPoolId: 'ap-south-1:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
  },
  s3: {
    bucket: 'sruti-audio-assets-dev',
    region: 'ap-south-1',
    baseUrl: 'https://sruti-audio-assets-dev.s3.ap-south-1.amazonaws.com',
  },
  featureFlags: {
    aiCoach: true,
    guruClassroom: true,
    offlineMode: true,
  },
};
