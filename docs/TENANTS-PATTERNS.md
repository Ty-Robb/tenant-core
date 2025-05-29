# Common Patterns and Recipes

This document provides practical code patterns and recipes for common multi-tenant scenarios.

## Table of Contents

1. [Creating Tenant-Aware Collections](#creating-tenant-aware-collections)
2. [User Registration Patterns](#user-registration-patterns)
3. [Tenant Switching](#tenant-switching)
4. [Data Migration Between Tenants](#data-migration-between-tenants)
5. [Tenant-Specific Configuration](#tenant-specific-configuration)
6. [Multi-Tenant Search](#multi-tenant-search)
7. [Tenant Isolation Patterns](#tenant-isolation-patterns)
8. [Performance Patterns](#performance-patterns)

## Creating Tenant-Aware Collections

### Basic Tenant-Scoped Collection

```typescript
// src/collections/Products/index.ts
import type { CollectionConfig } from 'payload/types'
import { superAdminOrTenantAdmin } from '../../access/superAdminOrTenantAdmin'
import { getUserTenantIDs } from '../../utilities/getUserTenantIDs'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'sku',
      type: 'text',
      unique: true,
      // Make SKU unique per tenant
      hooks: {
        beforeValidate: [
          async ({ data, req, siblingData }) => {
            if (data && siblingData.tenant) {
              // Prefix SKU with tenant slug for uniqueness
              const tenant = await req.payload.findByID({
                collection: 'tenants',
                id: siblingData.tenant,
              })
              return `${tenant.slug}-${data}`
            }
            return data
          },
        ],
      },
    },
  ],
  access: {
    read: ({ req }) => {
      const tenantIDs = getUserTenantIDs(req.user)
      if (tenantIDs.includes('*')) return true
      
      return {
        tenant: {
          in: tenantIDs,
        },
      }
    },
    create: superAdminOrTenantAdmin,
    update: superAdminOrTenantAdmin,
    delete: superAdminOrTenantAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        // Auto-assign tenant for non-super admins
        if (!isSuperAdmin(req.user) && !data.tenant) {
          const userTenants = getUserTenantIDs(req.user)
          if (userTenants.length === 1) {
            data.tenant = userTenants[0]
          }
        }
        return data
      },
    ],
  },
}

// Don't forget to add to payload.config.ts
plugins: [
  multiTenantPlugin<Config>({
    collections: {
      pages: {},
      products: {}, // Add here
    },
  }),
]
```

## User Registration Patterns

### Self-Service Tenant Registration

```typescript
// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '../../../getPayload'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  const payload = await getPayloadClient()
  const data = await request.json()
  
  const {
    email,
    password,
    companyName,
    subdomain,
  } = data
  
  try {
    // Validate subdomain availability
    const existingTenant = await payload.find({
      collection: 'tenants',
      where: {
        or: [
          { slug: { equals: subdomain } },
          { domain: { equals: `${subdomain}.${process.env.BASE_DOMAIN}` } },
        ],
      },
    })
    
    if (existingTenant.docs.length > 0) {
      return NextResponse.json(
        { error: 'Subdomain already taken' },
        { status: 400 }
      )
    }
    
    // Create tenant
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: companyName,
        slug: subdomain,
        domain: `${subdomain}.${process.env.BASE_DOMAIN}`,
      },
    })
    
    // Create user with tenant admin role
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password: hashedPassword,
        tenants: [
          {
            tenant: tenant.id,
            roles: ['tenant-admin'],
          },
        ],
      },
    })
    
    // Create welcome content
    await payload.create({
      collection: 'pages',
      data: {
        title: 'Welcome to ' + companyName,
        slug: 'home',
        tenant: tenant.id,
        content: 'Your tenant is ready!',
      },
    })
    
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        subdomain,
        url: `https://${subdomain}.${process.env.BASE_DOMAIN}`,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
```

### Invite Users to Tenant

```typescript
// src/collections/Invitations/index.ts
export const Invitations: CollectionConfig = {
  slug: 'invitations',
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'tenant-admin' },
        { label: 'User', value: 'tenant-user' },
      ],
      defaultValue: 'tenant-user',
    },
    {
      name: 'token',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
    },
    {
      name: 'acceptedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          // Generate unique token
          data.token = crypto.randomBytes(32).toString('hex')
          // Set expiration to 7 days
          data.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Send invitation email
          await sendEmail({
            to: doc.email,
            subject: 'You have been invited!',
            html: `
              <p>You've been invited to join ${doc.tenant.name}.</p>
              <a href="${process.env.APP_URL}/accept-invite?token=${doc.token}">
                Accept Invitation
              </a>
            `,
          })
        }
      },
    ],
  },
}
```

## Tenant Switching

### Admin UI Tenant Switcher

```typescript
// src/components/TenantSwitcher/index.tsx
import React from 'react'
import { useAuth } from '@payloadcms/ui'
import { Select } from '@payloadcms/ui/elements/Select'

export const TenantSwitcher: React.FC = () => {
  const { user } = useAuth()
  const [currentTenant, setCurrentTenant] = React.useState('')
  
  if (!user || user.tenants.length <= 1) {
    return null
  }
  
  const handleTenantChange = async (value: string) => {
    // Set tenant context
    await fetch('/api/set-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: value }),
    })
    
    // Reload to apply new context
    window.location.reload()
  }
  
  const options = user.tenants.map(({ tenant }) => ({
    label: tenant.name,
    value: tenant.id,
  }))
  
  return (
    <Select
      label="Current Tenant"
      value={currentTenant}
      onChange={handleTenantChange}
      options={options}
    />
  )
}
```

### API Endpoint for Tenant Switching

```typescript
// src/app/api/set-tenant/route.ts
export async function POST(request: NextRequest) {
  const { tenantId } = await request.json()
  const session = await getSession()
  
  // Verify user has access to this tenant
  const userTenantIDs = getUserTenantIDs(session.user)
  if (!userTenantIDs.includes(tenantId) && !userTenantIDs.includes('*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  
  // Set tenant in session
  session.currentTenantId = tenantId
  await session.save()
  
  return NextResponse.json({ success: true })
}
```

## Data Migration Between Tenants

### Copying Data Between Tenants

```typescript
// src/utilities/copyDataBetweenTenants.ts
export async function copyPagesBetweenTenants(
  payload: Payload,
  sourceTenantId: string,
  targetTenantId: string,
  options: {
    overwrite?: boolean
    slugPrefix?: string
  } = {}
) {
  // Get all pages from source tenant
  const sourcePages = await payload.find({
    collection: 'pages',
    where: {
      tenant: { equals: sourceTenantId },
    },
    limit: 1000,
  })
  
  const results = {
    success: [],
    errors: [],
  }
  
  for (const page of sourcePages.docs) {
    try {
      const newSlug = options.slugPrefix 
        ? `${options.slugPrefix}-${page.slug}`
        : page.slug
      
      // Check if page exists in target tenant
      const existing = await payload.find({
        collection: 'pages',
        where: {
          and: [
            { tenant: { equals: targetTenantId } },
            { slug: { equals: newSlug } },
          ],
        },
      })
      
      if (existing.docs.length > 0 && !options.overwrite) {
        results.errors.push({
          slug: page.slug,
          error: 'Page already exists',
        })
        continue
      }
      
      // Create or update page in target tenant
      const operation = existing.docs.length > 0 ? 'update' : 'create'
      const newPage = await payload[operation]({
        collection: 'pages',
        id: existing.docs[0]?.id,
        data: {
          ...page,
          tenant: targetTenantId,
          slug: newSlug,
          _status: 'draft', // Set as draft for review
        },
      })
      
      results.success.push(newPage)
    } catch (error) {
      results.errors.push({
        slug: page.slug,
        error: error.message,
      })
    }
  }
  
  return results
}
```

## Tenant-Specific Configuration

### Dynamic Tenant Settings

```typescript
// src/collections/TenantSettings/index.ts
export const TenantSettings: CollectionConfig = {
  slug: 'tenant-settings',
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      unique: true,
    },
    {
      name: 'branding',
      type: 'group',
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'primaryColor',
          type: 'text',
          defaultValue: '#007bff',
        },
        {
          name: 'companyName',
          type: 'text',
        },
      ],
    },
    {
      name: 'features',
      type: 'group',
      fields: [
        {
          name: 'enableBlog',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'enableEcommerce',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'customDomain',
          type: 'text',
          validate: async (value, { req }) => {
            if (!value) return true
            
            // Validate domain format
            const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i
            if (!domainRegex.test(value)) {
              return 'Invalid domain format'
            }
            
            // Check uniqueness
            const existing = await req.payload.find({
              collection: 'tenant-settings',
              where: {
                'features.customDomain': { equals: value },
              },
            })
            
            if (existing.docs.length > 0) {
              return 'Domain already in use'
            }
            
            return true
          },
        },
      ],
    },
  ],
}

// Hook to use tenant settings
export const useTenantSettings = async (
  tenantId: string,
  payload: Payload
) => {
  const settings = await payload.find({
    collection: 'tenant-settings',
    where: {
      tenant: { equals: tenantId },
    },
    limit: 1,
  })
  
  return settings.docs[0] || null
}
```

## Multi-Tenant Search

### Global Search Across Tenants

```typescript
// src/utilities/multiTenantSearch.ts
export async function searchAcrossTenants(
  payload: Payload,
  query: string,
  options: {
    collections: string[]
    tenantIds?: string[]
    limit?: number
  }
) {
  const results = {}
  
  for (const collection of options.collections) {
    const searchQuery = {
      collection,
      where: {
        and: [
          // Tenant filter
          options.tenantIds
            ? { tenant: { in: options.tenantIds } }
            : {},
          // Search filter
          {
            or: [
              { title: { contains: query } },
              { content: { contains: query } },
              { description: { contains: query } },
            ],
          },
        ],
      },
      limit: options.limit || 10,
    }
    
    const searchResults = await payload.find(searchQuery)
    
    results[collection] = searchResults.docs.map(doc => ({
      ...doc,
      _collection: collection,
      _tenantName: doc.tenant?.name,
    }))
  }
  
  return results
}

// Usage in API endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const user = await getUser()
  
  const results = await searchAcrossTenants(payload, query, {
    collections: ['pages', 'posts', 'products'],
    tenantIds: getUserTenantIDs(user),
    limit: 5,
  })
  
  return NextResponse.json(results)
}
```

## Tenant Isolation Patterns

### Ensuring Complete Data Isolation

```typescript
// src/access/tenantIsolation.ts
export const createTenantIsolatedAccess = (
  allowSuperAdmin = true
): Access => {
  return ({ req }) => {
    const user = req.user
    
    if (!user) return false
    
    if (allowSuperAdmin && isSuperAdmin(user)) {
      return true
    }
    
    const tenantIDs = getUserTenantIDs(user)
    
    if (tenantIDs.length === 0) {
      return false
    }
    
    return {
      tenant: {
        in: tenantIDs,
      },
    }
  }
}

// Usage in collection
access: {
  read: createTenantIsolatedAccess(),
  create: createTenantIsolatedAccess(),
  update: createTenantIsolatedAccess(),
  delete: createTenantIsolatedAccess(false), // No delete even for super admin
}
```

### Tenant-Scoped Validation

```typescript
// Ensure unique values within tenant scope
{
  name: 'slug',
  type: 'text',
  validate: async (value, { siblingData, req, id }) => {
    if (!value) return 'Slug is required'
    
    const existing = await req.payload.find({
      collection: 'pages',
      where: {
        and: [
          { tenant: { equals: siblingData.tenant } },
          { slug: { equals: value } },
          { id: { not_equals: id } }, // Exclude current document
        ],
      },
    })
    
    if (existing.docs.length > 0) {
      return 'Slug must be unique within tenant'
    }
    
    return true
  },
}
```

## Performance Patterns

### Caching Tenant Data

```typescript
// src/utilities/tenantCache.ts
import { LRUCache } from 'lru-cache'

const tenantCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
})

export async function getTenantWithCache(
  payload: Payload,
  identifier: string
) {
  const cacheKey = `tenant:${identifier}`
  
  // Check cache
  const cached = tenantCache.get(cacheKey)
  if (cached) return cached
  
  // Query database
  const tenant = await payload.find({
    collection: 'tenants',
    where: {
      or: [
        { id: { equals: identifier } },
        { slug: { equals: identifier } },
        { domain: { equals: identifier } },
      ],
    },
    limit: 1,
  })
  
  if (tenant.docs.length > 0) {
    tenantCache.set(cacheKey, tenant.docs[0])
    return tenant.docs[0]
  }
  
  return null
}

// Clear cache on tenant update
export const clearTenantCache: AfterChangeHook = async ({ doc }) => {
  tenantCache.delete(`tenant:${doc.id}`)
  tenantCache.delete(`tenant:${doc.slug}`)
  tenantCache.delete(`tenant:${doc.domain}`)
}
```

### Batch Operations

```typescript
// src/utilities/batchTenantOperations.ts
export async function batchCreateForAllTenants(
  payload: Payload,
  collection: string,
  dataGenerator: (tenant: Tenant) => any
) {
  const tenants = await payload.find({
    collection: 'tenants',
    limit: 1000,
  })
  
  const operations = tenants.docs.map(tenant => ({
    create: {
      collection,
      data: {
        ...dataGenerator(tenant),
        tenant: tenant.id,
      },
    },
  }))
  
  // Process in batches to avoid overwhelming the database
  const batchSize = 10
  const results = []
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(op => payload.create(op.create))
    )
    results.push(...batchResults)
  }
  
  return results
}

// Usage: Create default settings for all tenants
await batchCreateForAllTenants(
  payload,
  'tenant-settings',
  (tenant) => ({
    branding: {
      companyName: tenant.name,
      primaryColor: '#007bff',
    },
    features: {
      enableBlog: true,
      enableEcommerce: false,
    },
  })
)
