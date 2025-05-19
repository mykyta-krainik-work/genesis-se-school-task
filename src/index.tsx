import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { prettyJSON } from 'hono/pretty-json'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import dotenv from 'dotenv'
import crypto from 'crypto'
import { db } from './db'
import { subscriptions, tokens } from './db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from './services/mail.service'
import dns from 'dns/promises'
import { SubscribePage } from './ui/subscribe'

dotenv.config()

interface CloudflareBindings {
  WEATHER_API_KEY: string
  DATABASE_URL: string
}

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', prettyJSON())

const weatherQuerySchema = z.object({
  city: z.string().min(1, { message: "City name cannot be empty" }),
})

const subscriptionFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  city: z.string().min(1, { message: "City name cannot be empty" }),
  frequency: z.enum(["hourly", "daily"], { message: "Frequency must be 'hourly' or 'daily'" }),
})

const tokenPathSchema = z.object({
  token: z.string().length(64, { message: "Token must be a 64-character hex string" }),
})

const api = new Hono<{ Bindings: CloudflareBindings }>()

interface WeatherResponse {
  temperature: number
  humidity: number
  description: string
}

interface WeatherApiComCurrentResponse {
  location?: {
    name: string
  }
  current?: {
    temp_c: number
    humidity: number
    condition: {
      text: string
    }
  }
  error?: {
    code: number
    message: string
  }
}

api.get(
  '/weather',
  zValidator('query', weatherQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid request',
          errors: result.error.flatten().fieldErrors,
        },
        400
      )
    }
  }),
  async (c) => {
    const { city } = c.req.valid('query')
    const apiKey = c.env.WEATHER_API_KEY || process.env.WEATHER_API_KEY

    if (!apiKey) {
      console.error('WEATHER_API_KEY is not set.')
      return c.json({ message: 'Server configuration error: API key missing' }, 500)
    }

    const weatherApiUrl = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}`

    try {
      const response = await fetch(weatherApiUrl)
      const data = await response.json() as WeatherApiComCurrentResponse

      if (data.error) {
        console.error(`WeatherAPI.com error for city '${city}':`, data.error)

        switch (data.error.code) {
          case 1006:
            return c.json({ message: `City not found: ${city}` }, 404)
          default:
            return c.json({ message: 'Invalid request to weather service', detail: data.error.message }, 400)
        }
      }

      if (data.current && data.location) {
        const weatherResponse: WeatherResponse = {
          temperature: data.current.temp_c,
          humidity: data.current.humidity,
          description: `${data.current.condition.text} in ${data.location.name}`,
        }

        return c.json(weatherResponse, 200)
      } else {
        console.error('Unexpected response structure from WeatherAPI.com for city:', city, data)
        return c.json({ message: 'Unexpected response from weather service' }, 500)
      }

    } catch (error) {
      console.error(`Failed to fetch weather data for city '${city}':`, error)
      return c.json({ message: 'Failed to connect to weather service' }, 503)
    }
  }
)

api.post(
  '/subscribe',
  zValidator('form', subscriptionFormSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid input',
          errors: result.error.flatten().fieldErrors,
        },
        400
      );
    }
  }),
  async (c) => {
    const { email, city, frequency } = c.req.valid('form');
    const generatedTokenValue = crypto.randomBytes(32).toString('hex');

    try {
      const apiKey = c.env.WEATHER_API_KEY || process.env.WEATHER_API_KEY;

      if (!apiKey) {
        console.error('WEATHER_API_KEY is not set for city validation.');
        return c.json({ message: 'Server configuration error, please try again later.' }, 500);
      }

      const weatherApiUrl = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}`;

      try {
        const weatherResponse = await fetch(weatherApiUrl);
        const weatherData = await weatherResponse.json() as WeatherApiComCurrentResponse;

        if (weatherData.error) {
          if (weatherData.error.code === 1006) {
            return c.json({ message: `Invalid city: '${city}' not found.` }, 400);
          }
          console.warn(`WeatherAPI.com pre-check error for city '${city}':`, weatherData.error);
          return c.json({ message: 'Could not verify city with weather service at this time.' }, 502);
        }

        if (!weatherData.location || !weatherData.current) {
           console.warn(`WeatherAPI.com pre-check for city '${city}' returned no location/current data.`);
           return c.json({ message: `Could not verify city: '${city}'. Please ensure it's a known location.` }, 400);
        }
      } catch (e) {
        console.error(`Failed to fetch weather data for city validation '${city}':`, e);
        return c.json({ message: 'Failed to connect to weather service for city validation.' }, 503);
      }

      const domain = email.split('@')[1];
      if (!domain) {
        return c.json({ message: 'Invalid email format: domain missing' }, 400);
      }
      try {
        const mxRecords = await dns.resolveMx(domain);

        if (!mxRecords || mxRecords.length === 0) {
          return c.json({ message: 'Email domain does not accept emails' }, 400);
        }
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err) {
          console.warn(`DNS lookup for ${domain} failed:`, err.code || err.message);
          // ENODATA - No data
          // ENOTFOUND - Not found
          if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
            return c.json({ message: 'Email domain does not exist or has no mail servers' }, 400);
          }
        }

        return c.json({ message: 'Could not verify email domain' }, 400);
      }

      const existingSubscription = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.email, email))
        .limit(1);

      if (existingSubscription.length > 0) {
        return c.json({ message: 'Email already subscribed' }, 409);
      }

      const newSubscriptionRows = await db
        .insert(subscriptions)
        .values({
          email,
          city,
          frequency,
          confirmed: false,
        })
        .returning();

      if (!newSubscriptionRows || newSubscriptionRows.length === 0 || !newSubscriptionRows[0]?.id) {
        console.error('Failed to insert subscription or retrieve ID', newSubscriptionRows);
        return c.json({ message: 'Could not process subscription due to a server error (S1).' }, 500);
      }
      const subscriptionId = newSubscriptionRows[0].id;

      const tokenExpiryDate = new Date();
      tokenExpiryDate.setDate(tokenExpiryDate.getDate() + 1);

      await db.insert(tokens).values({
        subscriptionId: subscriptionId,
        token: generatedTokenValue,
        type: "confirmation",
        expiresAt: tokenExpiryDate,
      });

      const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const confirmationLink = `${apiBaseUrl}/api/confirm/${generatedTokenValue}`;

      const emailSent = await sendEmail({
        to: email,
        subject: 'Confirm Your Weather API Subscription',
        text: `Welcome to Weather API! Please confirm your subscription by clicking this link: ${confirmationLink}`,
        html: `<p>Welcome to Weather API!</p><p>Please confirm your subscription by clicking this link: <a href="${confirmationLink}">${confirmationLink}</a></p>`,
      });

      if (!emailSent) {
        // Log the error, but still return success to the user as subscription was created.
        // The user was told a confirmation email would be sent.
        // For a more robust system, you might queue the email for retry.
        console.error(`Failed to send confirmation email to ${email}, but subscription created (ID: ${subscriptionId}).`);
      }

      return c.json({ message: 'Subscription successful. Confirmation email sent.' }, 200);

    } catch (error: any) {
      console.error('Error during subscription process:', error);
      if (error.message) {
        console.error('DB Error Message:', error.message);
      }
      return c.json({ message: 'Could not process subscription due to a server error (S2).' }, 500);
    }
  }
);

api.get(
  '/confirm/:token',
  zValidator('param', tokenPathSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid token format',
          errors: result.error.flatten().fieldErrors,
        },
        400
      );
    }
  }),
  async (c) => {
    const { token: confirmationTokenValue } = c.req.valid('param');

    try {
      const tokenRecords = await db
        .select({
          subscriptionId: tokens.subscriptionId,
          tokenId: tokens.id,
          type: tokens.type,
          expiresAt: tokens.expiresAt,
        })
        .from(tokens)
        .where(eq(tokens.token, confirmationTokenValue))
        .limit(1);

      if (tokenRecords.length === 0) {
        return c.json({ message: 'Token not found or already used' }, 404);
      }

      const tokenInfo = tokenRecords[0];

      if (tokenInfo.type !== 'confirmation') {
        return c.json({ message: 'Invalid token type' }, 400);
      }

      if (tokenInfo.expiresAt && new Date(tokenInfo.expiresAt) < new Date()) {
        await db.delete(tokens).where(eq(tokens.id, tokenInfo.tokenId));
        return c.json({ message: 'Token expired' }, 400);
      }

      const { subscriptionId } = tokenInfo;

      const subscriptionEntry = await db
        .select({
          id: subscriptions.id,
          confirmed: subscriptions.confirmed,
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      if (subscriptionEntry.length === 0) {
        return c.json({ message: 'Associated subscription not found' }, 404);
      }

      if (subscriptionEntry[0].confirmed) {
        // If already confirmed, we can consider the token fulfilled, so delete it.
        await db.delete(tokens).where(eq(tokens.id, tokenInfo.tokenId));
        return c.json({ message: 'Subscription already confirmed' }, 200);
      }

      await db
        .update(subscriptions)
        .set({ confirmed: true, updatedAt: new Date() })
        .where(eq(subscriptions.id, subscriptionId));

      await db.delete(tokens).where(eq(tokens.id, tokenInfo.tokenId));

      const unsubscribeTokenValue = crypto.randomBytes(32).toString('hex');
      await db.insert(tokens).values({
        subscriptionId: subscriptionId,
        token: unsubscribeTokenValue,
        type: "unsubscribe",
      });

      return c.json({ message: 'Subscription confirmed successfully' }, 200);

    } catch (error: unknown) {
      console.error('Error during subscription confirmation:', error);
      return c.json({ message: 'Server error during confirmation process' }, 500);
    }
  }
);

api.get(
  '/unsubscribe/:token',
  zValidator('param', tokenPathSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid token format',
          errors: result.error.flatten().fieldErrors,
        },
        400
      );
    }
  }),
  async (c) => {
    const { token: unsubscribeTokenValue } = c.req.valid('param');

    try {
      const tokenRecords = await db
        .select({
          id: tokens.id,
          subscriptionId: tokens.subscriptionId,
          type: tokens.type,
        })
        .from(tokens)
        .where(eq(tokens.token, unsubscribeTokenValue))
        .limit(1);

      if (tokenRecords.length === 0) {
        return c.json({ message: 'Token not found' }, 404);
      }

      const tokenInfo = tokenRecords[0];

      if (tokenInfo.type !== 'unsubscribe') {
        return c.json({ message: 'Invalid token type for unsubscribe operation' }, 400);
      }

      const { subscriptionId } = tokenInfo;

      const subscriptionExists = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      if (subscriptionExists.length === 0) {
        await db.delete(tokens).where(eq(tokens.id, tokenInfo.id));
        return c.json({ message: 'Subscription already removed or not found' }, 200);
      }

      await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));

      await db.delete(tokens).where(eq(tokens.id, tokenInfo.id));

      return c.json({ message: 'Unsubscribed successfully' }, 200);

    } catch (error: unknown) {
      console.error('Error during unsubscribe process:', error);
      return c.json({ message: 'Server error during unsubscribe process' }, 500);
    }
  }
);

app.route('/api', api)

app.get('/', (c) => {
  return c.html(<SubscribePage />)
})

const isTest = process.env.NODE_ENV === 'test';
const isDev = process.env.NODE_ENV === 'development';

if (!isTest) {
  console.log('Access it at http://localhost:8787')
}

// We don't want to run the server during tests and when running with wrangler dev
if (isDev) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
  console.log(`Server is running on port ${port}`)
  console.log(`Access it at http://localhost:${port}`)

  serve({
    fetch: app.fetch,
    port: port,
  })
}

export default app
