/**
 * Email utility for sending transactional emails using Resend
 */
import { Resend } from 'resend';

// Initialize Resend client only if API key is available
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    try {
      resend = new Resend(process.env.RESEND_API_KEY);
    } catch (error) {
      console.error('Failed to initialize Resend client:', error);
      return null;
    }
  }
  return resend;
}

export interface VerificationEmailParams {
  email: string;
  firstName: string;
  username: string;
  verificationUrl: string;
}

/**
 * Sends an email verification link to the user
 */
export async function sendVerificationEmail(params: VerificationEmailParams): Promise<void> {
  const client = getResendClient();
  
  if (!client) {
    console.warn('[Email] Resend API key not configured. Email not sent to:', params.email);
    console.log('[Email] Verification URL:', params.verificationUrl);
    return;
  }

  const { email, firstName, username, verificationUrl } = params;

  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM || 'VerifyLens <noreply@verifylens.com>',
      to: email,
      subject: 'Verify Your VerifyLens Email Address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Verify Your Email</h1>
              <p style="color: #f0f0f0; margin-top: 10px;">Complete your VerifyLens registration</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
              
              <p>Thank you for registering with <strong>VerifyLens</strong>! To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 12px; border-radius: 5px; word-break: break-all; font-size: 13px; color: #667eea;">
                ${verificationUrl}
              </p>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> This verification link will expire in 24 hours. If you didn't create an account with VerifyLens, please ignore this email or contact our support team.</p>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="font-size: 14px; color: #666; margin: 5px 0;"><strong>Your Account Details:</strong></p>
                <ul style="list-style: none; padding: 0; color: #666; font-size: 14px;">
                  <li>📧 <strong>Email:</strong> ${email}</li>
                  <li>👤 <strong>Username:</strong> ${username}</li>
                </ul>
              </div>
              
              <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
                <p>Need help? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea;">support@verifylens.com</a></p>
                <p style="margin-top: 20px;">&copy; ${new Date().getFullYear()} VerifyLens. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('[Email] Verification email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Sends a password reset email
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  firstName: string;
  resetUrl: string;
}): Promise<void> {
  const client = getResendClient();
  
  if (!client) {
    console.warn('[Email] Resend API key not configured. Email not sent to:', params.email);
    console.log('[Email] Reset URL:', params.resetUrl);
    return;
  }

  const { email, firstName, resetUrl } = params;

  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM || 'VerifyLens <noreply@verifylens.com>',
      to: email,
      subject: 'Reset Your VerifyLens Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Reset Your Password</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hi <strong>${firstName}</strong>,</p>
              
              <p>We received a request to reset your password for your VerifyLens account. Click the button below to create a new password:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="background: white; padding: 12px; border-radius: 5px; word-break: break-all; font-size: 13px; color: #667eea;">
                ${resetUrl}
              </p>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404;"><strong>⚠️ Security Notice:</strong> This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
              </div>
              
              <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
                <p>Need help? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea;">support@verifylens.com</a></p>
                <p style="margin-top: 20px;">&copy; ${new Date().getFullYear()} VerifyLens. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('[Email] Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
