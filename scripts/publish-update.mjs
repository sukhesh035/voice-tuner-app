#!/usr/bin/env node
/**
 * publish-update.mjs
 *
 * Zips the production Angular build, uploads it to the live-update S3 bucket,
 * writes a manifest.json the native app uses to discover new versions, then
 * invalidates the CloudFront cache so devices see the update immediately.
 *
 * Usage:
 *   node scripts/publish-update.mjs <stage> <version>
 *   stage:   "dev" | "prod"
 *   version: semver string, e.g. "1.3.0"
 *
 * Requires AWS credentials in the environment.
 */

import { execSync } from 'child_process';
import { createWriteStream, existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// ── Args ────────────────────────────────────────────────────────────────────
const stage   = process.argv[2];
const version = process.argv[3];

if (!['dev', 'prod'].includes(stage) || !version) {
  console.error('Usage: node scripts/publish-update.mjs <dev|prod> <version>');
  process.exit(1);
}

const region    = process.env['AWS_REGION'] ?? 'us-east-1';
const stackName = `swara-${stage}`;

// ── Read CDK outputs ────────────────────────────────────────────────────────
console.log(`\nReading stack outputs from ${stackName}...\n`);

let rawOutputs;
try {
  const result = execSync(
    `aws cloudformation describe-stacks --stack-name ${stackName} --region ${region} --query "Stacks[0].Outputs" --output json`,
    { encoding: 'utf8' },
  );
  rawOutputs = JSON.parse(result);
} catch (err) {
  console.error(`Failed to read stack outputs: ${err.message}`);
  process.exit(1);
}

const out = {};
for (const { OutputKey, OutputValue } of rawOutputs) {
  out[OutputKey] = OutputValue;
}

const bucket         = out['UpdatesBucketName'];
const distributionId = out['UpdatesDistributionId'];
const cdnUrl         = out['UpdatesCdnUrl'];

if (!bucket || !distributionId || !cdnUrl) {
  console.error('Missing UpdatesBucketName / UpdatesDistributionId / UpdatesCdnUrl in stack outputs.');
  console.error('Did you deploy the latest CDK stack?');
  process.exit(1);
}

// ── Zip the build output ────────────────────────────────────────────────────
const buildDir = resolve(__dirname, '../dist/apps/mobile-app/browser');
if (!existsSync(buildDir)) {
  console.error(`Build directory not found: ${buildDir}`);
  console.error('Run: pnpm nx build mobile-app --configuration=production');
  process.exit(1);
}

const zipFile = resolve(__dirname, `../dist/update-${version}.zip`);
console.log(`Zipping ${buildDir} -> ${zipFile}`);
execSync(`cd "${buildDir}" && zip -r "${zipFile}" .`, { stdio: 'inherit' });

// ── Upload to S3 ────────────────────────────────────────────────────────────
const s3Key = `bundles/${version}.zip`;
console.log(`\nUploading to s3://${bucket}/${s3Key}`);
execSync(
  `aws s3 cp "${zipFile}" "s3://${bucket}/${s3Key}" --region ${region}`,
  { stdio: 'inherit' },
);

// ── Write manifest.json ─────────────────────────────────────────────────────
const manifest = JSON.stringify(
  {
    version,
    url: `${cdnUrl}/${s3Key}`,
  },
  null,
  2,
);

const manifestLocal = resolve(__dirname, '../dist/manifest.json');
const { writeFileSync } = await import('fs');
writeFileSync(manifestLocal, manifest, 'utf8');

console.log(`\nUploading manifest.json to s3://${bucket}/manifest.json`);
execSync(
  `aws s3 cp "${manifestLocal}" "s3://${bucket}/manifest.json" --region ${region} --content-type "application/json" --cache-control "no-cache, no-store, must-revalidate"`,
  { stdio: 'inherit' },
);

// ── Invalidate CloudFront ───────────────────────────────────────────────────
console.log(`\nInvalidating CloudFront distribution ${distributionId}...`);
execSync(
  `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/manifest.json" --region ${region}`,
  { stdio: 'inherit' },
);

console.log(`\nLive update v${version} published successfully!`);
console.log(`Manifest: ${cdnUrl}/manifest.json`);
console.log(`Bundle:   ${cdnUrl}/${s3Key}\n`);
