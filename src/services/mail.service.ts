import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

type AppTransporter = nodemailer.Transporter & {
  options?: { host?: string };
};

let transporter: AppTransporter | undefined;
let transporterInitializationPromise: Promise<void> | null = null;

const consoleLogTransport = {
  sendMail: async (options: nodemailer.SendMailOptions) => {
    console.warn("Email transporter not available or failed. Logging email to console:");
    console.log("To:", options.to);
    console.log("Subject:", options.subject);
    console.log("Text Body:", options.text);
    console.log("HTML Body:", options.html);
    const messageId = `console-log-${Date.now()}@localhost`;
    if (process.env.ETHEREAL_FALLBACK_PREVIEW === 'true') {
      console.log(`Console Fallback - Email details for ${options.subject} to ${options.to}: (No actual email sent)`);
      console.log(`Message-ID: <${messageId}>`);
    }
    return { messageId, envelope: {}, accepted: [options.to as string], rejected: [], pending: [] };
  },
  options: { host: 'console-logger' }
} as AppTransporter;


async function initializeTransporter(): Promise<void> {
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      console.warn('SMTP credentials not fully provided. Using Ethereal for email testing.');
      const testAccount = await nodemailer.createTestAccount();

      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
  } catch (error) {
    console.error("Failed to initialize email transporter:", error);
    console.warn("Defaulting to console log transport due to initialization error.");
    transporter = consoleLogTransport;
  }
}

export async function sendEmail(options: MailOptions): Promise<string | null> {
  const emailFrom = process.env.EMAIL_FROM || 'noreply@weatherapi.app';

  if (!transporter && !transporterInitializationPromise) {
    console.log('Initiating email transporter initialization...');
    transporterInitializationPromise = initializeTransporter();
  }

  if (transporterInitializationPromise) {
    console.log('Waiting for email transporter initialization...');
    await transporterInitializationPromise;
    transporterInitializationPromise = null;
  }

  if (!transporter) {
    transporter = consoleLogTransport;
    console.error('Transporter was not initialized and fallback was not set. Using emergency console logger.');
  }

  try {
    const currentTransporter = transporter as AppTransporter;

    const info = await currentTransporter.sendMail({
      from: `"Weather API" <${emailFrom}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('Message sent: %s', info.messageId);

    const transportOptions = currentTransporter.options;

    if (transportOptions && transportOptions.host === 'smtp.ethereal.email') {
      const previewUrl = nodemailer.getTestMessageUrl(info);

      if (previewUrl) {
        console.log('Preview URL: %s', previewUrl);
      } else {
        console.log('Ethereal email sent, but no preview URL was returned. Message ID:', info.messageId);
      }
    }
    return info.messageId as string;
  } catch (error) {
    console.error('Error sending email:', error);
    return null;
  }
} 