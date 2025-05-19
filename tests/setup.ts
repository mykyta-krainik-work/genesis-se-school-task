import dotenv from 'dotenv';
import { vi } from 'vitest';

dotenv.config({ path: '.env.test' });
if (Object.keys(dotenv.config().parsed || {}).length === 0) {
  dotenv.config();
}

if (!process.env.DATABASE_URL) {
  console.log('Setting default DATABASE_URL for tests');
  process.env.DATABASE_URL = 'postgresql://testuser:testpass@testhost:5432/testdb';
}

if (!process.env.WEATHER_API_KEY) {
  console.log('Setting default WEATHER_API_KEY for tests');
  process.env.WEATHER_API_KEY = 'dummy_weather_api_key_for_tests';
}
