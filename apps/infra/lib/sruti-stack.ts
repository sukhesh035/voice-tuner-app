import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda  from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integ   from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3      from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam     from 'aws-cdk-lib/aws-iam';

export interface SrutiStackProps extends cdk.StackProps {
  stage:        'dev' | 'prod';
  domainPrefix: string;
}

export class SrutiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SrutiStackProps) {
    super(scope, id, { ...props, stackName: `sruti-${props.stage}` });

    const { stage } = props;
    const prefix     = `sruti-${stage}`;

    // ─── Cognito User Pool ────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName:        `${prefix}-users`,
      selfSignUpEnabled:   true,
      signInAliases:       { email: true },
      autoVerify:          { email: true },
      passwordPolicy: {
        minLength:           8,
        requireLowercase:    true,
        requireUppercase:    false,
        requireDigits:       true,
        requireSymbols:      false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:   stage === 'dev'
        ? cdk.RemovalPolicy.DESTROY
        : cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName:  `${prefix}-web`,
      authFlows: {
        userPassword:      true,
        userSrp:           true,
      },
      preventUserExistenceErrors: true,
    });

    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName:         `${prefix}_identity`,
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [{
        clientId:    userPoolClient.userPoolClientId,
        providerName: userPool.userPoolProviderName,
      }],
    });

    // ─── DynamoDB Tables ─────────────────────────────────────────────────────
    const billingMode = dynamodb.BillingMode.PAY_PER_REQUEST;

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName:     `${prefix}-users`,
      billingMode,
      partitionKey:  { name: 'userId', type: dynamodb.AttributeType.STRING },
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName:     `${prefix}-sessions`,
      billingMode,
      partitionKey:  { name: 'pk',  type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'sk',  type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });
    sessionsTable.addLocalSecondaryIndex({
      indexName:     'mode-index',
      sortKey:       { name: 'mode', type: dynamodb.AttributeType.STRING },
    });

    const streaksTable = new dynamodb.Table(this, 'StreaksTable', {
      tableName:     `${prefix}-streaks`,
      billingMode,
      partitionKey:  { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'sk', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    const classroomTable = new dynamodb.Table(this, 'ClassroomTable', {
      tableName:     `${prefix}-classroom`,
      billingMode,
      partitionKey:  { name: 'sessionCode', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });
    classroomTable.addGlobalSecondaryIndex({
      indexName:     'teacherId-index',
      partitionKey:  { name: 'teacherId', type: dynamodb.AttributeType.STRING },
      sortKey:       { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
      tableName:    `${prefix}-students`,
      billingMode,
      partitionKey: { name: 'sessionCode', type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'studentId',   type: dynamodb.AttributeType.STRING },
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ─── S3 Audio Assets Bucket ───────────────────────────────────────────────
    const audioBucket = new s3.Bucket(this, 'AudioBucket', {
      bucketName:       `${prefix}-audio-assets`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned:         false,
      cors: [{
        allowedOrigins: ['*'],
        allowedMethods: [s3.HttpMethods.GET],
        allowedHeaders: ['*'],
        maxAge: 86400,
      }],
      removalPolicy: stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: stage === 'dev',
    });

    const audioOac = new cloudfront.S3OriginAccessControl(this, 'AudioOAC');
    const audioCdn = new cloudfront.Distribution(this, 'AudioCDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(audioBucket, { originAccessControl: audioOac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    // ─── PWA Web Hosting ─────────────────────────────────────────────────────
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName:        `${prefix}-web`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned:         false,
      removalPolicy:     stage === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: stage === 'dev',
    });

    const webOac = new cloudfront.S3OriginAccessControl(this, 'WebOAC');
    const webCdn = new cloudfront.Distribution(this, 'WebCDN', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket, { originAccessControl: webOac }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,   // SPA: never cache HTML
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress:             true,
      },
      errorResponses: [
        // SPA fallback — all 403/404 → index.html (Angular router handles the route)
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
    });

    // ─── Lambda Functions ─────────────────────────────────────────────────────
    const commonEnv: Record<string, string> = {
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID:    userPoolClient.userPoolClientId,
      USERS_TABLE:          usersTable.tableName,
      SESSIONS_TABLE:       sessionsTable.tableName,
      STREAKS_TABLE:        streaksTable.tableName,
      CLASSROOM_TABLE:      classroomTable.tableName,
      STUDENTS_TABLE:       studentsTable.tableName,
      // Allow requests from the PWA CloudFront domain; dev stays open
      CORS_ORIGIN: stage === 'prod'
        ? `https://${webCdn.distributionDomainName}`
        : '*',
    };

    const lambdaDefaults: Partial<lambda.FunctionProps> = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: { minify: true, sourceMap: false, target: 'node22' },
    } as Partial<lambda.FunctionProps>;

    // Use NodejsFunction for bundling
    const handlerDir = path.join(__dirname, '../../backend-api/src/handlers');

    const makeFn = (id: string, entry: string) =>
      new lambda.Function(this, id, {
        ...lambdaDefaults as lambda.FunctionProps,
        handler: 'handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../../../dist/apps/backend-api'),
        ),
        functionName: `${prefix}-${entry}`,
      });

    const sessionsLambda  = makeFn('SessionsFn',  'sessions');
    const usersLambda     = makeFn('UsersFn',     'users');
    const streaksLambda   = makeFn('StreaksFn',   'streaks');
    const classroomLambda = makeFn('ClassroomFn', 'classroom');

    // Grant DynamoDB permissions
    usersTable.grantReadWriteData(sessionsLambda);
    usersTable.grantReadWriteData(usersLambda);
    usersTable.grantReadWriteData(streaksLambda);
    sessionsTable.grantReadWriteData(sessionsLambda);
    streaksTable.grantReadWriteData(streaksLambda);
    classroomTable.grantReadWriteData(classroomLambda);
    studentsTable.grantReadWriteData(classroomLambda);

    // ─── HTTP API Gateway ─────────────────────────────────────────────────────
    const api = new apigwv2.HttpApi(this, 'SrutiApi', {
      apiName:        `${prefix}-api`,
      corsPreflight: {
        allowHeaders:  ['Content-Type', 'Authorization'],
        allowMethods:  [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins:  stage === 'prod' ? ['https://app.sruti.in'] : ['*'],
        maxAge:         cdk.Duration.days(1),
      },
    });

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoJwt',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience:    [userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    );

    const addRoute = (
      methods: apigwv2.HttpMethod[],
      path:    string,
      fn:      lambda.Function,
    ) => {
      api.addRoutes({
        methods,
        path,
        integration:  new integ.HttpLambdaIntegration(`${fn.node.id}-integ`, fn),
        authorizer:   jwtAuthorizer,
      });
    };

    addRoute([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/api/sessions',          sessionsLambda);
    addRoute([apigwv2.HttpMethod.GET],                          '/api/sessions/{id}',     sessionsLambda);
    addRoute([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],  '/api/users/me',          usersLambda);
    addRoute([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], '/api/streaks',            streaksLambda);
    addRoute([apigwv2.HttpMethod.POST],                         '/api/streaks/checkin',   streaksLambda);
    addRoute([apigwv2.HttpMethod.POST],                         '/api/classroom/sessions',      classroomLambda);
    addRoute([apigwv2.HttpMethod.GET, apigwv2.HttpMethod.DELETE], '/api/classroom/sessions/{code}', classroomLambda);
    addRoute([apigwv2.HttpMethod.POST],                         '/api/classroom/join',    classroomLambda);
    addRoute([apigwv2.HttpMethod.PUT],                          '/api/classroom/sessions/{code}/result', classroomLambda);

    // ─── Outputs (read by CI to generate environment.ts) ─────────────────────
    new cdk.CfnOutput(this, 'ApiUrl',              { value: api.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId',          { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId',    { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'IdentityPoolId',      { value: identityPool.ref });
    new cdk.CfnOutput(this, 'AudioCdnUrl',         { value: `https://${audioCdn.distributionDomainName}` });
    new cdk.CfnOutput(this, 'WebUrl',              { value: `https://${webCdn.distributionDomainName}` });
    new cdk.CfnOutput(this, 'WebBucketName',       { value: webBucket.bucketName });
    new cdk.CfnOutput(this, 'WebDistributionId',   { value: webCdn.distributionId });
    new cdk.CfnOutput(this, 'AwsRegion',           { value: this.region });
  }
}
