# Stripe Technical Implementation

This document details the technical implementation of Stripe within the Payload CMS multi-tenant system.

## Table of Contents

1. [Plugin Configuration](#plugin-configuration)
2. [Database Schema](#database-schema)
3. [Collections Created](#collections-created)
4. [Hooks and Middleware](#hooks-and-middleware)
5. [Webhook Handling](#webhook-handling)
6. [Type Definitions](#type-definitions)
7. [Security Considerations](#security-considerations)

## Plugin Configuration

### Basic Setup

```typescript
// payload.config.ts
import { stripePlugin } from '@payloadcms/plugin-stripe'

export default buildConfig({
  plugins: [
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      isTestKey: process.env.STRIPE_SECRET_KEY?.includes('test') ?? false,
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
      rest: false, // Disable REST API endpoints
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
          ],
        },
      ],
    }),
  ],
})
```

### Conditional Loading

```typescript
// Only load if valid keys are provided
plugins: [
  ...(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')
    ? [stripePlugin(stripeConfig)]
    : []),
]
```

## Database Schema

### Automatic Fields Added

When the Stripe plugin is enabled, it adds fields to synced collections:

#### Users Collection
```typescript
{
  // Existing user fields...
  stripeCustomerID: string    // Stripe customer identifier
  skipSync?: boolean          // Skip Stripe synchronization
}
```

### Plugin-Created Tables

The plugin creates these tables automatically:

#### stripe_customers
```sql
CREATE TABLE stripe_customers (
  id SERIAL PRIMARY KEY,
  stripe_id VARCHAR(255) UNIQUE NOT NULL,
  payload_id INTEGER REFERENCES users(id),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### stripe_products
```sql
CREATE TABLE stripe_products (
  id SERIAL PRIMARY KEY,
  stripe_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### stripe_subscriptions
```sql
CREATE TABLE stripe_subscriptions (
  id SERIAL PRIMARY KEY,
  stripe_id VARCHAR(255) UNIQUE NOT NULL,
  customer_id VARCHAR(255) REFERENCES stripe_customers(stripe_id),
  status VARCHAR(50),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Collections Created

### stripeCustomers

Automatically synced with Stripe:

```typescript
{
  slug: 'stripeCustomers',
  admin: {
    group: 'Stripe',
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'stripeID',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'name',
      type: 'text',
    },
    // Additional Stripe customer fields...
  ],
}
```

### stripeProducts

Product catalog synchronization:

```typescript
{
  slug: 'stripeProducts',
  admin: {
    group: 'Stripe',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'stripeID',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    // Price information...
  ],
}
```

### stripeSubscriptions

Subscription management:

```typescript
{
  slug: 'stripeSubscriptions',
  admin: {
    group: 'Stripe',
  },
  fields: [
    {
      name: 'stripeID',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'stripeCustomers',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        'active',
        'canceled',
        'incomplete',
        'past_due',
        'trialing',
        'unpaid',
      ],
    },
    // Billing cycle fields...
  ],
}
```

## Hooks and Middleware

### Collection Hooks

The plugin automatically adds hooks to synced collections:

#### beforeChange Hook
```typescript
async ({ data, operation, req }) => {
  if (operation === 'create' && !data.skipSync) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: data.email,
      metadata: {
        payloadID: data.id,
      },
    })
    
    // Store Stripe ID
    data.stripeCustomerID = customer.id
  }
  
  return data
}
```

#### afterChange Hook
```typescript
async ({ doc, operation, previousDoc, req }) => {
  if (operation === 'update' && !doc.skipSync) {
    // Sync changes to Stripe
    const changes = getChangedFields(previousDoc, doc)
    
    if (changes.email) {
      await stripe.customers.update(doc.stripeCustomerID, {
        email: doc.email,
      })
    }
  }
}
```

### Webhook Middleware

The plugin adds webhook endpoints:

```typescript
// Automatic webhook endpoint
app.post('/api/stripe/webhooks', async (req, res) => {
  const sig = req.headers['stripe-signature']
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET
    )
    
    // Handle event based on type
    switch (event.type) {
      case 'customer.updated':
        await handleCustomerUpdate(event.data.object)
        break
      case 'subscription.created':
        await handleSubscriptionCreated(event.data.object)
        break
      // More event handlers...
    }
    
    res.json({ received: true })
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`)
  }
})
```

## Webhook Handling

### Event Processing

```typescript
// Customer update handler
async function handleCustomerUpdate(customer: Stripe.Customer) {
  const payloadID = customer.metadata.payloadID
  
  if (payloadID) {
    await payload.update({
      collection: 'users',
      id: payloadID,
      data: {
        email: customer.email,
        skipSync: true, // Prevent sync loop
      },
    })
  }
}

// Subscription created handler
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  await payload.create({
    collection: 'stripeSubscriptions',
    data: {
      stripeID: subscription.id,
      customer: subscription.customer,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  })
}
```

### Webhook Security

```typescript
// Verify webhook signature
const verifyWebhookSignature = (
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event => {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

// Idempotency handling
const processedEvents = new Set<string>()

const handleWebhook = async (event: Stripe.Event) => {
  if (processedEvents.has(event.id)) {
    return { status: 'already_processed' }
  }
  
  // Process event...
  processedEvents.add(event.id)
  
  // Clean up old events periodically
  if (processedEvents.size > 10000) {
    processedEvents.clear()
  }
}
```

## Type Definitions

### Extended User Type

```typescript
interface StripeUser extends User {
  stripeCustomerID?: string
  skipSync?: boolean
}
```

### Stripe Resource Types

```typescript
interface StripeCustomer {
  id: string
  stripeID: string
  email: string
  name?: string
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

interface StripeSubscription {
  id: string
  stripeID: string
  customer: string | StripeCustomer
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  metadata: Record<string, any>
}
```

### Multi-Tenant Extensions

```typescript
interface TenantSubscription extends StripeSubscription {
  tenant: string | Tenant
  seats?: number
  features?: string[]
}
```

## Security Considerations

### API Key Management

```typescript
// Never expose keys in client code
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

// Validate key format
if (!stripeSecretKey?.startsWith('sk_')) {
  throw new Error('Invalid Stripe secret key format')
}

// Use test keys in development
const isTestMode = stripeSecretKey.includes('test')
```

### Webhook Verification

```typescript
// Always verify webhook signatures
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }))

// Store webhook secret securely
const webhookSecret = process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET

if (!webhookSecret) {
  console.warn('Stripe webhook secret not configured')
}
```

### Data Privacy

```typescript
// Don't store sensitive data
const sanitizeCustomerData = (customer: Stripe.Customer) => {
  const { id, email, name, metadata } = customer
  // Don't store payment methods, addresses, etc.
  return { id, email, name, metadata }
}

// Use Stripe for PCI compliance
// Never store card numbers, CVV, etc.
```

### Rate Limiting

```typescript
// Implement rate limiting for API calls
import rateLimit from 'express-rate-limit'

const stripeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests to Stripe endpoints',
})

app.use('/api/stripe', stripeLimiter)
```

## Error Handling

### Stripe API Errors

```typescript
try {
  const customer = await stripe.customers.create({ email })
} catch (error) {
  if (error.type === 'StripeCardError') {
    // Card was declined
  } else if (error.type === 'StripeInvalidRequestError') {
    // Invalid parameters
  } else if (error.type === 'StripeAPIError') {
    // API errors
  } else {
    // Unknown error
  }
}
```

### Webhook Error Recovery

```typescript
// Implement retry logic
const processWebhookWithRetry = async (
  event: Stripe.Event,
  maxRetries = 3
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await processWebhook(event)
      return
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
}
```

## Performance Optimization

### Caching

```typescript
// Cache Stripe data
const stripeCache = new Map()

const getCachedCustomer = async (id: string) => {
  if (stripeCache.has(id)) {
    return stripeCache.get(id)
  }
  
  const customer = await stripe.customers.retrieve(id)
  stripeCache.set(id, customer)
  
  // Expire after 5 minutes
  setTimeout(() => stripeCache.delete(id), 5 * 60 * 1000)
  
  return customer
}
```

### Batch Operations

```typescript
// Batch webhook processing
const webhookQueue: Stripe.Event[] = []

const processBatchWebhooks = async () => {
  if (webhookQueue.length === 0) return
  
  const batch = webhookQueue.splice(0, 100)
  
  await Promise.all(
    batch.map(event => processWebhook(event))
  )
}

// Process every 5 seconds
setInterval(processBatchWebhooks, 5000)
```

---

This technical documentation provides the implementation details for integrating Stripe with your multi-tenant Payload CMS application. For setup instructions, see the [Setup Guide](./STRIPE-SETUP.md).
