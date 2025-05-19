import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';
import { db } from '../src/db';
import { sendEmail } from '../src/services/mail.service';
import dns from 'dns/promises';

vi.mock('../src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, email: 'test@example.com' }])
  }
}));

vi.mock('../src/services/mail.service', () => ({
  sendEmail: vi.fn().mockResolvedValue('mocked-message-id'),
}));

vi.mock('dns/promises', () => ({
  default: {
    resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.example.com' }]),
  }
}));

const mockDb = db as any;
const mockDnsPromises = dns as any;

const getTestEnv = () => ({
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || 'dummy_fallback_key',
  DATABASE_URL: process.env.DATABASE_URL || 'dummy_db_url',
  SMTP_HOST: process.env.SMTP_HOST || 'test_smtp_host',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER || 'test_user',
  SMTP_PASS: process.env.SMTP_PASS || 'test_pass',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@example.com',
});

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.select = vi.fn().mockReturnThis();
    mockDb.from = vi.fn().mockReturnThis();
    mockDb.where = vi.fn().mockReturnThis();
    mockDb.limit = vi.fn().mockResolvedValue([]);
    mockDb.insert = vi.fn().mockReturnThis();
    mockDb.values = vi.fn().mockReturnThis();
    mockDb.returning = vi.fn((arg) => {
      if (mockDb.values.mock.calls.some(call => call[0]?.type === 'confirmation')) {
        return Promise.resolve([{ id: 1, token: 'mock-token' }]);
      } else {
        return Promise.resolve([{ id: 1, email: 'test@example.com', city: 'Test City', frequency: 'daily', confirmed: false }]);
      }
    });

    mockDnsPromises.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com' }]);
    (sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue('mocked-message-id');
  });

  const invalidPayloads = [
    { payload: { city: 'Test City', frequency: 'daily' }, missing: 'email', errorField: 'email' },
    { payload: { email: 'test@example.com', frequency: 'daily' }, missing: 'city', errorField: 'city' },
    { payload: { email: 'test@example.com', city: 'Test City' }, missing: 'frequency', errorField: 'frequency' },
    { payload: { email: 'invalid-email', city: 'Test City', frequency: 'daily' }, invalid: 'email', errorField: 'email' },
    { payload: { email: 'test@example.com', city: 'Test City', frequency: 'weekly' }, invalid: 'frequency', errorField: 'frequency' },
  ];

  invalidPayloads.forEach(({ payload, missing, invalid, errorField }) => {
    const testName = missing
      ? `should return 400 if ${missing} is missing`
      : `should return 400 if ${invalid} is invalid (${payload[invalid as keyof typeof payload]})`;

    it(testName, async () => {
      const formData = new URLSearchParams();
      for (const key in payload) {
        formData.append(key, payload[key as keyof typeof payload] as string);
      }

      const request = new Request('http://localhost:3000/api/subscribe', {
        method: 'POST',
        body: formData,
      });

      const res = await app.request(request);
      const responseBody = await res.json();

      expect(res.status).toBe(400);
      expect(responseBody.message).toBe('Invalid input');
      expect(responseBody.errors).toHaveProperty(errorField);
    });
  });
}); 