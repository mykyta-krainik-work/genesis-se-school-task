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
    delete: vi.fn().mockReturnThis(),
  }
}));

const mockDb = db as any;

const generateTestToken = () => crypto.randomBytes(32).toString('hex');

describe('GET /api/unsubscribe/:token', () => {
  let validUnsubscribeToken: string;
  let validSubscriptionId: number;
  let validTokenId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    validUnsubscribeToken = generateTestToken();
    validSubscriptionId = 1;
    validTokenId = 10;

    mockDb.limit.mockResolvedValue([]);

    mockDb.delete.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue([{ id: 1 }])
    }));
  });

  it('should unsubscribe successfully with a valid token', async () => {
    const mockTokenEntry = {
      id: validTokenId,
      subscriptionId: validSubscriptionId,
      type: 'unsubscribe',
    };
    const mockSubscriptionExists = { id: validSubscriptionId };

    mockDb.limit
      .mockResolvedValueOnce([mockTokenEntry])
      .mockResolvedValueOnce([mockSubscriptionExists]);
    mockDb.delete
      .mockImplementationOnce(() => ({
        where: vi.fn().mockResolvedValueOnce([{ id: validSubscriptionId }])
      }))
      .mockImplementationOnce(() => ({
        where: vi.fn().mockResolvedValueOnce([{ id: validTokenId }])
      }));

    const request = new Request(`http://localhost:3000/api/unsubscribe/${validUnsubscribeToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(200);
    expect(responseBody.message).toBe('Unsubscribed successfully');

    expect(mockDb.select).toHaveBeenCalledTimes(2);
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
  });

  it('should return 404 if token is not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]);

    const request = new Request(`http://localhost:3000/api/unsubscribe/${generateTestToken()}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(404);
    expect(responseBody.message).toBe('Token not found');
  });

  it('should return 400 if token format is invalid', async () => {
    const invalidToken = 'invalid-short-token';
    const request = new Request(`http://localhost:3000/api/unsubscribe/${invalidToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid token format');
    expect(responseBody.errors).toHaveProperty('token');
  });

  it('should return 400 if token type is not \'unsubscribe\'', async () => {
    const mockTokenEntry = { id: validTokenId, subscriptionId: 1, type: 'confirmation' };
    mockDb.limit.mockResolvedValueOnce([mockTokenEntry]); // Token found, but wrong type

    const request = new Request(`http://localhost:3000/api/unsubscribe/${validUnsubscribeToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid token type for unsubscribe operation');
  });

  it('should return 200 and delete token if subscription is already removed or not found', async () => {
    const mockTokenEntry = { id: validTokenId, subscriptionId: validSubscriptionId, type: 'unsubscribe' };

    mockDb.limit
      .mockResolvedValueOnce([mockTokenEntry]) // Token found
      .mockResolvedValueOnce([]);             // Subscription not found by its ID

    mockDb.delete.mockImplementationOnce(() => ({
      where: vi.fn().mockResolvedValueOnce([{ id: validTokenId }])
    }));

    const request = new Request(`http://localhost:3000/api/unsubscribe/${validUnsubscribeToken}`);
    const res = await app.request(request);
    const responseBody = await res.json();

    expect(res.status).toBe(200);
    expect(responseBody.message).toBe('Subscription already removed or not found');
    expect(mockDb.delete).toHaveBeenCalledOnce();
    const deleteCalls = mockDb.delete.mock.calls;
    expect(deleteCalls.length).toBe(1);
  });

}); 