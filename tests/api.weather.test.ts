import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);


describe('GET /api/weather', () => {
  const getTestEnv = () => ({
    WEATHER_API_KEY: process.env.WEATHER_API_KEY || 'dummy_fallback_key',
    DATABASE_URL: process.env.DATABASE_URL || 'dummy_db_url'
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return weather data successfully for a valid city', async () => {
    const mockWeatherData = {
      location: { name: 'London' },
      current: { temp_c: 15, humidity: 70, condition: { text: 'Partly cloudy' } },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeatherData,
      status: 200,
    });

    const request = new Request('http://localhost:3000/api/weather?city=London');
    const env = getTestEnv();
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(200);
    expect(responseBody).toEqual({
      temperature: 15,
      humidity: 70,
      description: 'Partly cloudy in London',
    });
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      // Use process.env directly here as it's set by global setup
      `http://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=London`
    );
  });

  it('should return 400 if city parameter is missing', async () => {
    const request = new Request('http://localhost:3000/api/weather'); // No city query param
    const env = getTestEnv();
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid request');
    expect(responseBody.errors).toHaveProperty('city');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return 400 if city parameter is empty', async () => {
    const request = new Request('http://localhost:3000/api/weather?city=');
    const env = getTestEnv();
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid request');
    expect(responseBody.errors).toHaveProperty('city');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return 500 if WEATHER_API_KEY is not set', async () => {
    const envWithoutApiKey = { DATABASE_URL: getTestEnv().DATABASE_URL };

    const originalProcessApiKey = process.env.WEATHER_API_KEY;
    delete process.env.WEATHER_API_KEY;

    const request = new Request('http://localhost:3000/api/weather?city=London');
    const res = await app.request(request, undefined, envWithoutApiKey as any);
    const responseBody = await res.json();

    expect(res.status).toBe(500);
    expect(responseBody.message).toBe('Server configuration error: API key missing');
    expect(mockFetch).not.toHaveBeenCalled();

    process.env.WEATHER_API_KEY = originalProcessApiKey;
  });

  it('should return 404 if city is not found (WeatherAPI error 1006)', async () => {
    const weatherApiError = { error: { code: 1006, message: 'No matching location found.' } };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => weatherApiError,
      status: 400,
    });
    const env = getTestEnv();
    const request = new Request('http://localhost:3000/api/weather?city=NonExistentCity');
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(404);
    expect(responseBody.message).toBe('City not found: NonExistentCity');
  });

  it('should return 400 for other WeatherAPI errors (e.g., invalid key - code 2006)', async () => {
    const weatherApiError = { error: { code: 2006, message: 'API key provided is invalid' } };
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => weatherApiError,
      status: 401,
    });
    const env = getTestEnv();
    const request = new Request('http://localhost:3000/api/weather?city=London');
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(400);
    expect(responseBody.message).toBe('Invalid request to weather service');
    expect(responseBody.detail).toBe('API key provided is invalid');
  });


  it('should return 503 if fetch to WeatherAPI fails (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const env = getTestEnv();
    const request = new Request('http://localhost:3000/api/weather?city=London');
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(503);
    expect(responseBody.message).toBe('Failed to connect to weather service');
  });

  it('should return 500 if WeatherAPI response structure is unexpected', async () => {
    const malformedWeatherData = { location: null, current: null };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => malformedWeatherData,
      status: 200,
    });
    const env = getTestEnv();
    const request = new Request('http://localhost:3000/api/weather?city=London');
    const res = await app.request(request, undefined, env);
    const responseBody = await res.json();

    expect(res.status).toBe(500);
    expect(responseBody.message).toBe('Unexpected response from weather service');
  });

}); 