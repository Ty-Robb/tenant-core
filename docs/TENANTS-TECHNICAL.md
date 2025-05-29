# Technical Implementation Guide

This document provides in-depth technical details about how the multi-tenant system is implemented in this Payload CMS project.

## Database Schema

### Collections and Relationships

```typescript
// Tenants Collection
{
  id: string
  name: string        // Display name
  slug: string        // URL-friendly identifier
  domain: string      // Subdomain or custom domain
  createdAt: Date
  updatedAt: Date
}

// Users Collection
{
  id: string
  email: string
  password: string    // Hashed
  username?: string
  roles: string[]     // ['super-admin'] or []
  tenants: [{
    tenant: string    // Reference to Tenant ID
    roles: string[]   // ['tenant-admin', 'tenant-user', etc.]
  }]
}

// Pages Collection (tenant-scoped)
{
  id: string
  title: string
  slug: string
  tenant: string      // Reference to Tenant ID
  // ... other fields
}
```

### Key Relationships

1. **Users ↔ Tenants**: Many-to-many relationship through the `tenants` array field
2. **Pages → Tenant**: Many-to-one relationship (each page belongs to one tenant)
3. **Tenant-scoped collections**: Automatically filtered by tenant context

## Middleware and Request Handling

### Tenant Detection Flow

```typescript
// Simplified flow of tenant detection
1. Request arrives at Next.js
2. Middleware checks:
   a. Subdomain in host header (gold.localhost)
   b. Path parameter (/tenant-slugs/gold)
3. Tenant context is established
4. All queries are automatically filtered by tenant
```

### Next.js Rewrites Configuration

```javascript
// next.config.mjs
async rewrites() {
  return [
    {
      source: '/:path*',
      destination: '/tenant-domains/:tenant/:path*',
      has: [
        {
          type: 'host',
          value: '(?<tenant>.*)\\.localhost', // Captures subdomain
        },
      ],
    },
  ]
}
```

## Access Control Implementation

### Core Access Functions

```typescript
// src/access/isSuperAdmin.ts
export const isSuperAdmin = (user: User | null): boolean => {
  return user?.roles?.includes('super-admin') || false
}

// src/utilities/getUserTenantIDs.ts
export const getUserTenantIDs = (user: User | null): string[] => {
  if (!user) return []
  if (isSuperAdmin(user)) {
    // Super admins have access to all tenants
    return ['*'] // Special case handled by access control
  }
  return user.tenants?.map(t => t.tenant) || []
}
```

### Collection-Level Access Control

```typescript
// Example: Pages collection access
access: {
  read: ({ req }) => {
    const tenantIDs = getUserTenantIDs(req.user)
    if (tenantIDs.includes('*')) return true // Super admin
    
    return {
      tenant: {
        in: tenantIDs
      }
    }
  },
  create: ({ req }) => {
    return getUserTenantIDs(req.user).length > 0
  },
  update: superAdminOrTenantAdmin,
  delete: superAdminOrTenantAdmin
}
```

## Multi-Tenant Plugin Configuration

### Plugin Setup

```typescript
// src/payload.config.ts
plugins: [
  multiTenantPlugin<Config>({
    // Collections to make tenant-aware
    collections: {
      pages: {
        // Optional collection-specific config
      },
    },
    
    // Tenant field configuration
    tenantField: {
      name: 'tenant',
      access: {
        read: () => true,
        update: ({ req }) => {
          if (isSuperAdmin(req.user)) return true
          return getUserTenantIDs(req.user).length > 0
        },
      },
    },
    
    // User's tenants array field config
    tenantsArrayField: {
      name: 'tenants',
      includeDefaultField: false,
    },
    
    // Function to check if user has access to all tenants
    userHasAccessToAllTenants: (user) => isSuperAdmin(user),
  }),
],
```

### What the Plugin Does

1. **Adds tenant field**: Automatically adds a `tenant` relationship field to specified collections
2. **Filters queries**: Intercepts all queries to filter by tenant context
3. **Manages access**: Ensures users can only access data from their assigned tenants
4. **UI integration**: Adds tenant switcher in admin panel for multi-tenant users

## Session and Cookie Management

### Tenant Context in Cookies

```typescript
// src/collections/Users/hooks/setCookieBasedOnDomain.ts
export const setCookieBasedOnDomain: AfterLoginHook = async ({ 
  req, 
  user 
}) => {
  const domain = req.headers.host
  
  // Extract tenant from domain
  const subdomain = domain?.split('.')[0]
  const tenant = await req.payload.find({
    collection: 'tenants',
    where: {
      or: [
        { domain: { equals: domain } },
        { slug: { equals: subdomain } }
      ]
    }
  })
  
  // Set tenant context in session
  req.session.tenantId = tenant?.docs?.[0]?.id
}
```

### Cookie Configuration

- **Name**: `payload-tenant`
- **HttpOnly**: Yes (security)
- **Secure**: Yes in production
- **SameSite**: 'lax' for subdomain compatibility
- **Domain**: Set to parent domain for subdomain sharing

## Request Lifecycle

### 1. Initial Request
```
User → gold.localhost:3000/pages
```

### 2. Middleware Processing
```
Next.js Middleware → Extract 'gold' → Rewrite to /tenant-domains/gold/pages
```

### 3. Route Handler
```
Route Handler → Get tenant from params → Set tenant context
```

### 4. Payload Query
```
Payload → Apply tenant filter → Return filtered data
```

### 5. Response
```
Filtered data → Render → Response to user
```

## Performance Considerations

### Database Indexes

Ensure these indexes exist for optimal performance:

```sql
-- Tenant lookups
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain);

-- Tenant filtering
CREATE INDEX idx_pages_tenant ON pages(tenant);
CREATE INDEX idx_users_tenants ON users USING GIN(tenants);
```

### Query Optimization

1. **Tenant filtering is automatic**: The plugin adds tenant conditions to all queries
2. **Batch loading**: Load tenant data once per request
3. **Caching**: Consider caching tenant lookups (domain → tenant mapping)

## Security Considerations

### Data Isolation

1. **Query-level filtering**: All database queries are automatically filtered
2. **API-level checks**: Additional validation in API endpoints
3. **UI-level filtering**: Admin panel only shows accessible data

### Common Security Patterns

```typescript
// Always verify tenant access
const canAccessTenant = (user: User, tenantId: string): boolean => {
  if (isSuperAdmin(user)) return true
  return getUserTenantIDs(user).includes(tenantId)
}

// Validate tenant context in custom endpoints
export const customEndpoint: Endpoint = {
  path: '/custom/:tenantId',
  method: 'get',
  handler: async (req, res) => {
    const { tenantId } = req.params
    
    if (!canAccessTenant(req.user, tenantId)) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    // Proceed with tenant-scoped logic
  }
}
```

## Debugging Tips

### Common Issues

1. **404 on subdomain access**: Check Next.js rewrites and hosts file
2. **Data not filtering**: Verify collection is in plugin config
3. **Access denied**: Check user's tenant assignments

### Debug Logging

```typescript
// Enable debug mode in development
if (process.env.NODE_ENV === 'development') {
  console.log('Tenant context:', req.session.tenantId)
  console.log('User tenants:', getUserTenantIDs(req.user))
}
```

### Useful Queries

```typescript
// Get all tenants for a user
const userTenants = await payload.find({
  collection: 'tenants',
  where: {
    id: {
      in: getUserTenantIDs(user)
    }
  }
})

// Get all users in a tenant
const tenantUsers = await payload.find({
  collection: 'users',
  where: {
    'tenants.tenant': {
      equals: tenantId
    }
  }
})
