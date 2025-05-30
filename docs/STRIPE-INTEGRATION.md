# Stripe Integration Guide

This guide explains how to use the Stripe integration in the multi-tenant system for handling payments and subscriptions.

## Overview

The Stripe integration provides:
- Customer management synced with Stripe
- Product catalog synchronization
- Subscription management per tenant
- Webhook handling for real-time updates

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOKS_ENDPOINT_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 2. Get Your Stripe Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → API keys
3. Copy your test keys (or live keys for production)

### 3. Set Up Webhooks

1. In Stripe Dashboard, go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhooks`
3. Select events to listen for:
   - `customer.created`
   - `customer.updated`
   - `product.created`
   - `product.updated`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.deleted`
4. Copy the webhook signing secret

## Collections

The Stripe plugin automatically creates these collections:

### stripeCustomers

Automatically synced with Stripe customers:
- Created when users are synced to Stripe
- Updated via webhooks
- Linked to your Users collection

### stripeProducts

Manages your product catalog:
- Synced with Stripe products
- Includes pricing information
- Updated automatically via webhooks

### stripeSubscriptions

Tracks subscriptions:
- Synced with Stripe subscriptions
- Status updates via webhooks
- Links customers to products

### User-Customer Sync

The plugin is configured to sync Users with Stripe Customers:

```typescript
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
```

This means:
- When a user is created, a Stripe customer is created
- Email addresses are kept in sync
- The user gets a `stripeCustomerID` field

## Usage Examples

### Creating a Product

1. Create the product in Stripe Dashboard first
2. It will sync to Payload automatically via webhooks
3. Or use the Stripe API to create products programmatically
4. Products appear in Admin Panel → Stripe Products

### Creating a Customer

Customers are created automatically:

1. When a new user signs up
2. The sync configuration creates a Stripe customer
3. The user's `stripeCustomerID` field is populated
4. View in Admin Panel → Stripe Customers

### Managing Subscriptions

Subscriptions are created via your frontend using Stripe Checkout or Elements:

```javascript
// Example: Create checkout session
const response = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    priceId: 'price_xxx',
    customerId: 'cus_xxx',
    tenantId: 'tenant_id'
  })
});

const { sessionId } = await response.json();
// Redirect to Stripe Checkout
```

## Multi-Tenant Considerations

### Tenant Isolation

- Each subscription is linked to a specific tenant
- Customers can belong to multiple tenants
- Access control ensures users only see their tenant's data

### Billing Per Tenant

Common patterns:

1. **One Subscription Per Tenant**
   - Each tenant has its own subscription
   - Tenant admins manage their billing

2. **User-Based Billing**
   - Count users per tenant
   - Charge based on seat count

3. **Usage-Based Billing**
   - Track feature usage per tenant
   - Bill based on consumption

### Example: Tenant Subscription Flow

```typescript
// 1. User signs up for a tenant
const user = await createUser({ email, tenantId });

// 2. Create or get Stripe customer
const customer = await payload.create({
  collection: 'customers',
  data: {
    email: user.email,
    name: user.name,
    user: user.id
  }
});

// 3. Create subscription for tenant
const subscription = await createStripeSubscription({
  customer: customer.stripeCustomerID,
  items: [{ price: 'price_xxx' }],
  metadata: { tenantId: tenant.id }
});

// 4. Store in Payload
await payload.create({
  collection: 'subscriptions',
  data: {
    tenant: tenant.id,
    customer: customer.id,
    stripeSubscriptionID: subscription.id,
    status: subscription.status,
    products: [productId]
  }
});
```

## Webhook Handling

The Stripe plugin automatically handles webhooks for synced resources:

- Customer updates sync to the Customers collection
- Product changes sync to the Products collection
- Subscription events update the Subscriptions collection

### Custom Webhook Logic

For custom logic, create a webhook handler:

```typescript
// app/api/stripe/custom-webhook/route.ts
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET!
    );
  } catch (err) {
    return new Response('Webhook Error', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // Handle successful checkout
      break;
    case 'invoice.payment_failed':
      // Handle failed payment
      break;
  }

  return new Response('Success', { status: 200 });
}
```

## Access Control

### Products
- **Read**: Public (anyone can view products)
- **Create/Update/Delete**: Super admins only

### Customers
- **Read**: Authenticated users
- **Create**: Authenticated users
- **Update**: Users can update their own customer record
- **Delete**: Super admins only

### Subscriptions
- **Read**: Users can see subscriptions for their tenants
- **Create/Update/Delete**: Super admins only (managed via Stripe)

## Testing

### Test Cards

Use these test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

### Test Webhooks

Use Stripe CLI for local testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# Trigger test events
stripe trigger payment_intent.succeeded
```

## Best Practices

1. **Always use webhooks** for subscription status updates
2. **Store price IDs** not amounts, to handle price changes
3. **Use metadata** to link Stripe objects to your tenants
4. **Implement retry logic** for failed webhook processing
5. **Monitor webhook failures** in Stripe dashboard

## Troubleshooting

### Common Issues

1. **Webhook signature verification failed**
   - Check your webhook endpoint secret
   - Ensure you're using the raw request body

2. **Customer not syncing**
   - Verify webhook events are enabled
   - Check Stripe dashboard for failed webhooks

3. **TypeScript errors**
   - Run `pnpm generate:types` after adding collections
   - Ensure all collections are imported in payload.config.ts

## Next Steps

1. Set up your Stripe account
2. Configure environment variables
3. Create your product catalog
4. Implement checkout flow
5. Test with Stripe test mode
6. Monitor in Stripe dashboard

For more details, see the [Stripe Documentation](https://stripe.com/docs).
