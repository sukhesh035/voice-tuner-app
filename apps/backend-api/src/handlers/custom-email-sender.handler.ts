/**
 * Cognito customEmailSender Lambda trigger.
 *
 * Cognito calls this instead of sending email itself, passing:
 *  - event.triggerSource  — e.g. "CustomEmailSender_SignUp" | "CustomEmailSender_ForgotPassword"
 *  - event.request.userAttributes.email
 *  - event.request.code   — the one-time code, KMS-encrypted with the CMK
 *
 * We decrypt the code, pick a template, then send via Gmail SMTP (Nodemailer).
 *
 * Required env vars:
 *  GMAIL_USER_PARAM  — SSM SecureString path for the Gmail address
 *  GMAIL_PASS_PARAM  — SSM SecureString path for the Gmail app password
 *  KMS_KEY_ID        — ARN/ID of the CMK used by Cognito to encrypt the code
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import * as nodemailer from 'nodemailer';

const ssm = new SSMClient({});
const { decrypt } = buildClient(CommitmentPolicy.FORBID_ENCRYPT_ALLOW_DECRYPT);

interface CognitoCustomEmailSenderEvent {
  triggerSource: string;
  region: string;
  request: {
    userAttributes: Record<string, string>;
    code: string; // base64-encoded KMS ciphertext
  };
  response: Record<string, unknown>;
}

// Cache Gmail credentials within the Lambda execution environment
let cachedGmailUser: string | null = null;
let cachedGmailPass: string | null = null;

async function getGmailCredentials(): Promise<{ user: string; pass: string }> {
  if (cachedGmailUser && cachedGmailPass) {
    return { user: cachedGmailUser, pass: cachedGmailPass };
  }
  const [userResp, passResp] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: process.env['GMAIL_USER_PARAM']!, WithDecryption: true })),
    ssm.send(new GetParameterCommand({ Name: process.env['GMAIL_PASS_PARAM']!, WithDecryption: true })),
  ]);
  cachedGmailUser = userResp.Parameter!.Value!;
  cachedGmailPass = passResp.Parameter!.Value!;
  return { user: cachedGmailUser, pass: cachedGmailPass };
}

async function decryptCode(encryptedCode: string): Promise<string> {
  const keyring = new KmsKeyringNode({ keyIds: [process.env['KMS_KEY_ID']!] });
  const cipherBytes = Buffer.from(encryptedCode, 'base64');
  const { plaintext } = await decrypt(keyring, cipherBytes);
  return Buffer.from(plaintext).toString('utf8');
}

interface EmailPayload {
  to:      string;
  subject: string;
  html:    string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const { user, pass } = await getGmailCredentials();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"Swara" <${user}>`,
    to:      payload.to,
    subject: payload.subject,
    html:    payload.html,
  });
}

function buildVerificationEmail(email: string, code: string): EmailPayload {
  return {
    to:      email,
    subject: 'Verify your Swara account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h1 style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#b388ff,#e040fb);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;">
          Swara
        </h1>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">Indian Classical Music Companion</p>
        <h2 style="font-size:20px;font-weight:700;color:#111;">Verify your email</h2>
        <p style="color:#444;line-height:1.6;">
          Thanks for signing up! Use the code below to verify your email address.
          This code expires in 24 hours.
        </p>
        <div style="background:#f5f0ff;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#7c3aed;">${code}</span>
        </div>
        <p style="color:#888;font-size:13px;">
          If you didn't create a Swara account, you can safely ignore this email.
        </p>
      </div>
    `,
  };
}

function buildForgotPasswordEmail(email: string, code: string): EmailPayload {
  return {
    to:      email,
    subject: 'Reset your Swara password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h1 style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#b388ff,#e040fb);
                   -webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;">
          Swara
        </h1>
        <p style="color:#555;font-size:15px;margin-bottom:24px;">Indian Classical Music Companion</p>
        <h2 style="font-size:20px;font-weight:700;color:#111;">Reset your password</h2>
        <p style="color:#444;line-height:1.6;">
          We received a request to reset your password. Use the code below.
          This code expires in 1 hour.
        </p>
        <div style="background:#f5f0ff;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#7c3aed;">${code}</span>
        </div>
        <p style="color:#888;font-size:13px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  };
}

export const handler = async (event: CognitoCustomEmailSenderEvent): Promise<void> => {
  const { triggerSource, request } = event;
  const email = request.userAttributes['email'];

  if (!email) {
    console.warn('customEmailSender: no email in userAttributes, skipping');
    return;
  }

  // Decrypt the code that Cognito encrypted with the CMK
  const code = await decryptCode(request.code);

  let payload: EmailPayload;

  if (triggerSource === 'CustomEmailSender_SignUp' ||
      triggerSource === 'CustomEmailSender_ResendCode') {
    payload = buildVerificationEmail(email, code);
  } else if (triggerSource === 'CustomEmailSender_ForgotPassword') {
    payload = buildForgotPasswordEmail(email, code);
  } else {
    // AdminCreateUser, UpdateUserAttribute, etc. — fall back to verification template
    console.log(`customEmailSender: unhandled triggerSource "${triggerSource}", using verification template`);
    payload = buildVerificationEmail(email, code);
  }

  await sendEmail(payload);
  console.log(`customEmailSender: sent "${triggerSource}" email to ${email}`);
};
