# Stripe API Reference

This document provides a comprehensive API reference for Stripe integration endpoints in your multi-tenant application.

## Table of Contents

1. [Authentication](#authentication)
2. [Checkout Endpoints](#checkout-endpoints)
3. [Subscription Endpoints](#subscription-endpoints)
4. [Customer Portal](#customer-portal)
5. [Webhook Endpoints](#webhook-endpoints)
6. [Product Management](#product-management)
7. [Usage Reporting](#usage-reporting)

## Authentication

All API endpoints require authentication unless otherwise specified.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Tenant-ID: <tenant_id> (optional, derived from user context)
```

## Checkout Endpoints

### Create Checkout Session

Creates a new Stripe checkout session for subscription or one-time payment.

**Endpoint:** `POST /api/checkout/session`

**Request Body:**
```json
{
  "priceId": "price_1234567890",
  "mode": "subscription", // or "payment"
  "quantity": 1,
  "metadata": {
    "tenantId": "tenant_123",
    "userId": "user_456"
  }
}
```

**Response:**
```json
{
  "sessionId": "cs_test_a1b2c3d4",
  "url": "https://checkout.stripe.com/pay/cs_test_a1b2c3d4"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid price ID or missing parameters
- `401 Unauthorized` - Invalid or missing authentication
- `500 Internal Server Error` - Stripe API error

### Retrieve Checkout Session

Get details of a checkout session.

**Endpoint:** `GET /api/checkout/session/:sessionId`

**Response:**
```json
{
  "id": "cs_test_a1b2c3d4",
  "status": "complete",
  "customer": "cus_123",
  "subscription": "sub_456",
  "metadata": {
    "tenantId": "tenant_123",
    "userId": "user_456"
  }
}
```

## Subscription Endpoints

### List Subscriptions

Get all subscriptions for a tenant.

**Endpoint:** `GET /api/subscriptions`

**Query Parameters:**
- `tenantId` (optional) - Filter by tenant
- `status` (optional) - Filter by status (active, canceled, past_due)
- `limit` (optional) - Number of results (default: 10)
- `starting_after` (optional) - Cursor for pagination

**Response:**
```json
{
  "data": [
    {
      "id": "sub_123",
      "customer": "cus_456",
      "status": "active",
      "current_period_start": 1234567890,
      "current_period_end": 1234567890,
      "items": [
        {
          "id": "si_123",
          "price": {
            "id": "price_123",
            "product": "prod_456",
            "unit_amount": 2900,
            "currency": "usd"
          }
        }
      ]
    }
  ],
  "has_more": false,
  "url": "/api/subscriptions"
}
```

### Create Subscription

Create a new subscription for a customer.

**Endpoint:** `POST /api/subscriptions`

**Request Body:**
```json
{
  "customerId": "cus_123",
  "priceId": "price_456",
  "quantity": 1,
  "trial_period_days": 14,
  "metadata": {
    "tenantId": "tenant_123"
  }
}
```

**Response:**
```json
{
  "id": "sub_123",
  "status": "trialing",
  "trial_end": 1234567890,
  "current_period_end": 1234567890
}
```

### Update Subscription

Update an existing subscription.

**Endpoint:** `PATCH /api/subscriptions/:subscriptionId`

**Request Body:**
```json
{
  "priceId": "price_789", // Change plan
  "quantity": 5, // Update quantity
  "cancel_at_period_end": false,
  "proration_behavior": "create_prorations"
}
```

**Response:**
```json
{
  "id": "sub_123",
  "status": "active",
  "items": {
    "data": [
      {
        "id": "si_456",
        "price": "price_789",
        "quantity": 5
      }
    ]
  }
}
```

### Cancel Subscription

Cancel a subscription immediately or at period end.

**Endpoint:** `DELETE /api/subscriptions/:subscriptionId`

**Query Parameters:**
- `immediately` (boolean) - Cancel immediately vs at period end

**Response:**
```json
{
  "id": "sub_123",
  "status": "canceled",
  "canceled_at": 1234567890,
  "cancel_at_period_end": true
}
```

## Customer Portal

### Create Portal Session

Generate a customer portal session URL.

**Endpoint:** `POST /api/customer-portal`

**Request Body:**
```json
{
  "customerId": "cus_123",
  "returnUrl": "https://app.example.com/dashboard"
}
```

**Response:**
```json
{
  "id": "bps_123",
  "url": "https://billing.stripe.com/p/session/test_123",
  "return_url": "https://app.example.com/dashboard"
}
```

## Webhook Endpoints

### Stripe Webhook Handler

Receives and processes Stripe webhook events.

**Endpoint:** `POST /api/stripe/webhooks`

**Headers Required:**
```http
stripe-signature: t=1234567890,v1=abc123...
```

**Request Body:**
Raw Stripe event JSON

**Response:**
```json
{
  "received": true
}
```

**Handled Events:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.updated`
- `product.created`
- `product.updated`

## Product Management

### List Products

Get all available products.

**Endpoint:** `GET /api/products`

**Query Parameters:**
- `active` (boolean) - Filter by active status
- `limit` (number) - Results per page
- `starting_after` (string) - Cursor for pagination

**Response:**
```json
{
  "data": [
    {
      "id": "prod_123",
      "name": "Pro Plan",
      "description": "Advanced features for growing teams",
      "active": true,
      "prices": [
        {
          "id": "price_123",
          "unit_amount": 2900,
          "currency": "usd",
          "recurring": {
            "interval": "month",
            "interval_count": 1
          }
        }
      ]
    }
  ],
  "has_more": false
}
```

### Get Product

Get a single product with prices.

**Endpoint:** `GET /api/products/:productId`

**Response:**
```json
{
  "id": "prod_123",
  "name": "Pro Plan",
  "description": "Advanced features for growing teams",
  "active": true,
  "metadata": {
    "features": "unlimited_users,advanced_analytics,priority_support"
  },
  "prices": [
    {
      "id": "price_123",
      "nickname": "Monthly",
      "unit_amount": 2900,
      "currency": "usd",
      "recurring": {
        "interval": "month"
      }
    },
    {
      "id": "price_456",
      "nickname": "Annual",
      "unit_amount": 29900,
      "currency": "usd",
      "recurring": {
        "interval": "year"
      }
    }
  ]
}
```

## Usage Reporting

### Report Usage

Report usage for metered billing.

**Endpoint:** `POST /api/usage`

**Request Body:**
```json
{
  "subscriptionItemId": "si_123",
  "quantity": 100,
  "timestamp": 1234567890,
  "action": "increment" // or "set"
}
```

**Response:**
```json
{
  "id": "mbur_123",
  "subscription_item": "si_123",
  "quantity": 100,
  "timestamp": 1234567890
}
```

### Get Usage Records

Retrieve usage records for a subscription item.

**Endpoint:** `GET /api/usage/:subscriptionItemId`

**Query Parameters:**
- `limit` (number) - Results per page
- `starting_after` (string) - Cursor for pagination

**Response:**
```json
{
  "data": [
    {
      "id": "mbur_123",
      "quantity": 100,
      "timestamp": 1234567890,
      "subscription_item": "si_123"
    }
  ],
  "has_more": false
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "message": "Human-readable error message",
    "type": "invalid_request_error",
    "code": "resource_missing",
    "param": "price_id"
  }
}
```

### Common Error Types

- `invalid_request_error` - Invalid parameters
- `authentication_error` - Invalid API key or authentication
- `rate_limit_error` - Too many requests
- `stripe_error` - Stripe API error
- `validation_error` - Request validation failed

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authenticated requests**: 100 requests per minute
- **Webhook endpoints**: 1000 requests per minute

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

## Pagination

List endpoints support cursor-based pagination:

```json
{
  "data": [...],
  "has_more": true,
  "url": "/api/subscriptions",
  "object": "list"
}
```

To get the next page:
```
GET /api/subscriptions?starting_after=sub_123&limit=10
```

## Idempotency

For POST requests, include an idempotency key:

```http
Idempotency-Key: unique-key-123
```

This ensures requests can be safely retried without creating duplicates.

## Testing

Use Stripe test mode keys and test card numbers:

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

### Test Webhook Events

Use Stripe CLI to trigger test events:
```bash
stripe trigger checkout.session.completed
```

---

This API reference covers the main endpoints for Stripe integration. For more details on Stripe's API, see the [official Stripe API documentation](https://stripe.com/docs/api).
