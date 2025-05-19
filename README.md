# Weather API

A service that allows users to subscribe to regular weather updates for a chosen city. Users receive weather forecasts via email at their selected frequency (daily or hourly).

## Features / Cases Handled

*   **User Subscription**: Users can subscribe by providing their email, city, and desired update frequency (hourly/daily).
*   **Email Confirmation**: New subscriptions require email confirmation. A unique token is generated and sent to the user's email. The subscription becomes active only after confirming via the link.
*   **Scheduled Weather Updates**: Confirmed subscribers receive weather forecasts for their chosen city at the specified frequency. (Actual scheduling mechanism to be detailed based on implementation - e.g., Cloudflare Cron Triggers).
*   **Unsubscription**: Users can unsubscribe at any time using a unique token provided in the weather update emails.
*   **Weather Data**: Fetches current weather information from [WeatherAPI.com](http://weatherapi.com/).
*   **Input Validation**:
    *   Validates email format.
    *   Checks for valid city names (actual validation against WeatherAPI.com or a predefined list).
    *   Ensures frequency is either "hourly" or "daily".
*   **Security Considerations**:
    *   **Token Generation**: Secure and unique tokens for email confirmation and unsubscription to prevent guessing.
    *   **Rate Limiting**: (To be implemented) To protect against abuse of API endpoints.
    *   **Email DNS Check**: (To be implemented) To verify the existence of the email domain.
    *   **Prevent Brute Force**: (To be implemented) Measures to prevent brute-force attacks on unsubscription tokens.
*   **Database Migrations**: Database schema migrations are handled automatically on service startup using Drizzle ORM.

## Tech Stack

*   **Framework**: [Hono](https://hono.dev/) - A small, simple, and ultrafast web framework for the Edge.
*   **Database**: [Neon](https://neon.tech/) (PostgreSQL) - Serverless PostgreSQL.
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM for SQL databases.
*   **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless execution environment.
*   **Email Service**: [Nodemailer](https://nodemailer.com/) - For sending confirmation and weather update emails.
*   **Testing**: [Vitest](https://vitest.dev/) - A blazing fast unit test framework powered by Vite.
*   **Containerization**: [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) - For local development and consistent environments.
*   **API Specification**: [Swagger (OpenAPI 2.0)](https://swagger.io/)

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (version >= specified in `package.json` or LTS)
*   [Bun](https://bun.sh/) (optional, but used for some scripts like `bun run cf-typegen`)
*   [Docker](https://www.docker.com/products/docker-desktop/)
*   A [WeatherAPI.com](http://weatherapi.com/) API Key.
*   A [Neon](https://neon.tech/) database URL.
*   Email provider credentials for Nodemailer (e.g., SMTP server details or an API key for a transactional email service).

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # bun install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add the following variables. You can also copy `wrangler.jsonc` to `.dev.vars` for Cloudflare local development if preferred.

    ```env
    DATABASE_URL="your_neon_database_url_with_pooled_connection_if_applicable"
    WEATHER_API_KEY="your_weatherapi_com_key"

    # Nodemailer configuration (example for SMTP)
    EMAIL_HOST="your_smtp_host"
    EMAIL_PORT="your_smtp_port" # e.g., 587 or 465
    EMAIL_USER="your_email_username"
    EMAIL_PASS="your_email_password"
    EMAIL_FROM='"Weather API" <noreply@example.com>' # Sender address

    # Base URL for confirmation/unsubscription links (e.g., your Cloudflare Worker URL or http://localhost:8787 for local dev)
    APP_BASE_URL="http://localhost:8787"
    ```
    *Note: For Cloudflare Workers local development (`npm run dev`), environment variables can also be managed via a `.dev.vars` file (untracked by git) or by passing them directly in `wrangler.jsonc` (for secrets, use `wrangler secret put`).*

4.  **Run database migrations:**
    Migrations are configured to run when the application starts. Drizzle Kit is used for generating migration files.
    To generate a new migration after schema changes:
    ```bash
    npm run db:generate
    ```

5.  **Start the development server (using Wrangler for Cloudflare Workers emulation):**
    ```bash
    npm run dev
    ```
    This will typically start the server on `http://localhost:8787`.

6.  **To run with Docker (if services are fully containerized, including the app):**
    ```bash
    docker compose up -d
    ```
    *(Ensure your `docker-compose.yaml` is configured to pass necessary environment variables to the application service and that the application within Docker can connect to the database, which might be running outside Docker if it's Neon).*

### Running Tests

```bash
npm test
# or
npm run test:watch # for interactive watch mode
```

## API Endpoints

The API is documented using Swagger (OpenAPI 2.0). You can view the `swagger.yaml` file or use an online editor like [Swagger Editor](https://editor.swagger.io/) by pasting the content of `swagger.yaml`.

Key endpoints include:

*   `GET /api/weather?city={city}`: Get current weather for a city.
*   `POST /api/subscribe`: Subscribe to weather updates.
    *   **Form Data**: `email`, `city`, `frequency` (`hourly` or `daily`).
*   `GET /api/confirm/{token}`: Confirm email subscription.
*   `GET /api/unsubscribe/{token}`: Unsubscribe from weather updates.

## Deployment

This API is designed to be deployed on **Cloudflare Workers**.

1.  **Configure `wrangler.jsonc`**: Ensure your `name`, `account_id`, and other settings are correct.
2.  **Set secrets**:
    ```bash
    npx wrangler secret put DATABASE_URL
    npx wrangler secret put WEATHER_API_KEY
    npx wrangler secret put EMAIL_HOST
    npx wrangler secret put EMAIL_PORT
    npx wrangler secret put EMAIL_USER
    npx wrangler secret put EMAIL_PASS
    npx wrangler secret put EMAIL_FROM
    npx wrangler secret put APP_BASE_URL # Your deployed worker URL
    ```
3.  **Deploy**:
    ```bash
    npm run deploy
    ```

The deployed API will be available at the URL provided by Cloudflare after deployment (e.g., `https://<worker-name>.<your-account-name>.workers.dev`).

---

**Note on Email Confirmation Timeout**:
As per the requirements, if an email confirmation is not received within a few hours, the system should ideally stop trying to send forecasts. This can be implemented by:
1.  Storing a `createdAt` timestamp for unconfirmed subscriptions.
2.  Having a scheduled task (e.g., a Cloudflare Cron Trigger) that periodically cleans up unconfirmed subscriptions older than a defined threshold (e.g., 24 hours).
Subscribers who haven't confirmed within this window would need to subscribe again. 