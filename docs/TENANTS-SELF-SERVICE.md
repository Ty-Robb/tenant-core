# Self-Service Registration Guide

This guide covers implementing a self-service tenant registration system where users can sign up and automatically get their own tenant with subdomain.

## Overview

The self-service registration flow allows users to:
1. Sign up with their email and company details
2. Choose a subdomain for their tenant
3. Automatically provision a new tenant
4. Get immediate access to their tenant dashboard

## Implementation Steps

### 1. Create Registration Page

```tsx
// src/app/(public)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    subdomain: '',
    firstName: '',
    lastName: '',
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }
    
    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      setError('Subdomain can only contain lowercase letters, numbers, and hyphens')
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }
      
      // Redirect to success page or login
      router.push(`/register/success?subdomain=${data.tenant.subdomain}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Start your 14-day free trial
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                required
                placeholder="First name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="text"
                required
                placeholder="Last name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <input
              type="email"
              required
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            <input
              type="text"
              required
              placeholder="Company name"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Choose subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
                className="appearance-none rounded-md relative block w-full px-3 py-2 pr-32 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
                .{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'yourdomain.com'}
              </span>
            </div>
            
            <input
              type="password"
              required
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            <input
              type="password"
              required
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

### 2. Registration API Endpoint

```typescript
// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '../../../getPayload'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Validation schema
const registrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  subdomain: z.string().regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadClient()
    const body = await request.json()
    
    // Validate input
    const validatedData = registrationSchema.parse(body)
    
    // Check subdomain availability
    const existingTenant = await payload.find({
      collection: 'tenants',
      where: {
        or: [
          { slug: { equals: validatedData.subdomain } },
          { domain: { equals: `${validatedData.subdomain}.${process.env.BASE_DOMAIN}` } },
        ],
      },
    })
    
    if (existingTenant.docs.length > 0) {
      return NextResponse.json(
        { error: 'This subdomain is already taken. Please choose another.' },
        { status: 400 }
      )
    }
    
    // Check if email already exists
    const existingUser = await payload.find({
      collection: 'users',
      where: {
        email: { equals: validatedData.email },
      },
    })
    
    if (existingUser.docs.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 400 }
      )
    }
    
    // Create tenant
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: validatedData.companyName,
        slug: validatedData.subdomain,
        domain: `${validatedData.subdomain}.${process.env.BASE_DOMAIN}`,
      },
    })
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)
    
    // Create user with tenant admin role
    const user = await payload.create({
      collection: 'users',
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        tenants: [
          {
            tenant: tenant.id,
            roles: ['tenant-admin'],
          },
        ],
      },
    })
    
    // Create initial tenant data
    await createInitialTenantData(payload, tenant.id, validatedData)
    
    // Send welcome email
    await sendWelcomeEmail({
      to: validatedData.email,
      firstName: validatedData.firstName,
      companyName: validatedData.companyName,
      subdomain: validatedData.subdomain,
      loginUrl: `https://${validatedData.subdomain}.${process.env.BASE_DOMAIN}/login`,
    })
    
    // Log the registration for analytics
    await logRegistration({
      tenantId: tenant.id,
      userId: user.id,
      subdomain: validatedData.subdomain,
    })
    
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        subdomain: validatedData.subdomain,
        url: `https://${validatedData.subdomain}.${process.env.BASE_DOMAIN}`,
      },
      message: 'Registration successful! Check your email for login instructions.',
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}

async function createInitialTenantData(payload: any, tenantId: string, data: any) {
  // Create welcome page
  await payload.create({
    collection: 'pages',
    data: {
      title: `Welcome to ${data.companyName}`,
      slug: 'home',
      tenant: tenantId,
      content: {
        root: {
          children: [
            {
              type: 'heading',
              tag: 'h1',
              children: [{ text: `Welcome to ${data.companyName}!` }],
            },
            {
              type: 'paragraph',
              children: [{ text: 'Your workspace is ready. Start by customizing your settings.' }],
            },
          ],
        },
      },
      status: 'published',
    },
  })
  
  // Create default settings
  await payload.create({
    collection: 'tenant-settings',
    data: {
      tenant: tenantId,
      branding: {
        companyName: data.companyName,
        primaryColor: '#4F46E5',
      },
      features: {
        enableBlog: true,
        enableEcommerce: false,
      },
    },
  })
}
```

### 3. Email Verification (Optional but Recommended)

```typescript
// src/collections/EmailVerifications/index.ts
export const EmailVerifications: CollectionConfig = {
  slug: 'email-verifications',
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
    {
      name: 'verifiedAt',
      type: 'date',
    },
  ],
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
}

// Add to user registration
const verificationToken = crypto.randomBytes(32).toString('hex')
await payload.create({
  collection: 'email-verifications',
  data: {
    user: user.id,
    token: verificationToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  },
})

// Send verification email
await sendEmail({
  to: validatedData.email,
  subject: 'Verify your email',
  html: `
    <p>Please verify your email by clicking the link below:</p>
    <a href="${process.env.APP_URL}/verify-email?token=${verificationToken}">
      Verify Email
    </a>
  `,
})
```

### 4. Subdomain Availability Check

```typescript
// src/app/api/check-subdomain/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '../../../getPayload'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const subdomain = searchParams.get('subdomain')
  
  if (!subdomain) {
    return NextResponse.json(
      { error: 'Subdomain is required' },
      { status: 400 }
    )
  }
  
  // Validate format
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return NextResponse.json({
      available: false,
      reason: 'Invalid format. Use only lowercase letters, numbers, and hyphens.',
    })
  }
  
  // Check reserved subdomains
  const reserved = ['www', 'app', 'api', 'admin', 'blog', 'shop', 'mail', 'ftp']
  if (reserved.includes(subdomain)) {
    return NextResponse.json({
      available: false,
      reason: 'This subdomain is reserved.',
    })
  }
  
  try {
    const payload = await getPayloadClient()
    
    const existing = await payload.find({
      collection: 'tenants',
      where: {
        or: [
          { slug: { equals: subdomain } },
          { domain: { equals: `${subdomain}.${process.env.BASE_DOMAIN}` } },
        ],
      },
    })
    
    return NextResponse.json({
      available: existing.docs.length === 0,
      subdomain,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}
```

### 5. Real-time Subdomain Validation Component

```tsx
// src/components/SubdomainInput.tsx
import { useState, useEffect, useCallback } from 'react'
import { debounce } from 'lodash'

export function SubdomainInput({ value, onChange, baseDomain }) {
  const [checking, setChecking] = useState(false)
  const [availability, setAvailability] = useState(null)
  
  const checkAvailability = useCallback(
    debounce(async (subdomain: string) => {
      if (!subdomain || subdomain.length < 3) {
        setAvailability(null)
        return
      }
      
      setChecking(true)
      try {
        const response = await fetch(`/api/check-subdomain?subdomain=${subdomain}`)
        const data = await response.json()
        setAvailability(data)
      } catch (error) {
        setAvailability({ available: false, reason: 'Error checking availability' })
      } finally {
        setChecking(false)
      }
    }, 500),
    []
  )
  
  useEffect(() => {
    checkAvailability(value)
  }, [value, checkAvailability])
  
  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          placeholder="choose-subdomain"
          className={`
            appearance-none rounded-md relative block w-full px-3 py-2 pr-32 
            border placeholder-gray-500 text-gray-900 
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${availability?.available === false 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : availability?.available === true
              ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
              : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }
          `}
        />
        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500">
          .{baseDomain}
        </span>
        {checking && (
          <div className="absolute inset-y-0 right-32 pr-3 flex items-center">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>
      
      {availability && !checking && (
        <p className={`mt-1 text-sm ${availability.available ? 'text-green-600' : 'text-red-600'}`}>
          {availability.available 
            ? '✓ This subdomain is available' 
            : `✗ ${availability.reason || 'This subdomain is not available'}`
          }
        </p>
      )}
    </div>
  )
}
```

### 6. Post-Registration Onboarding

```typescript
// src/app/(tenant)/[tenant]/onboarding/page.tsx
export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  
  const steps = [
    {
      title: 'Welcome!',
      component: <WelcomeStep />,
    },
    {
      title: 'Customize Your Workspace',
      component: <CustomizationStep />,
    },
    {
      title: 'Invite Team Members',
      component: <InviteTeamStep />,
    },
    {
      title: 'You\'re All Set!',
      component: <CompletionStep />,
    },
  ]
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto pt-10">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex-1 ${index < steps.length - 1 ? 'pr-4' : ''}`}
              >
                <div
                  className={`h-2 rounded-full ${
                    index <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
                <p className="mt-2 text-xs text-gray-600">{step.title}</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Current step content */}
        <div className="bg-white rounded-lg shadow p-6">
          {steps[currentStep].component}
        </div>
        
        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (currentStep === steps.length - 1) {
                // Complete onboarding
                window.location.href = '/dashboard'
              } else {
                setCurrentStep(currentStep + 1)
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 7. Billing Integration (Stripe Example)

```typescript
// src/app/api/create-checkout-session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: NextRequest) {
  const { priceId, tenantId, userId } = await request.json()
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/billing/cancelled`,
      metadata: {
        tenantId,
        userId,
      },
    })
    
    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

// Webhook handler
export async function handleStripeWebhook(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')!
  const body = await request.text()
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }
  
  const payload = await getPayloadClient()
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session
      
      // Update tenant with subscription info
      await payload.update({
        collection: 'tenants',
        id: session.metadata.tenantId,
        data: {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: 'active',
          subscriptionStartDate: new Date(),
        },
      })
      break
      
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription
      
      // Handle subscription cancellation
      await handleSubscriptionCancellation(payload, subscription)
      break
  }
  
  return NextResponse.json({ received: true })
}
```

## Security Considerations

### 1. Rate Limiting

```typescript
// src/middleware/rateLimiter.ts
import { RateLimiter } from 'limiter'

const registrationLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 'hour',
  fireImmediately: true,
})

export async function rateLimit(ip: string): Promise<boolean> {
  const key = `registration:${ip}`
  return registrationLimiter.tryRemoveTokens(1)
}
```

### 2. Input Validation

- Validate email format and domain
- Enforce password complexity requirements
- Sanitize subdomain input
- Check for SQL injection attempts
- Validate against reserved subdomains

### 3. Spam Prevention

```typescript
// Add honeypot field to registration form
<input
  type="text"
  name="website"
  style={{ display: 'none' }}
  tabIndex={-1}
  autoComplete="off"
/>

// Check in API
if (body.website) {
  // Likely a bot
  return NextResponse.json({ success: true }) // Fake success
}
```

## Monitoring and Analytics

### Track Key Metrics

```typescript
// src/utilities/analytics.ts
export async function trackRegistration(data: {
  tenantId: string
  userId: string
  source?: string
  referrer?: string
}) {
  // Send to analytics service
  await analytics.track({
    event: 'Tenant Created',
    properties: {
      tenantId: data.tenantId,
      userId: data.userId,
      source: data.source || 'organic',
      referrer: data.referrer,
      timestamp: new Date(),
    },
  })
  
  // Store in database for internal analytics
  await payload.create({
    collection: 'analytics-events',
    data: {
      event: 'registration',
      ...data,
    },
  })
}
```

## Testing

### Unit Tests

```typescript
// src/tests/registration.test.ts
describe('Registration API', () => {
  it('should create tenant and user successfully', async () => {
    const response = await request(app)
      .post('/api/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        companyName: 'Test Company',
        subdomain: 'test-company',
        firstName: 'John',
        lastName: 'Doe',
      })
    
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.tenant.subdomain).toBe('test-company')
  })
  
  it('should reject duplicate subdomain', async () => {
    // First registration
    await createTenant({ subdomain: 'existing' })
    
    // Attempt duplicate
    const response = await request(app)
      .post('/api/register')
      .send({
        email: 'new@example.com',
        password: 'SecurePass123!',
        companyName: 'New Company',
        subdomain: 'existing',
        firstName: 'Jane',
        lastName: 'Doe',
      })
    
    expect(response.status).toBe(400)
    expect(response.body.error).toContain('already taken')
  })
})
```

## Deployment Checklist

- [ ] Configure wildcard DNS for subdomains
- [ ] Set up SSL certificates (wildcard)
- [ ] Configure email service (SMTP/SendGrid/etc)
- [ ] Set up monitoring and alerts
- [ ] Configure rate limiting
- [ ] Set up backup strategy
- [ ] Test registration flow end-to-end
- [ ] Configure analytics tracking
- [ ] Set up customer support integration
- [ ] Prepare onboarding emails
