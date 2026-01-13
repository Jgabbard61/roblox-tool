/**
 * Email Service Module
 *
 * Handles sending emails using Resend
 *
 * Email types:
 * - Welcome email (after first purchase)
 * - Purchase confirmation email
 * - Low balance alert email
 */

import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const FROM_EMAIL = 'VerifyLens <noreply@verifylens.com>';

/**
 * HTML escape function to prevent XSS attacks in email templates
 * Escapes: & < > " ' / characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  return String(text).replace(/[&<>"'/]/g, (char) => map[char]);
}

// ============================================
// EMAIL VERIFICATION EMAIL
// ============================================

export interface VerificationEmailParams {
  email: string;
  firstName: string;
  username: string;
  verificationUrl: string;
}

export async function sendVerificationEmail(params: VerificationEmailParams) {
  const { email, firstName, username, verificationUrl } = params;

  const subject = 'Verify Your VerifyLens Email Address';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Verify Your Email</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 16px;">Complete your VerifyLens registration</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Hi <strong>${escapeHtml(firstName)}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Thank you for registering with VerifyLens! To complete your registration and start using your account, please verify your email address by clicking the button below.
              </p>

              <!-- Username Info Box -->
              <div style="margin: 20px 0 30px 0; padding: 20px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #14532d; font-size: 14px; font-weight: 600;">
                  ✅ Your Login Username
                </p>
                <p style="margin: 0; color: #15803d; font-size: 18px; font-weight: 700; font-family: monospace;">
                  ${escapeHtml(username)}
                </p>
                <p style="margin: 8px 0 0 0; color: #166534; font-size: 12px; line-height: 1.4;">
                  Use this username to log in to your VerifyLens account at <a href="https://www.verifylens.com" style="color: #15803d; text-decoration: none; font-weight: 600;">www.verifylens.com</a>
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <p style="margin: 20px 0; color: #718096; font-size: 14px; line-height: 1.6; text-align: center;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 20px 0; color: #667eea; font-size: 13px; word-break: break-all; background-color: #f7fafc; padding: 12px; border-radius: 6px; font-family: monospace;">
                ${verificationUrl}
              </p>

              <!-- Expiry Notice -->
              <div style="margin: 30px 0; padding: 20px; background-color: #fff5f5; border-left: 4px solid #fc8181; border-radius: 4px;">
                <p style="margin: 0; color: #742a2a; font-size: 14px; line-height: 1.6;">
                  <strong>⏰ Important:</strong> This verification link will expire in 24 hours. If it expires, you'll need to request a new verification email.
                </p>
              </div>

              <!-- Security Notice -->
              <div style="margin: 30px 0; padding: 20px; background-color: #ebf8ff; border-left: 4px solid #4299e1; border-radius: 4px;">
                <p style="margin: 0; color: #2c5282; font-size: 14px; line-height: 1.6;">
                  <strong>🔒 Security Notice:</strong> If you didn't create an account with VerifyLens, please ignore this email or contact our support team.
                </p>
              </div>

              <!-- Support -->
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Need help? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea; text-decoration: none;">support@verifylens.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                © ${new Date().getFullYear()} VerifyLens. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; color: #a0aec0; font-size: 13px;">
                Professional Roblox User Verification for Legal Professionals
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send verification email:', error);
      throw error;
    }

    console.log('[Email] Verification email sent:', data);
    return data;
  } catch (error) {
    console.error('[Email] Error sending verification email:', error);
    throw error;
  }
}

// ============================================
// WELCOME EMAIL
// ============================================

export interface WelcomeEmailParams {
  email: string;
  customerName: string;
  username: string;
  tempPassword: string;
  credits: number;
  loginUrl: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const { email, customerName, username, tempPassword, credits, loginUrl } = params;

  const subject = 'Welcome to VerifyLens - Your Account is Ready! 🎉';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to VerifyLens</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Welcome to VerifyLens!</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 16px;">Your account is ready to use</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Hi <strong>${escapeHtml(customerName)}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Thank you for purchasing <strong>${credits} credits</strong>! Your VerifyLens account has been created and you're ready to start verifying Roblox users.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: #2d3748; font-size: 20px; font-weight: 600;">Your Login Credentials</h2>

                    <p style="margin: 8px 0; color: #4a5568; font-size: 15px;">
                      <strong>Username:</strong> <span style="color: #667eea; font-family: monospace;">${escapeHtml(username)}</span>
                    </p>

                    ${tempPassword ? `
                    <p style="margin: 8px 0; color: #4a5568; font-size: 15px;">
                      <strong>Temporary Password:</strong> <span style="color: #667eea; font-family: monospace;">${escapeHtml(tempPassword)}</span>
                    </p>

                    <p style="margin: 16px 0 0 0; color: #718096; font-size: 13px; font-style: italic;">
                      ⚠️ Please change your password after first login for security
                    </p>
                    ` : `
                    <p style="margin: 16px 0 0 0; color: #718096; font-size: 13px; font-style: italic;">
                      🔒 Use the password you set during registration to log in
                    </p>
                    `}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Login to VerifyLens
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Credit Balance -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">Your Current Balance</p>
                    <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 36px; font-weight: 700;">${credits} Credits</p>
                  </td>
                </tr>
              </table>

              <!-- Getting Started -->
              <div style="margin: 30px 0;">
                <h3 style="margin: 0 0 16px 0; color: #2d3748; font-size: 18px; font-weight: 600;">Getting Started</h3>
                
                <ol style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 15px; line-height: 1.8;">
                  <li>Click the button above to login</li>
                  <li>Enter your username and temporary password</li>
                  <li>Change your password in your dashboard</li>
                  <li>Start verifying Roblox users!</li>
                </ol>
              </div>

              <!-- Search Modes Info -->
              <div style="margin: 30px 0; padding: 20px; background-color: #ebf8ff; border-left: 4px solid #4299e1; border-radius: 4px;">
                <h4 style="margin: 0 0 12px 0; color: #2c5282; font-size: 16px; font-weight: 600;">💡 Credit Usage</h4>
                <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.6;">
                  <strong>Exact Search:</strong> 1 credit (FREE if no results)<br>
                  <strong>Smart Search:</strong> 1 credit (always charged)<br>
                  <strong>Display Name Search:</strong> 1 credit (always charged)
                </p>
              </div>

              <!-- Support -->
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Need help? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea; text-decoration: none;">support@verifylens.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                © ${new Date().getFullYear()} VerifyLens. All rights reserved.
              </p>
              <p style="margin: 10px 0 0 0; color: #a0aec0; font-size: 13px;">
                Professional Roblox User Verification for Legal Professionals
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send welcome email:', error);
      throw error;
    }

    console.log('[Email] Welcome email sent:', data);
    return data;
  } catch (error) {
    console.error('[Email] Error sending welcome email:', error);
    throw error;
  }
}

// ============================================
// PURCHASE CONFIRMATION EMAIL
// ============================================

export interface PurchaseConfirmationParams {
  email: string;
  customerName: string;
  credits: number;
  amountPaid: number;
  newBalance: number;
}

export async function sendPurchaseConfirmationEmail(params: PurchaseConfirmationParams) {
  const { email, customerName, credits, amountPaid, newBalance } = params;

  const subject = `Credits Purchased Successfully - ${credits} Credits Added`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <div style="width: 64px; height: 64px; margin: 0 auto 20px; background-color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Payment Successful!</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 16px;">Your credits have been added</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Hi <strong>${escapeHtml(customerName)}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Thank you for your purchase! We've successfully added <strong>${credits} credits</strong> to your VerifyLens account.
              </p>

              <!-- Receipt -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7fafc; border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 20px 0; color: #2d3748; font-size: 20px; font-weight: 600;">Purchase Receipt</h2>
                    
                    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="color: #718096; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Credits Purchased</td>
                        <td align="right" style="color: #2d3748; font-size: 15px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${credits}</td>
                      </tr>
                      <tr>
                        <td style="color: #718096; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Amount Paid</td>
                        <td align="right" style="color: #2d3748; font-size: 15px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">$${amountPaid.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="color: #718096; font-size: 15px; border-bottom: 1px solid #e2e8f0;">Date</td>
                        <td align="right" style="color: #2d3748; font-size: 15px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${new Date().toLocaleDateString()}</td>
                      </tr>
                      <tr style="background-color: #edf2f7;">
                        <td style="color: #2d3748; font-size: 16px; font-weight: 700; padding-top: 12px;">New Balance</td>
                        <td align="right" style="color: #48bb78; font-size: 20px; font-weight: 700; padding-top: 12px;">${newBalance} Credits</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.APP_URL || process.env.NEXTAUTH_URL}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Start Verifying
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Support -->
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Questions about your purchase? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea; text-decoration: none;">support@verifylens.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                © ${new Date().getFullYear()} VerifyLens. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send purchase confirmation:', error);
      throw error;
    }

    console.log('[Email] Purchase confirmation sent:', data);
    return data;
  } catch (error) {
    console.error('[Email] Error sending purchase confirmation:', error);
    throw error;
  }
}

// ============================================
// LOW BALANCE ALERT EMAIL
// ============================================

export interface LowBalanceAlertParams {
  email: string;
  customerName: string;
  currentBalance: number;
  buyMoreUrl: string;
}

export async function sendLowBalanceAlert(params: LowBalanceAlertParams) {
  const { email, customerName, currentBalance, buyMoreUrl } = params;

  const subject = `Low Credit Balance Alert - ${currentBalance} Credits Remaining`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Low Balance Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <div style="width: 64px; height: 64px; margin: 0 auto 20px; background-color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">⚠️</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Low Credit Balance</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 16px;">Time to purchase more credits</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Hi <strong>${escapeHtml(customerName)}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                Your VerifyLens credit balance is running low. You currently have <strong>${currentBalance} credits</strong> remaining.
              </p>

              <p style="margin: 0 0 20px 0; color: #2d3748; font-size: 16px; line-height: 1.6;">
                To continue using VerifyLens without interruption, we recommend purchasing more credits now.
              </p>

              <!-- Current Balance -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%); border-radius: 8px; margin: 30px 0;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">Current Balance</p>
                    <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 36px; font-weight: 700;">${currentBalance} Credits</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${buyMoreUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Buy More Credits
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <div style="margin: 30px 0; padding: 20px; background-color: #ebf8ff; border-left: 4px solid #4299e1; border-radius: 4px;">
                <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.6;">
                  <strong>💡 Reminder:</strong> Each search uses 1 credit. Exact searches with no results are FREE!
                </p>
              </div>

              <!-- Support -->
              <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Need help? Contact us at <a href="mailto:support@verifylens.com" style="color: #667eea; text-decoration: none;">support@verifylens.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                © ${new Date().getFullYear()} VerifyLens. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error('[Email] Failed to send low balance alert:', error);
      throw error;
    }

    console.log('[Email] Low balance alert sent:', data);
    return data;
  } catch (error) {
    console.error('[Email] Error sending low balance alert:', error);
    throw error;
  }
}
