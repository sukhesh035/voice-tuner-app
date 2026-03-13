#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SrutiStack } from '../lib/sruti-stack';

const app = new cdk.App();

const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region:  process.env['CDK_DEFAULT_REGION'] ?? 'ap-south-1',
};

// Development stack
new SrutiStack(app, 'SrutiStackDev', {
  env,
  stage: 'dev',
  domainPrefix: 'sruti-dev',
});

// Production stack (deployed from CI only)
if (process.env['DEPLOY_PROD'] === '1') {
  new SrutiStack(app, 'SrutiStackProd', {
    env,
    stage: 'prod',
    domainPrefix: 'sruti',
  });
}
