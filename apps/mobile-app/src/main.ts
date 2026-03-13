import { bootstrapApplication } from '@angular/platform-browser';
import { Amplify } from 'aws-amplify';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId:       environment.amplify.userPoolId,
      userPoolClientId: environment.amplify.userPoolClientId,
    },
  },
});

bootstrapApplication(AppComponent, appConfig).catch(console.error);
