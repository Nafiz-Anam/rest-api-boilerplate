import * as nodemailer from 'nodemailer';
import logger from './logger';

// Email configuration interface
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

// Email template interface
export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Get email configuration from environment variables
export const getEmailConfig = (): EmailConfig => {
  const config: EmailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    },
    from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
  };

  // Validate required email configuration
  if (!config.auth.user || !config.auth.pass) {
    logger.warn(
      'Email configuration is incomplete. Please check EMAIL_USER and EMAIL_PASS environment variables.'
    );
  }

  return config;
};

// Create email transporter
export const createTransporter = () => {
  const config = getEmailConfig();

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Send email utility
export const sendEmail = async (template: EmailTemplate): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    const config = getEmailConfig();

    const mailOptions = {
      from: config.from,
      to: template.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully to ${template.to}: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${template.to}:`, error);
    return false;
  }
};

// Email templates
export const EmailTemplates = {
  // OTP verification email
  otpVerification: (otp: string, userName: string): EmailTemplate => ({
    to: '', // Will be set when sending
    subject: 'Your Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
          }
          .otp-container {
            background-color: #f8f9fa;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .otp {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #667eea;
            font-family: 'Courier New', monospace;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verify Your Account</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>You're trying to log in to your account. Use the verification code below to complete the sign-in process:</p>
            
            <div class="otp-container">
              <div class="otp">${otp}</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This code will expire in <strong>10 minutes</strong>. 
              Never share this code with anyone. If you didn't request this code, please ignore this email.
            </div>
            
            <p>If you're having trouble, you can try copying and pasting the code directly.</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© 2024 Your App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${userName},
      
      You're trying to log in to your account. Use the verification code below to complete the sign-in process:
      
      Verification Code: ${otp}
      
      Security Notice: This code will expire in 10 minutes. Never share this code with anyone. If you didn't request this code, please ignore this email.
      
      If you're having trouble, you can try copying and pasting the code directly.
      
      This is an automated message. Please do not reply to this email.
      © 2024 Your App. All rights reserved.
    `,
  }),

  // 2FA enabled confirmation
  twoFactorEnabled: (userName: string): EmailTemplate => ({
    to: '', // Will be set when sending
    subject: 'Two-Factor Authentication Enabled',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>2FA Enabled</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
          }
          .success-icon {
            font-size: 48px;
            color: #28a745;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ Security Enhanced</h1>
          </div>
          <div class="content">
            <div class="success-icon">✅</div>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>Two-factor authentication has been successfully enabled on your account.</p>
            <p>Your account is now protected with an additional layer of security. You'll need to enter a verification code sent to your email whenever you log in from a new device.</p>
            <p><strong>Benefits of 2FA:</strong></p>
            <ul>
              <li>✓ Enhanced security against unauthorized access</li>
              <li>✓ Protection even if your password is compromised</li>
              <li>✓ Peace of mind knowing your account is secure</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© 2024 Your App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${userName},
      
      Two-factor authentication has been successfully enabled on your account.
      
      Your account is now protected with an additional layer of security. You'll need to enter a verification code sent to your email whenever you log in from a new device.
      
      Benefits of 2FA:
      ✓ Enhanced security against unauthorized access
      ✓ Protection even if your password is compromised
      ✓ Peace of mind knowing your account is secure
      
      This is an automated message. Please do not reply to this email.
      © 2024 Your App. All rights reserved.
    `,
  }),

  // Password reset email
  passwordReset: (resetLink: string, userName: string): EmailTemplate => ({
    to: '', // Will be set when sending
    subject: 'Password Reset Request',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
          }
          .reset-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .reset-button:hover {
            background-color: #0056b3;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> This link will expire in <strong>1 hour</strong>. 
              If you didn't request a password reset, please ignore this email and contact support immediately.
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${resetLink}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© 2024 Your App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${userName},
      
      We received a request to reset your password. Click the link below to create a new password:
      
      Reset Password: ${resetLink}
      
      Security Notice: This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and contact support immediately.
      
      If the button doesn't work, you can copy and paste this link into your browser:
      ${resetLink}
      
      This is an automated message. Please do not reply to this email.
      © 2024 Your App. All rights reserved.
    `,
  }),

  // New device login notification
  newDeviceLogin: (deviceInfo: any, userName: string): EmailTemplate => ({
    to: '', // Will be set when sending
    subject: 'New Device Login Alert',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Device Login</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #ffc107 0%, #ff6b6b 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 20px;
          }
          .device-info {
            background-color: #f8f9fa;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 5px 5px 0;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 New Device Login</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>We detected a login to your account from a new device:</p>
            
            <div class="device-info">
              <strong>Device Details:</strong><br>
              📱 Device: ${deviceInfo.deviceName || 'Unknown'}<br>
              🌐 Platform: ${deviceInfo.platform || 'Unknown'}<br>
              🕐 Time: ${new Date().toLocaleString()}<br>
              📍 IP Address: ${deviceInfo.ipAddress || 'Unknown'}
            </div>
            
            <p><strong>If this was you:</strong> No action is needed. You can safely ignore this email.</p>
            
            <p><strong>If this wasn't you:</strong> Please secure your account immediately:</p>
            <ul>
              <li>1. Change your password immediately</li>
              <li>2. Enable two-factor authentication</li>
              <li>3. Review your account activity</li>
              <li>4. Contact support if you need assistance</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© 2024 Your App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hello ${userName},
      
      We detected a login to your account from a new device:
      
      Device Details:
      Device: ${deviceInfo.deviceName || 'Unknown'}
      Platform: ${deviceInfo.platform || 'Unknown'}
      Time: ${new Date().toLocaleString()}
      IP Address: ${deviceInfo.ipAddress || 'Unknown'}
      
      If this was you: No action is needed. You can safely ignore this email.
      
      If this wasn't you: Please secure your account immediately:
      1. Change your password immediately
      2. Enable two-factor authentication
      3. Review your account activity
      4. Contact support if you need assistance
      
      This is an automated message. Please do not reply to this email.
      © 2024 Your App. All rights reserved.
    `,
  }),
};

export default {
  getEmailConfig,
  createTransporter,
  sendEmail,
  EmailTemplates,
};
