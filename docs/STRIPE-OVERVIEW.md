# Stripe Integration Overview

This document provides a comprehensive overview of how Stripe payments work within the multi-tenant Payload CMS system.

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [How It Works](#how-it-works)
5. [Multi-Tenant Billing](#multi-tenant-billing)
6. [Key Benefits](#key-benefits)

## Introduction

The Stripe integration enables payment processing, subscription management, and billing automation for your multi-tenant application. Each tenant can have their own subscription, customers, and billing settings while maintaining complete data isolation.

## Core Concepts

### 1. **Stripe Plugin**

The `@payloadcms/plugin-stripe` provides:
- Automatic synchronization between Payload and Stripe
- Webhook handling for real-time updates
- Type-safe integration with Payload collections
- Built-in collections for Stripe resources

### 2. **Resource Synchronization**

The plugin creates a two-way sync between:
- **Payload Users** ↔️ **Stripe Customers**
- **Payload Collections** ↔️ **Stripe Resources**

### 3. **Webhook Events**

Stripe webhooks ensure data consistency:
- Customer updates
- Subscription changes
- Payment events
- Product modifications

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │   Payload CMS    │ ←────→ │  Stripe Plugin   │          │
│  └─────────────────┘         └─────────────────┘          │
│           │                           │                     │
│           ↓                           ↓                     │
│  ┌─────────────────┐         ┌─────────────────┐          │
│  │   PostgreSQL    │         │   Stripe API    │          │
│  │                 │         │                 │          │
│  │ • users         │ ←────→ │ • customers     │          │
│  │ • tenants       │         │ • subscriptions │          │
│  │ • pages         │         │ • products      │          │
│  │ • stripeData    │         │ • prices        │          │
│  └─────────────────┘         └─────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. **Initial Setup**

When you configure the Stripe plugin:

```typescript
stripePlugin({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  sync: [
    {
      collection: 'users',
      stripeResourceType: 'customers',
      fields: [
        { fieldPath: 'email', stripeProperty: 'email' }
      ]
    }
  ]
})
```

### 2. **User Registration Flow**

```
1. User signs up in Payload
   ↓
2. Stripe plugin intercepts creation
   ↓
3. Creates corresponding Stripe customer
   ↓
4. Stores Stripe customer ID in user record
   ↓
5. User is ready for payments
```

### 3. **Subscription Creation**

```
1. User selects a plan
   ↓
2. Create Stripe checkout session
   ↓
3. User completes payment
   ↓
4. Webhook receives confirmation
   ↓
5. Subscription record created in Payload
   ↓
6. Tenant gains access to features
```

### 4. **Data Synchronization**

The plugin maintains consistency through:

- **Create Hooks**: When creating Payload records, create Stripe resources
- **Update Hooks**: Sync changes bidirectionally
- **Webhooks**: Handle Stripe-initiated changes
- **Field Mapping**: Keep specified fields in sync

## Multi-Tenant Billing

### Billing Models

#### 1. **Per-Tenant Subscription**
Each tenant has its own subscription:
```
Tenant A → Subscription A → $29/month
Tenant B → Subscription B → $99/month
Tenant C → Subscription C → $29/month
```

#### 2. **Per-Seat Pricing**
Charge based on users per tenant:
```
Tenant A (5 users) → $10/user → $50/month
Tenant B (20 users) → $10/user → $200/month
```

#### 3. **Usage-Based Billing**
Track and bill for resource usage:
```
Tenant A → 1,000 API calls → $0.01/call → $10
Tenant B → 50,000 API calls → $0.01/call → $500
```

### Tenant Isolation

Each tenant's billing data is isolated:

```typescript
// Subscription belongs to specific tenant
{
  tenant: "tenant_123",
  stripeSubscriptionID: "sub_abc",
  status: "active",
  products: ["prod_xyz"]
}
```

### Billing Management

Tenant admins can:
- View their subscription status
- Update payment methods
- Change plans
- Download invoices
- Manage billing contacts

## Key Benefits

### 1. **Automated Billing**
- No manual invoice creation
- Automatic payment collection
- Retry logic for failed payments

### 2. **Real-Time Synchronization**
- Instant updates via webhooks
- Consistent data across systems
- No polling required

### 3. **Scalability**
- Handles thousands of tenants
- Stripe's infrastructure
- Built-in rate limiting

### 4. **Security**
- PCI compliance handled by Stripe
- Secure webhook verification
- No sensitive data storage

### 5. **Developer Experience**
- Type-safe integration
- Automatic schema generation
- Built-in error handling

## Common Use Cases

### SaaS Applications
- Multi-tenant platforms
- Subscription-based services
- Freemium models

### Marketplaces
- Vendor subscriptions
- Transaction fees
- Split payments

### Enterprise Software
- Seat-based licensing
- Usage tracking
- Custom pricing

## Next Steps

1. Review the [Technical Implementation](./STRIPE-TECHNICAL.md)
2. Follow the [Setup Guide](./STRIPE-SETUP.md)
3. Explore [Common Patterns](./STRIPE-PATTERNS.md)
4. Check the [API Reference](./STRIPE-API.md)

---

This overview provides the foundation for understanding how Stripe integrates with your multi-tenant Payload CMS application. For implementation details, continue to the technical documentation.
