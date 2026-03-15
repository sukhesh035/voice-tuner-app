/**
 * Streaks Lambda Handler
 * Routes: GET /streaks, POST /streaks/checkin
 * Tracks daily practice streaks and milestone badges.
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand,
  QueryCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  verifyToken, unauthorized, ok, created, badRequest, serverError,
} from '../middleware/auth.middleware';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const STREAKS_TABLE = process.env['STREAKS_TABLE']!;
const USERS_TABLE   = process.env['USERS_TABLE']!;

const MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

function getDateStr(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const auth = await verifyToken(event);
    if (!auth) return unauthorized();

    const method = event.requestContext.http.method;
    if (method === 'OPTIONS') return ok({});

    // GET /streaks — last 30 days of practice days + current streak
    if (method === 'GET') {
      const today   = getDateStr();
      const cutoff  = getDateStr(new Date(Date.now() - 30 * 24 * 3600 * 1000));

      const result = await ddb.send(new QueryCommand({
        TableName: STREAKS_TABLE,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk':   auth.userId,
          ':from': cutoff,
          ':to':   today,
        },
        ScanIndexForward: false,
      }));

      // Compute rolling current streak from today backwards
      const days = (result.Items ?? []).map((i: Record<string, unknown>) => i['sk'] as string).sort().reverse();
      let streak = 0;
      let check  = today;
      for (const day of days) {
        if (day === check) {
          streak++;
          const d = new Date(check);
          d.setDate(d.getDate() - 1);
          check = getDateStr(d);
        } else break;
      }

      return ok({ streak, practiceDays: days, milestones: MILESTONES });
    }

    // POST /streaks/checkin — record today's practice
    if (method === 'POST') {
      const body     = JSON.parse(event.body ?? '{}');
      const today    = getDateStr();
      const duration = body.durationMinutes ?? 0;
      const score    = typeof body.score === 'number' ? body.score : null;

      // Upsert today's record
      await ddb.send(new PutCommand({
        TableName:           STREAKS_TABLE,
        ConditionExpression: 'attribute_not_exists(pk)',
        Item: {
          pk:              auth.userId,
          sk:              today,
          durationMinutes: duration,
          sessionsCount:   1,
          recordedAt:      new Date().toISOString(),
        },
      })).catch(async () => {
        // Already checked in today — just increment duration
        await ddb.send(new UpdateCommand({
          TableName: STREAKS_TABLE,
          Key: { pk: auth.userId, sk: today },
          UpdateExpression: 'ADD durationMinutes :d, sessionsCount :one',
          ExpressionAttributeValues: { ':d': duration, ':one': 1 },
        }));
      });

      // Recompute streak and update user stats
      const recentDays = await ddb.send(new QueryCommand({
        TableName: STREAKS_TABLE,
        KeyConditionExpression: 'pk = :pk AND sk <= :today',
        ExpressionAttributeValues: { ':pk': auth.userId, ':today': today },
        ScanIndexForward: false,
        Limit: 365,
      }));

      const sorted = (recentDays.Items ?? []).map((i: Record<string, unknown>) => i['sk'] as string).sort().reverse();
      let currentStreak = 0;
      let check = today;
      for (const day of sorted) {
        if (day === check) {
          currentStreak++;
          const d = new Date(check);
          d.setDate(d.getDate() - 1);
          check = getDateStr(d);
        } else break;
      }

      // Read current user stats so we can compute longestStreak and overallScore
      let prevTotalSessions = 0;
      let prevOverallScore  = 0;
      let prevLongestStreak = 0;
      try {
        const userResult = await ddb.send(new GetCommand({
          TableName: USERS_TABLE,
          Key: { userId: auth.userId },
          ProjectionExpression: 'stats',
        }));
        const stats = (userResult.Item as Record<string, any>)?.stats;
        if (stats) {
          prevTotalSessions = stats.totalSessions ?? 0;
          prevOverallScore  = stats.overallScore  ?? 0;
          prevLongestStreak = stats.longestStreak  ?? 0;
        }
      } catch (err) { console.warn('[checkin] Failed to read prev user stats, using defaults:', err); }

      // Compute new overallScore as a running average across all sessions.
      // Formula: newAvg = (oldAvg * oldCount + newScore) / (oldCount + 1)
      const newTotalSessions = prevTotalSessions + 1;
      const newOverallScore = score != null
        ? Math.round(((prevOverallScore * prevTotalSessions) + score) / newTotalSessions)
        : prevOverallScore;

      const newLongestStreak = Math.max(prevLongestStreak, currentStreak);

      // Persist updated stats to user record
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: auth.userId },
        UpdateExpression: `
          SET stats.currentStreak = :cs,
              stats.totalMinutes  = stats.totalMinutes + :dur,
              stats.totalSessions = stats.totalSessions + :one,
              stats.longestStreak = :ls,
              stats.overallScore  = :os
        `,
        ConditionExpression: 'attribute_exists(userId)',
        ExpressionAttributeValues: {
          ':cs':  currentStreak,
          ':dur': duration,
          ':one': 1,
          ':ls':  newLongestStreak,
          ':os':  newOverallScore,
        },
      })).catch((err) => { console.error('[checkin] Failed to update user stats:', err); });

      const newMilestone = MILESTONES.filter((m) => m === currentStreak)?.[0] ?? null;
      return ok({ currentStreak, newMilestone, today });
    }

    return badRequest('Unknown route');
  } catch (err) {
    return serverError(err);
  }
};
