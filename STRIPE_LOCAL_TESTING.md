# Testing Stripe Integration Locally

This guide will help you test the Stripe integration on localhost.

## Prerequisites

1. **Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Stripe CLI**: Install for webhook testing

## Step 1: Get Your Test Keys

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top right)
3. Go to **Developers → API keys**
4. Copy your test keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

## Step 2: Update Your .env File

```env
# Replace with your actual test keys
STRIPE_SECRET_KEY=sk_test_your_actual_test_secret_key
STRIPE_WEBHOOKS_ENDPOINT_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_test_publishable_key
```

## Step 3: Install Stripe CLI

### macOS
```bash
brew install stripe/stripe-cli/stripe
```

### Windows
```bash
# Download from https://github.com/stripe/stripe-cli/releases
# Or use Scoop: scoop install stripe
```

### Linux
```bash
# Download the latest linux tar.gz file from https://github.com/stripe/stripe-cli/releases
tar -xvf stripe_X.X.X_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

## Step 4: Set Up Webhook Testing

1. **Login to Stripe CLI**:
   ```bash
   stripe login
   ```
   This will open your browser to authenticate.

2. **Start webhook forwarding**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhooks
   ```

3. **Copy the webhook signing secret** that appears:
   ```
   Ready! Your webhook signing secret is whsec_test_xxxxx
   ```

4. **Update your .env** with this secret:
   ```env
   STRIPE_WEBHOOKS_ENDPOINT_SECRET=whsec_test_xxxxx
   ```

## Step 5: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C)
# Start it again
pnpm dev
```

When prompted about schema changes, type `y` to accept.

## Step 6: Test the Integration

### 1. Create a Test User

1. Go to http://localhost:3000/admin
2. Navigate to **Users**
3. Create a new user with email
4. Check Stripe Dashboard → **Customers**
5. You should see the new customer!

### 2. Test Webhook Events

In a new terminal, trigger test events:

```bash
# Test customer creation
stripe trigger customer.created

# Test customer update
stripe trigger customer.updated

# Test subscription creation
stripe trigger customer.subscription.created
```

Watch your server logs for webhook processing.

### 3. Create Test Products in Stripe

1. Go to Stripe Dashboard → **Products**
2. Click **Add product**
3. Create a test product:
   - Name: "Pro Plan"
   - Price: $29.00
   - Billing: Monthly

### 4. Test Checkout (Optional)

Create a simple test page:

```typescript
// app/test-checkout/page.tsx
'use client'

import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function TestCheckout() {
  const handleCheckout = async () => {
    const stripe = await stripePromise
    
    // You'll need to create a checkout session endpoint
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: 'price_xxx', // Get from Stripe Dashboard
      }),
    })
    
    const { sessionId } = await response.json()
    await stripe?.redirectToCheckout({ sessionId })
  }
  
  return (
    <button onClick={handleCheckout}>
      Test Checkout
    </button>
  )
}
```

## Test Card Numbers

Use these test cards in Stripe Checkout:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Use any future date for expiry and any 3 digits for CVC.

## Monitoring

### Server Logs
Watch your terminal running `pnpm dev` for:
- Webhook received messages
- Sync operations
- Any errors

### Stripe CLI
The terminal running `stripe listen` shows:
- Incoming webhooks
- Event types
- Response status

### Stripe Dashboard
Check these sections:
- **Customers**: See synced users
- **Events**: View all API activity
- **Logs**: Detailed request/response data

## Troubleshooting

### "Invalid API Key"
- Make sure you're using test keys (contain "test")
- Check for extra spaces in .env file
- Restart dev server after changing .env

### Webhooks Not Working
- Ensure Stripe CLI is running
- Check the webhook secret is correct
- Verify the URL: `localhost:3000/api/stripe/webhooks`

### Customer Not Syncing
- Check server logs for errors
- Verify user has an email address
- Ensure Stripe plugin is loaded (check for valid keys)

## Next Steps

Once local testing works:
1. Create products in Stripe
2. Build checkout flows
3. Handle subscription lifecycles
4. Test payment failures
5. Implement customer portal

## Useful Commands

```bash
# List recent events
stripe events list

# Trigger specific webhook
stripe trigger checkout.session.completed

# View Stripe logs
stripe logs tail

# Test a specific product
stripe products list
```

---

Remember: Always use test mode for development. Never use live keys in development!
