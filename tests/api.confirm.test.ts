import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';
import { db } from '../src/db';
import crypto from 'crypto';

vi.mock('../src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ id: 1 }])
  }
}));

const mockDb = db as any;

const generateTestToken = () => crypto.randomBytes(32).toString('hex');

describe('GET /api/confirm/:token', () => {
  let validConfirmationToken: string;
  let validSubscriptionId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    validConfirmationToken = generateTestToken();
    validSubscriptionId = 1;

    mockDb.limit.mockImplementation((count: number) => {
      if (mockDb.select.mock.calls.some(call => call[0]?.tokenId)) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    mockDb.update = vi.fn().mockReturnThis();
    mockDb.set = vi.fn().mockReturnThis();
    mockDb.where.mockResolvedValueOnce([{ id: 1, confirmed: true }]);

    mockDb.delete = vi.fn().mockReturnThis();
    mockDb.where = vi.fn().mockReturnThis();
    mockDb.where.mockResolvedValueOnce([{ id: 1 }]);

    mockDb.insert = vi.fn().mockReturnThis();
    mockDb.values = vi.fn().mockResolvedValue([{ id: 2, type: 'unsubscribe' }]);
  });

  it('should return 404 if token is not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]); // Token not found

    const request = new Request(`http://localhost:3000/api/confirm/${generateTestToken()}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(404);
    expect(responseBody.message).toBe('Token not found or already used');
  });

  it('should return 400 if token format is invalid (too short)', async () => {
    const invalidToken = 'short-token';
    const request = new Request(`http://localhost:3000/api/confirm/${invalidToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid token format');
    expect(responseBody.errors).toHaveProperty('token');
  });

  it('should return 400 if token is expired', async () => {
    const pastExpiry = new Date(new Date().getTime() - 60 * 60 * 1000); // Expired 1 hour ago
    const mockTokenEntry = { tokenId: 100, type: 'confirmation', expiresAt: pastExpiry, subscriptionId: 1 };
    mockDb.limit.mockResolvedValueOnce([mockTokenEntry]); // Token found
    // Mock successful delete of expired token
    mockDb.delete.mockImplementationOnce(() => ({
      where: vi.fn().mockResolvedValueOnce([{ id: mockTokenEntry.tokenId }])
    }));

    const request = new Request(`http://localhost:3000/api/confirm/${validConfirmationToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Token expired');
    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it('should return 400 if token type is not \'confirmation\'', async () => {
    const mockTokenEntry = { tokenId: 100, type: 'unsubscribe', expiresAt: new Date(Date.now() + 3600000), subscriptionId: 1 };
    mockDb.limit.mockResolvedValueOnce([mockTokenEntry]); // Token found

    const request = new Request(`http://localhost:3000/api/confirm/${validConfirmationToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid token type');
  });

  it('should return 200 if subscription is already confirmed and delete token', async () => {
    const mockTokenEntry = { tokenId: 100, type: 'confirmation', expiresAt: new Date(Date.now() + 3600000), subscriptionId: validSubscriptionId };
    const mockSubscriptionEntry = { id: validSubscriptionId, confirmed: true };

    mockDb.limit
      .mockResolvedValueOnce([mockTokenEntry])
      .mockResolvedValueOnce([mockSubscriptionEntry]);

    mockDb.delete.mockImplementationOnce(() => ({
      where: vi.fn().mockResolvedValueOnce([{ id: mockTokenEntry.tokenId }])
    }));

    const request = new Request(`http://localhost:3000/api/confirm/${validConfirmationToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(200);
    expect(responseBody.message).toBe('Subscription already confirmed');
    expect(mockDb.delete).toHaveBeenCalledOnce();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should return 404 if associated subscription is not found', async () => {
    const mockTokenEntry = { tokenId: 100, type: 'confirmation', expiresAt: new Date(Date.now() + 3600000), subscriptionId: 999 };
    mockDb.limit
      .mockResolvedValueOnce([mockTokenEntry])
      .mockResolvedValueOnce([]);

    const request = new Request(`http://localhost:3000/api/confirm/${validConfirmationToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(404);
    expect(responseBody.message).toBe('Associated subscription not found');
  });
}); 