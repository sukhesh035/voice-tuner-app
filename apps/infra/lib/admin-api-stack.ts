import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integ from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AdminApiStackProps extends cdk.StackProps {
  stage: 'dev' | 'prod';
}

export class AdminApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AdminApiStackProps) {
    super(scope, id, { ...props, stackName: `swara-${props.stage}-admin-api` });
    const { stage } = props;
    const prefix = `swara-${stage}-admin-api`;

    // Reference the existing users table (lives in the main SwaraStack — never
    // redeclared here). Its SSM parameter was written by the main stack.
    const usersTable = dynamodb.Table.fromTableName(
      this,
      'UsersTable',
      `swara-${stage}-users`,
    );

    const feedbackTable = dynamodb.Table.fromTableName(
      this,
      'FeedbackTable',
      `swara-${stage}-feedback`,
    );

    const sessionsTable = dynamodb.Table.fromTableName(
      this,
      'SessionsTable',
      `swara-${stage}-sessions`,
    );

    const analyticsTable = dynamodb.Table.fromTableName(
      this,
      'AnalyticsTable',
      `swara-${stage}-analytics`,
    );

    // The token verifier validates against the same Cognito pool/client the
    // main stack provisions. The main stack publishes their IDs to SSM so we
    // can reference them without a hardcoded value.
    const poolId = ssm.StringParameter.fromStringParameterName(
      this,
      'UserPoolId',
      `/swara-${stage}/cognito/user-pool-id`,
    ).stringValue;
    const clientId = ssm.StringParameter.fromStringParameterName(
      this,
      'UserPoolClientId',
      `/swara-${stage}/cognito/user-pool-client-id`,
    ).stringValue;

    const distDir = path.join(__dirname, '../../../dist/apps/admin-api');

    const handler = new lambda.Function(this, 'AdminApiFn', {
      functionName: `${prefix}-handler`,
      runtime:      lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler:      'handler.handler',
      code:         lambda.Code.fromAsset(distDir),
      memorySize:   256,
      timeout:      cdk.Duration.seconds(10),
      environment: {
        USERS_TABLE:          usersTable.tableName,
        FEEDBACK_TABLE:       feedbackTable.tableName,
        SESSIONS_TABLE:       sessionsTable.tableName,
        ANALYTICS_TABLE:      analyticsTable.tableName,
        COGNITO_USER_POOL_ID: poolId,
        COGNITO_CLIENT_ID:    clientId,
        CORS_ORIGIN:          '*',
        STAGE:                stage,
      },
    });

    usersTable.grantReadWriteData(handler);
    feedbackTable.grantReadData(handler);
    sessionsTable.grantReadData(handler);
    analyticsTable.grantReadData(handler);

    // The analytics endpoint reads the firebase service account (notifications
    // SA) and the GA4 property id from SSM. Read-only GetParameter on the two
    // exact param ARNs, mirroring the main stack's notifications Lambda grant.
    handler.addToRolePolicy(new iam.PolicyStatement({
      actions:   ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/swara-${stage}/firebase-sa-key`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/swara-${stage}/ga4-property-id`,
      ],
    }));

    // The API Gateway routes are intentionally unauthenticated — the Lambda
    // enforces the service token itself (no JWT authorizer needed).
    const api = new apigwv2.HttpApi(this, 'AdminApi', {
      apiName: `${prefix}-api`,
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge:       cdk.Duration.days(1),
      },
    });

    const integFn = new integ.HttpLambdaIntegration('AdminInteg', handler);
    api.addRoutes({
      path: '/{proxy+}',
      methods: [apigwv2.HttpMethod.ANY],
      integration: integFn,
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
  }
}
