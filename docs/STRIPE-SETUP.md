# Stripe Setup Guide

This guide walks you through setting up Stripe integration in your multi-tenant Payload CMS application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Account Setup](#stripe-account-setup)
3. [Environment Configuration](#environment-configuration)
4. [Plugin Installation](#plugin-installation)
5. [Database Migration](#database-migration)
6. [Testing the Integration](#testing-the-integration)
7. [Production Deployment](#production-deployment)

## Prerequisites

Before starting, ensure you have:

- ✅ Payload CMS multi-tenant system running
- ✅ PostgreSQL database configured
- ✅ Node.js 18+ installed
- ✅ Access to create a Stripe account

## Stripe Account Setup

### 1. Create Stripe Account

1. Visit [stripe.com](https://stripe.com)
2. Click "Start now" or "Sign up"
3. Complete the registration process
4. Verify your email address

### 2. Get API Keys

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers → API keys**
3. You'll see two types of keys:
   - **Test keys** (for development)
   - **Live keys** (for production)

4. Copy your test keys:
   ```
   Publishable key: pk_test_...
   Secret key: sk_test_...
   ```

### 3. Configure Webhooks

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   - Development: `https://your-ngrok-url.ngrok.io/api/stripe/webhooks`
   - Production: `https://yourdomain.com/api/stripe/webhooks`

4. Select events to listen for:
   ```
   ✓ customer.created
   ✓ customer.updated
   ✓ customer.deleted
   ✓ product.created
   ✓ product.updated
   ✓ subscription.created
   ✓ subscription.updated
   ✓ subscription.deleted
   ✓ invoice.payment_succeeded
   ✓ invoice.payment_failed
   ```

5. Copy the **Signing secret** (starts with `whsec_`)

## Environment Configuration

### 1. Update .env File

Add your Stripe credentials to `.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
STRIPE_WEBHOOKS_ENDPOINT_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

### 2. Verify Configuration

Create a test script to verify your setup:

```typescript
// test-stripe.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

async function testConnection() {
  try {
    const products = await stripe.products.list({ limit: 1 })
    console.log('✅ Stripe connection successful!')
    console.log(`Found ${products.data.length} products`)
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message)
  }
}

testConnection()
```

Run with: `npx tsx test-stripe.ts`

## Plugin Installation

### 1. Install Dependencies

```bash
# If not already installed
pnpm add @payloadcms/plugin-stripe
```

### 2. Configure Plugin

Update `payload.config.ts`:

```typescript
import { stripePlugin } from '@payloadcms/plugin-stripe'

export default buildConfig({
  plugins: [
    // Conditional loading based on environment
    ...(process.env.STRIPE_SECRET_KEY && 
        process.env.STRIPE_SECRET_KEY.startsWith('sk_')
      ? [
          stripePlugin({
            stripeSecretKey: process.env.STRIPE_SECRET_KEY,
            isTestKey: process.env.STRIPE_SECRET_KEY.includes('test'),
            stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
            rest: false,
            sync: [
              {
                collection: 'users',
                stripeResourceType: 'customers',
                stripeResourceTypeSingular: 'customer',
                fields: [
                  {
                    fieldPath: 'email',
                    stripeProperty: 'email',
                  },
                  {
                    fieldPath: 'name',
                    stripeProperty: 'name',
                  },
                ],
              },
            ],
          }),
        ]
      : []),
    // Other plugins...
  ],
})
```

## Database Migration

### 1. Stop Development Server

```bash
# Press Ctrl+C to stop the server
```

### 2. Run Database Migration

When you start the server with Stripe enabled, it will prompt about schema changes:

```bash
pnpm dev
```

You'll see:
```
? Warnings detected during schema push:
· You're about to add stripe_customers table
· You're about to add stripe_products table
· You're about to add stripe_subscriptions table

Accept warnings and push schema to database? (y/N)
```

Type `y` and press Enter to accept.

### 3. Verify Tables Created

Check your database:

```sql
-- List Stripe tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'stripe_%';
```

## Testing the Integration

### 1. Create Test User

1. Go to Admin Panel: `http://localhost:3000/admin`
2. Navigate to **Users**
3. Create a new user
4. Check Stripe Dashboard - a customer should appear

### 2. Test Webhook

Use Stripe CLI for local testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# In another terminal, trigger a test event
stripe trigger customer.created
```

### 3. Create Test Products

In Stripe Dashboard:
1. Go to **Products**
2. Click **"Add product"**
3. Create a test product:
   - Name: "Pro Plan"
   - Price: $29.00/month
   - Recurring billing

### 4. Verify Sync

Check Admin Panel:
- Navigate to **Stripe Products**
- Your product should appear

## Production Deployment

### 1. Environment Variables

Set production environment variables:

```env
# Production Stripe keys (without 'test' in them)
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOKS_ENDPOINT_SECRET=whsec_your_production_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
```

### 2. Update Webhook URL

In Stripe Dashboard:
1. Go to **Webhooks**
2. Add production endpoint
3. Use HTTPS URL: `https://yourdomain.com/api/stripe/webhooks`

### 3. Security Checklist

- [ ] Use environment variables for all keys
- [ ] Enable HTTPS for webhook endpoint
- [ ] Set up webhook signature verification
- [ ] Configure proper CORS settings
- [ ] Enable rate limiting
- [ ] Set up error monitoring

### 4. Database Backup

Before going live:

```bash
# Backup your database
pg_dump your_database > backup_before_stripe.sql
```

## Troubleshooting

### Common Issues

#### 1. "Invalid API Key provided"
- Check your `.env` file
- Ensure no extra spaces in keys
- Verify you're using the correct key type (test/live)

#### 2. Webhook signature verification failed
- Check webhook endpoint secret
- Ensure raw body parsing for webhook route
- Verify URL matches Stripe configuration

#### 3. Customer not syncing
- Check webhook events are enabled
- Verify database migrations completed
- Look for errors in server logs

#### 4. TypeScript errors
```bash
# Regenerate types
pnpm generate:types
```

### Debug Mode

Enable debug logging:

```typescript
// payload.config.ts
stripePlugin({
  // ... other config
  debug: true, // Enable debug logs
})
```

### Logs Location

Check logs for errors:
- Server console output
- Stripe Dashboard → Developers → Logs
- Database query logs

## Next Steps

1. **Create Products**: Set up your product catalog in Stripe
2. **Implement Checkout**: Add payment flows to your app
3. **Set Up Billing Portal**: Allow customers to manage subscriptions
4. **Configure Tax**: Set up tax rates if needed
5. **Test Everything**: Run through complete payment flows

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Payload CMS Stripe Plugin](https://payloadcms.com/docs/plugins/stripe)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Testing Guide](https://stripe.com/docs/testing)

---

With this setup complete, your multi-tenant application is ready to process payments and manage subscriptions through Stripe!
