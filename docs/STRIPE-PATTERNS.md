# Stripe Common Patterns

This document provides practical patterns and code examples for implementing Stripe in your multi-tenant application.

## Table of Contents

1. [Subscription Management](#subscription-management)
2. [Checkout Implementation](#checkout-implementation)
3. [Customer Portal](#customer-portal)
4. [Webhook Patterns](#webhook-patterns)
5. [Multi-Tenant Billing](#multi-tenant-billing)
6. [Error Handling](#error-handling)
7. [Testing Patterns](#testing-patterns)

## Subscription Management

### Creating a Subscription for a Tenant

```typescript
// app/api/subscriptions/create/route.ts
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { getPayload } from 'payload'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await req.json()
  
  // Get user's tenant
  const userTenants = user.tenants?.[0]
  if (!userTenants) {
    return Response.json({ error: 'No tenant found' }, { status: 400 })
  }
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerID,
    payment_method_types: ['card'],
    line_items: [
      {
        price: 'price_1234567890', // Your price ID
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing?canceled=true`,
    metadata: {
      tenantId: userTenants.tenant,
      userId: user.id,
    },
  })
  
  return Response.json({ sessionId: session.id })
}
```

### Updating Subscription

```typescript
// app/api/subscriptions/update/route.ts
export async function POST(req: Request) {
  const { subscriptionId, priceId } = await req.json()
  
  // Get current subscription
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  
  // Update to new price
  const updatedSubscription = await stripe.subscriptions.update(
    subscriptionId,
    {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
    }
  )
  
  return Response.json({ subscription: updatedSubscription })
}
```

### Canceling Subscription

```typescript
// app/api/subscriptions/cancel/route.ts
export async function POST(req: Request) {
  const { subscriptionId, immediately = false } = await req.json()
  
  if (immediately) {
    // Cancel immediately
    const subscription = await stripe.subscriptions.cancel(subscriptionId)
    return Response.json({ subscription })
  } else {
    // Cancel at period end
    const subscription = await stripe.subscriptions.update(
      subscriptionId,
      { cancel_at_period_end: true }
    )
    return Response.json({ subscription })
  }
}
```

## Checkout Implementation

### React Component for Checkout

```typescript
// components/CheckoutButton.tsx
'use client'

import { loadStripe } from '@stripe/stripe-js'
import { useState } from 'react'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

export function CheckoutButton({ 
  priceId, 
  tenantId 
}: { 
  priceId: string
  tenantId: string 
}) {
  const [loading, setLoading] = useState(false)
  
  const handleCheckout = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, tenantId }),
      })
      
      const { sessionId } = await response.json()
      const stripe = await stripePromise
      
      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId })
        if (error) {
          console.error('Stripe error:', error)
        }
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? 'Loading...' : 'Subscribe Now'}
    </button>
  )
}
```

### Embedded Checkout

```typescript
// components/EmbeddedCheckout.tsx
'use client'

import { EmbeddedCheckout } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

export function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  return (
    <EmbeddedCheckout
      stripe={stripePromise}
      options={{ clientSecret }}
    />
  )
}
```

## Customer Portal

### Creating Portal Session

```typescript
// app/api/customer-portal/route.ts
export async function POST(req: Request) {
  const { customerId, tenantId } = await req.json()
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard`,
    configuration: 'bpc_1234567890', // Optional: custom configuration
  })
  
  return Response.json({ url: session.url })
}
```

### Portal Button Component

```typescript
// components/CustomerPortalButton.tsx
'use client'

export function CustomerPortalButton({ customerId }: { customerId: string }) {
  const handlePortal = async () => {
    const response = await fetch('/api/customer-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    })
    
    const { url } = await response.json()
    window.location.href = url
  }
  
  return (
    <button onClick={handlePortal} className="btn btn-secondary">
      Manage Subscription
    </button>
  )
}
```

## Webhook Patterns

### Webhook Handler with Tenant Context

```typescript
// app/api/stripe/webhooks/route.ts
import { headers } from 'next/headers'
import { getPayload } from 'payload'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET!
    )
  } catch (err) {
    return new Response('Webhook signature verification failed', { 
      status: 400 
    })
  }
  
  const payload = await getPayload({ config })
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object, payload)
      break
      
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object, payload)
      break
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object, payload)
      break
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object, payload)
      break
  }
  
  return Response.json({ received: true })
}

async function handleCheckoutComplete(
  session: Stripe.Checkout.Session,
  payload: Payload
) {
  const { tenantId, userId } = session.metadata || {}
  
  if (!tenantId || !userId) {
    console.error('Missing metadata in checkout session')
    return
  }
  
  // Create subscription record
  await payload.create({
    collection: 'subscriptions',
    data: {
      tenant: tenantId,
      user: userId,
      stripeSubscriptionId: session.subscription as string,
      status: 'active',
      currentPeriodEnd: new Date(session.expires_at * 1000),
    },
  })
  
  // Update tenant status
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      subscriptionStatus: 'active',
      subscriptionId: session.subscription as string,
    },
  })
}
```

### Webhook Queue Pattern

```typescript
// lib/webhook-queue.ts
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export const webhookQueue = new Queue('stripe-webhooks', {
  connection: redis,
})

// Add to queue
export async function queueWebhook(event: Stripe.Event) {
  await webhookQueue.add(event.type, event, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  })
}

// Process queue
import { Worker } from 'bullmq'

const worker = new Worker(
  'stripe-webhooks',
  async (job) => {
    const event = job.data as Stripe.Event
    await processWebhookEvent(event)
  },
  { connection: redis }
)
```

## Multi-Tenant Billing

### Per-Tenant Subscription Model

```typescript
// collections/TenantSubscriptions.ts
import type { CollectionConfig } from 'payload'

export const TenantSubscriptions: CollectionConfig = {
  slug: 'tenantSubscriptions',
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      unique: true,
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ['active', 'canceled', 'past_due', 'trialing'],
      required: true,
    },
    {
      name: 'plan',
      type: 'select',
      options: ['starter', 'pro', 'enterprise'],
      required: true,
    },
    {
      name: 'seats',
      type: 'number',
      defaultValue: 1,
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      required: true,
    },
  ],
  access: {
    read: ({ req }) => {
      if (req.user?.roles?.includes('super-admin')) return true
      
      return {
        tenant: {
          in: req.user?.tenants?.map(t => t.tenant) || [],
        },
      }
    },
  },
}
```

### Usage-Based Billing

```typescript
// lib/usage-tracking.ts
export async function trackUsage(
  tenantId: string,
  metric: string,
  quantity: number
) {
  const payload = await getPayload({ config })
  
  // Get tenant's subscription
  const subscription = await payload.find({
    collection: 'tenantSubscriptions',
    where: {
      tenant: { equals: tenantId },
      status: { equals: 'active' },
    },
  })
  
  if (!subscription.docs[0]) {
    throw new Error('No active subscription found')
  }
  
  // Report usage to Stripe
  const subscriptionItem = subscription.docs[0].stripeSubscriptionItemId
  
  await stripe.subscriptionItems.createUsageRecord(
    subscriptionItem,
    {
      quantity,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    }
  )
  
  // Store in database for tracking
  await payload.create({
    collection: 'usageRecords',
    data: {
      tenant: tenantId,
      metric,
      quantity,
      timestamp: new Date(),
    },
  })
}
```

## Error Handling

### Comprehensive Error Handler

```typescript
// lib/stripe-errors.ts
export class StripeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'StripeError'
  }
}

export async function handleStripeOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    console.error(`Stripe error in ${context}:`, error)
    
    if (error.type === 'StripeCardError') {
      throw new StripeError(
        'Your card was declined',
        'card_declined',
        400
      )
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      throw new StripeError(
        'Invalid request to payment provider',
        'invalid_request',
        400
      )
    }
    
    if (error.type === 'StripeAPIError') {
      throw new StripeError(
        'Payment provider error',
        'api_error',
        500
      )
    }
    
    throw new StripeError(
      'An unexpected error occurred',
      'unknown_error',
      500
    )
  }
}
```

### React Error Boundary

```typescript
// components/StripeErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class StripeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Stripe error:', error, errorInfo)
    
    // Send to error tracking service
    if (typeof window !== 'undefined') {
      // Sentry, LogRocket, etc.
    }
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Payment Error</h2>
          <p>We encountered an error processing your payment.</p>
          <button onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      )
    }
    
    return this.props.children
  }
}
```

## Testing Patterns

### Test Helpers

```typescript
// tests/stripe-helpers.ts
import Stripe from 'stripe'

export const testStripe = new Stripe('sk_test_...', {
  apiVersion: '2024-11-20.acacia',
})

export async function createTestCustomer(email: string) {
  return await testStripe.customers.create({
    email,
    metadata: { test: 'true' },
  })
}

export async function createTestSubscription(
  customerId: string,
  priceId: string
) {
  return await testStripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: 0,
  })
}

export async function cleanupTestData() {
  // Delete test customers
  const customers = await testStripe.customers.list({
    limit: 100,
  })
  
  for (const customer of customers.data) {
    if (customer.metadata?.test === 'true') {
      await testStripe.customers.del(customer.id)
    }
  }
}
```

### Integration Tests

```typescript
// tests/subscription.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestCustomer, cleanupTestData } from './stripe-helpers'

describe('Subscription Management', () => {
  let testCustomerId: string
  
  beforeEach(async () => {
    const customer = await createTestCustomer('test@example.com')
    testCustomerId = customer.id
  })
  
  afterEach(async () => {
    await cleanupTestData()
  })
  
  it('should create a subscription', async () => {
    const response = await fetch('/api/subscriptions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        priceId: 'price_test_123',
      }),
    })
    
    expect(response.ok).toBe(true)
    const data = await response.json()
    expect(data.subscription).toBeDefined()
    expect(data.subscription.status).toBe('active')
  })
})
```

### Mock Webhook Testing

```typescript
// tests/webhooks.test.ts
import crypto from 'crypto'

function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  
  return `t=${timestamp},v1=${signature}`
}

describe('Webhook Handler', () => {
  it('should process subscription created', async () => {
    const event = {
      id: 'evt_test_123',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'active',
        },
      },
    }
    
    const payload = JSON.stringify(event)
    const signature = generateWebhookSignature(
      payload,
      process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET!
    )
    
    const response = await fetch('/api/stripe/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    })
    
    expect(response.ok).toBe(true)
  })
})
```

---

These patterns provide practical implementations for common Stripe integration scenarios in a multi-tenant environment. Adapt them to your specific needs and always test thoroughly before deploying to production.
