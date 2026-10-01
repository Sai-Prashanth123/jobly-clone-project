// Lambda entry point.
//
// server.ts stays the entry point for a long-running container (Render, local
// dev); this one wraps the same Express app for API Gateway. Nothing about the
// app changes - app.ts is already separate from server.ts, so the routes,
// middleware and error handling are shared verbatim.
//
// Two event shapes arrive here:
//   - API Gateway HTTP API (payload v2) -> proxied into Express
//   - EventBridge scheduled rule        -> runs the daily tick
//
// The scheduler is the reason for that second branch: server.ts boots
// node-cron, which needs a process that stays alive. A Lambda is frozen
// between invocations, so cron would simply never fire and the recurring
// invoice reminders, contract-expiry alerts and leave-return reactivations
// would stop silently. EventBridge replaces the timer; runDailyTick() is
// already exported for the admin "Run now" button, so it is reused as-is.
import serverless from 'serverless-http';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
  EventBridgeEvent,
} from 'aws-lambda';
import { app } from './app';
import { runDailyTick } from './jobs/scheduler';

// Responses whose bodies are not UTF-8 text must be base64-encoded on the way
// back through API Gateway, or the bytes get mangled. These are the types this
// API actually returns: generated PDFs, Word exports and spreadsheets.
// text/csv is deliberately absent - it is text, and encoding it would only
// make the download unreadable.
const BINARY_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/zip',
  'image/*',
];

const proxy = serverless(app, { binary: BINARY_TYPES });

process.on('unhandledRejection', reason => {
  // Deliberately no process.exit() here, unlike server.ts: killing the process
  // would take down a container that Lambda may still be using for other
  // in-flight requests. Log it and let Lambda decide.
  //
  // Note this does NOT stop the AWS runtime aborting the invocation. The
  // runtime installs its own listener and ours does not displace it, so
  // production still shows Runtime.UnhandledPromiseRejection followed by
  // "LAMBDA_RUNTIME Failed to post handler success response". The value here is
  // the log line naming the reason, which is otherwise lost.
  console.error('[unhandledRejection]', reason);
});

// server.ts had this and lambda.ts did not, so a synchronous throw outside the
// Express error path left only the runtime's own terse message with no stack of
// ours — which is how several "internal server error" reports had nothing in
// CloudWatch to explain them. Same reasoning as above: log, never exit.
process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
});

function isScheduledEvent(event: unknown): event is EventBridgeEvent<string, unknown> {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { source?: string }).source === 'aws.events'
  );
}

export const handler = async (
  event: APIGatewayProxyEventV2 | EventBridgeEvent<string, unknown>,
  context: Context,
): Promise<APIGatewayProxyResultV2 | { ok: boolean; reactivated?: number; error?: string }> => {
  // The pg pool keeps idle sockets open, so the event loop is never empty.
  // Without this the invocation hangs until it times out instead of returning
  // as soon as the response is ready.
  context.callbackWaitsForEmptyEventLoop = false;

  if (isScheduledEvent(event)) {
    console.log('[scheduler] daily tick start', new Date().toISOString());
    try {
      const result = await runDailyTick();
      console.log('[scheduler] daily tick done', result);
      return { ok: true, ...result };
    } catch (err) {
      // Returning rather than throwing keeps one bad tick from tripping
      // EventBridge's retry-and-alarm path; the error is in the log either way.
      console.error('[scheduler] daily tick failed', err);
      return { ok: false, error: (err as Error).message };
    }
  }

  return proxy(event, context) as Promise<APIGatewayProxyResultV2>;
};
