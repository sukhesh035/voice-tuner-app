#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SwaraStack } from '../lib/swara-stack';
import { AdminApiStack } from '../lib/admin-api-stack';

const app = new cdk.App();

const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region:  process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
};

// Development stack
new SwaraStack(app, 'SwaraStackDev', {
  env,
  stage: 'dev',
  domainPrefix: 'swara-dev',
});

// Admin API stack — standalone admin-api Lambda + API Gateway for user CRUD
new AdminApiStack(app, 'AdminApiStackDev', { env, stage: 'dev' });

// Production stack (deployed from CI only)
if (process.env['DEPLOY_PROD'] === '1') {
  new SwaraStack(app, 'SwaraStackProd', {
    env,
    stage: 'prod',
    domainPrefix: 'swara',
  });
  new AdminApiStack(app, 'AdminApiStackProd', { env, stage: 'prod' });
}
