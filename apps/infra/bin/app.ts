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

// Standalone deploy flags. `cdk deploy` synthesizes the entire app (all
// stacks), and each stack binds its Lambdas to a different dist/ dir
// (SwaraStack* → dist/apps/backend-api, AdminApiStack* → dist/apps/admin-api).
// A workflow that only builds one app must NOT instantiate stacks whose asset
// it never built, or synth fails on a fresh checkout.
const DEPLOY_ADMIN_API_DEV  = process.env['DEPLOY_ADMIN_API_DEV'] === '1';
const DEPLOY_ADMIN_API_PROD = process.env['DEPLOY_ADMIN_API_PROD'] === '1';

// Main stack (dev) — deployed via `pnpm infra:deploy`; skipped when only the
// standalone AdminApiStack is being deployed (its backend-api asset isn't built).
if (!DEPLOY_ADMIN_API_DEV && !DEPLOY_ADMIN_API_PROD) {
  new SwaraStack(app, 'SwaraStackDev', {
    env,
    stage: 'dev',
    domainPrefix: 'swara-dev',
    emailFrom: process.env['SES_FROM_EMAIL'] ?? 'swara.ai.support@gmail.com',
  });
}

// Admin API stack — standalone admin-api Lambda + API Gateway for user CRUD
new AdminApiStack(app, 'AdminApiStackDev', { env, stage: 'dev' });

if (process.env['DEPLOY_PROD'] === '1') {
  new SwaraStack(app, 'SwaraStackProd', {
    env,
    stage: 'prod',
    domainPrefix: 'swara',
    emailFrom: process.env['SES_FROM_EMAIL'] ?? 'swara.ai.support@gmail.com',
  });
}
if (DEPLOY_ADMIN_API_PROD) {
  new AdminApiStack(app, 'AdminApiStackProd', { env, stage: 'prod' });
}
