/**
 * Users Lambda Handler
 * Routes: GET /users/me, PUT /users/me, POST /users/me/upload-url
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  verifyToken, unauthorized, ok, created,
  badRequest, notFound, serverError,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3  = new S3Client({});
const TABLE          = process.env['USERS_TABLE']!;
const UPLOADS_BUCKET = process.env['UPLOADS_BUCKET'] ?? '';
const UPLOADS_CDN    = process.env['UPLOADS_CDN_URL'] ?? '';

export interface UserProfile {
  userId: string;          // PK
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  preferences: {
    defaultKey: string;
    defaultTempo: number;
    pitchSensitivity: number;
    theme: 'dark' | 'light';
    notificationsEnabled: boolean;
    dailyGoalMinutes: number;
    instrument: 'tanpura' | 'keyboard' | 'guitar';
  };
  stats: {
    totalSessions: number;
    totalMinutes: number;
    currentStreak: number;
    longestStreak: number;
    overallScore: number;
  };
  favoriteRagas: string[];
  guruCode?: string;        // set if user is a teacher
  photoUrl?: string;        // CloudFront URL to profile photo
}

const DEFAULT_PREFS: UserProfile['preferences'] = {
  defaultKey:           'C',
  defaultTempo:         60,
  pitchSensitivity:     0.85,
  theme:                'dark',
  notificationsEnabled: true,
  dailyGoalMinutes:     20,
  instrument:           'tanpura',
};

const DEFAULT_STATS: UserProfile['stats'] = {
  totalSessions: 0,
  totalMinutes:  0,
  currentStreak: 0,
  longestStreak: 0,
  overallScore:  0,
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await verifyToken(event);
    if (!auth) return unauthorized();

    const method = event.requestContext.http.method;
    if (method === 'OPTIONS') return ok({});

    // GET /users/me
    if (method === 'GET') {
      const result = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { userId: auth.userId },
      }));

      if (result.Item) return ok(result.Item);

      // Auto-provision new user profile on first login
      const now  = new Date().toISOString();
      const profile: UserProfile = {
        userId:       auth.userId,
        email:        auth.email,
        displayName:  auth.username || auth.email.split('@')[0],
        createdAt:    now,
        updatedAt:    now,
        preferences:  DEFAULT_PREFS,
        stats:        DEFAULT_STATS,
        favoriteRagas: [],
      };
      await ddb.send(new PutCommand({ TableName: TABLE, Item: profile }));
      return created(profile);
    }

    // PUT /users/me
    if (method === 'PUT') {
      const body = JSON.parse(event.body ?? '{}');
      const now  = new Date().toISOString();

      const updates: string[] = [];
      const values: Record<string, unknown> = { ':updatedAt': now };
      const names:  Record<string, string>  = {};

      const allowedTopLevel = ['displayName', 'favoriteRagas', 'photoUrl'];
      for (const key of allowedTopLevel) {
        if (body[key] !== undefined) {
          updates.push(`#${key} = :${key}`);
          names[`#${key}`]  = key;
          values[`:${key}`] = body[key];
        }
      }

      if (body.preferences && typeof body.preferences === 'object') {
        for (const [k, v] of Object.entries(body.preferences)) {
          updates.push(`preferences.${k} = :pref_${k}`);
          values[`:pref_${k}`] = v;
        }
      }

      updates.push('#updatedAt = :updatedAt');
      names['#updatedAt'] = 'updatedAt';

      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { userId: auth.userId },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames:  names,
        ExpressionAttributeValues: values,
      }));

      return ok({ updated: true, updatedAt: now });
    }

    // POST /users/me/upload-url — generate presigned S3 upload URL for profile photo
    if (method === 'POST' && event.rawPath.endsWith('/upload-url')) {
      if (!UPLOADS_BUCKET) {
        return serverError(new Error('UPLOADS_BUCKET not configured'));
      }

      const body = JSON.parse(event.body ?? '{}');
      const contentType = body.contentType ?? 'image/jpeg';
      const key = `avatars/${auth.userId}.jpg`;

      const command = new PutObjectCommand({
        Bucket:      UPLOADS_BUCKET,
        Key:         key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
      const cdnUrl = `${UPLOADS_CDN}/${key}`;

      return ok({ uploadUrl, cdnUrl, key });
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
