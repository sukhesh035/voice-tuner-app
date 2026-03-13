/**
 * Classroom Lambda Handler
 * Routes:
 *   POST   /classroom/sessions       — Teacher creates a live classroom session
 *   GET    /classroom/sessions/:code — Get session info + student list
 *   POST   /classroom/join           — Student joins via session code
 *   PUT    /classroom/sessions/:code/result — Student submits result
 *   DELETE /classroom/sessions/:code — Teacher ends session
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  QueryCommand, UpdateCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { generateSessionCode } from '@voice-tuner/shared-utils';
import {
  verifyToken, unauthorized, ok, created,
  badRequest, notFound, serverError,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CLASSROOM_TABLE = process.env['CLASSROOM_TABLE']!;
const STUDENTS_TABLE  = process.env['STUDENTS_TABLE']!;

export interface ClassroomSession {
  sessionCode: string;    // PK
  teacherId:   string;
  teacherName: string;
  raagaId?:    string;
  key:         string;
  tempo:       number;
  createdAt:   string;
  expiresAt:   string;    // ISO; auto-delete after 24h
  isActive:    boolean;
  studentCount: number;
  ttl:          number;
}

export interface StudentResult {
  sessionCode: string;   // PK
  studentId:   string;   // SK
  studentName: string;
  joinedAt:    string;
  score?:      number;
  accuracy?:   number;
  submitted:   boolean;
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await verifyToken(event);
    if (!auth) return unauthorized();

    const method   = event.requestContext.http.method;
    const rawPath  = event.rawPath;
    const code     = event.pathParameters?.['code'];

    if (method === 'OPTIONS') return ok({});

    // POST /classroom/sessions — create new classroom session
    if (method === 'POST' && rawPath.endsWith('/sessions')) {
      const body = JSON.parse(event.body ?? '{}');
      const sessionCode = generateSessionCode();
      const now         = new Date();
      const expiry      = new Date(now.getTime() + 24 * 3600 * 1000);

      const session: ClassroomSession = {
        sessionCode,
        teacherId:    auth.userId,
        teacherName:  body.teacherName ?? auth.username,
        raagaId:      body.raagaId,
        key:          body.key     ?? 'C',
        tempo:        body.tempo   ?? 60,
        createdAt:    now.toISOString(),
        expiresAt:    expiry.toISOString(),
        isActive:     true,
        studentCount: 0,
        ttl: Math.floor(expiry.getTime() / 1000),
      };

      await ddb.send(new PutCommand({ TableName: CLASSROOM_TABLE, Item: session }));
      return created({ sessionCode, expiresAt: expiry.toISOString() });
    }

    // GET /classroom/sessions/:code — session info + students
    if (method === 'GET' && code) {
      const [sessionRes, studentsRes] = await Promise.all([
        ddb.send(new GetCommand({
          TableName: CLASSROOM_TABLE,
          Key: { sessionCode: code },
        })),
        ddb.send(new QueryCommand({
          TableName: STUDENTS_TABLE,
          KeyConditionExpression: 'sessionCode = :code',
          ExpressionAttributeValues: { ':code': code },
        })),
      ]);

      if (!sessionRes.Item) return notFound('Classroom session');
      return ok({ session: sessionRes.Item, students: studentsRes.Items ?? [] });
    }

    // POST /classroom/join — student joins
    if (method === 'POST' && rawPath.endsWith('/join')) {
      const body = JSON.parse(event.body ?? '{}');
      const sessionCode: string = body.sessionCode;
      if (!sessionCode) return badRequest('sessionCode required');

      const sessionRes = await ddb.send(new GetCommand({
        TableName: CLASSROOM_TABLE,
        Key: { sessionCode },
      }));
      if (!sessionRes.Item) return notFound('Classroom session');
      if (!sessionRes.Item['isActive']) return badRequest('Session is no longer active');

      const student: StudentResult = {
        sessionCode,
        studentId:   auth.userId,
        studentName: body.studentName ?? auth.username,
        joinedAt:    new Date().toISOString(),
        submitted:   false,
      };

      await Promise.all([
        ddb.send(new PutCommand({ TableName: STUDENTS_TABLE, Item: student })),
        ddb.send(new UpdateCommand({
          TableName: CLASSROOM_TABLE,
          Key: { sessionCode },
          UpdateExpression: 'ADD studentCount :one',
          ExpressionAttributeValues: { ':one': 1 },
        })),
      ]);

      return ok({
        sessionCode,
        key:     sessionRes.Item['key'],
        tempo:   sessionRes.Item['tempo'],
        raagaId: sessionRes.Item['raagaId'],
      });
    }

    // PUT /classroom/sessions/:code/result — student submits result
    if (method === 'PUT' && code) {
      const body = JSON.parse(event.body ?? '{}');
      await ddb.send(new UpdateCommand({
        TableName: STUDENTS_TABLE,
        Key: { sessionCode: code, studentId: auth.userId },
        UpdateExpression: 'SET score = :s, accuracy = :a, submitted = :t, submittedAt = :at',
        ExpressionAttributeValues: {
          ':s':  body.score    ?? 0,
          ':a':  body.accuracy ?? 0,
          ':t':  true,
          ':at': new Date().toISOString(),
        },
      }));
      return ok({ submitted: true });
    }

    // DELETE /classroom/sessions/:code — teacher ends session
    if (method === 'DELETE' && code) {
      const sessionRes = await ddb.send(new GetCommand({
        TableName: CLASSROOM_TABLE,
        Key: { sessionCode: code },
      }));
      if (!sessionRes.Item) return notFound('Classroom session');
      if (sessionRes.Item['teacherId'] !== auth.userId) return unauthorized();

      await ddb.send(new UpdateCommand({
        TableName: CLASSROOM_TABLE,
        Key: { sessionCode: code },
        UpdateExpression: 'SET isActive = :f',
        ExpressionAttributeValues: { ':f': false },
      }));
      return ok({ ended: true });
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
