# API Usage Guide

This document covers how to interact with the multi-tenant system through REST and GraphQL APIs.

## Authentication

### Login Endpoint

```bash
POST /api/users/login
Content-Type: application/json

{
  "email": "tenant1@payloadcms.com",
  "password": "demo"
}
```

Response:
```json
{
  "user": {
    "id": "123",
    "email": "tenant1@payloadcms.com",
    "tenants": [
      {
        "tenant": "456",
        "roles": ["tenant-admin"]
      }
    ]
  },
  "token": "jwt-token-here",
  "exp": 1234567890
}
```

### Using the Token

Include the token in subsequent requests:
```bash
Authorization: JWT your-token-here
```

## REST API

### Tenant-Scoped Endpoints

All tenant-scoped collections automatically filter by the user's tenant access.

#### Get Pages (filtered by tenant)
```bash
GET /api/pages
Authorization: JWT your-token-here
```

Response:
```json
{
  "docs": [
    {
      "id": "789",
      "title": "Page for Tenant 1",
      "slug": "home",
      "tenant": {
        "id": "456",
        "name": "Tenant 1",
        "slug": "gold"
      }
    }
  ],
  "totalDocs": 1,
  "limit": 10,
  "page": 1,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPrevPage": false
}
```

#### Create a Page
```bash
POST /api/pages
Authorization: JWT your-token-here
Content-Type: application/json

{
  "title": "New Page",
  "slug": "new-page",
  "tenant": "456"  // Must be a tenant the user has access to
}
```

### Tenant Management (Super Admin Only)

#### List All Tenants
```bash
GET /api/tenants
Authorization: JWT super-admin-token
```

#### Create a Tenant
```bash
POST /api/tenants
Authorization: JWT super-admin-token
Content-Type: application/json

{
  "name": "New Tenant",
  "slug": "new-tenant",
  "domain": "new-tenant.localhost"
}
```

### User Management

#### Get Current User with Tenant Info
```bash
GET /api/users/me
Authorization: JWT your-token-here
```

Response:
```json
{
  "user": {
    "id": "123",
    "email": "multi-admin@payloadcms.com",
    "tenants": [
      {
        "tenant": {
          "id": "456",
          "name": "Tenant 1",
          "slug": "gold"
        },
        "roles": ["tenant-admin"]
      },
      {
        "tenant": {
          "id": "789",
          "name": "Tenant 2",
          "slug": "silver"
        },
        "roles": ["tenant-admin"]
      }
    ]
  }
}
```

## GraphQL API

### Schema Overview

```graphql
type Tenant {
  id: String!
  name: String!
  slug: String!
  domain: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User {
  id: String!
  email: String!
  username: String
  roles: [String!]
  tenants: [UserTenant!]
}

type UserTenant {
  tenant: Tenant!
  roles: [String!]!
}

type Page {
  id: String!
  title: String!
  slug: String!
  tenant: Tenant!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Common Queries

#### Get Pages for Current User's Tenants
```graphql
query GetMyPages {
  Pages {
    docs {
      id
      title
      slug
      tenant {
        id
        name
        slug
      }
    }
  }
}
```

#### Get Specific Tenant's Pages
```graphql
query GetTenantPages($tenantId: String!) {
  Pages(where: { tenant: { equals: $tenantId } }) {
    docs {
      id
      title
      slug
    }
  }
}
```

#### Get User with Tenant Details
```graphql
query GetUserWithTenants($userId: String!) {
  User(id: $userId) {
    id
    email
    tenants {
      tenant {
        id
        name
        slug
        domain
      }
      roles
    }
  }
}
```

### Common Mutations

#### Create a Page
```graphql
mutation CreatePage($title: String!, $slug: String!, $tenantId: String!) {
  createPage(data: { title: $title, slug: $slug, tenant: $tenantId }) {
    id
    title
    slug
    tenant {
      id
      name
    }
  }
}
```

#### Update User Tenant Access
```graphql
mutation UpdateUserTenants($userId: String!, $tenants: [UserTenantInput!]!) {
  updateUser(id: $userId, data: { tenants: $tenants }) {
    id
    tenants {
      tenant {
        id
        name
      }
      roles
    }
  }
}
```

## Custom Endpoints

### External User Login

The system includes a custom endpoint for tenant-specific login:

```bash
POST /api/users/external-login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "tenantSlug": "gold"  // Optional: specify tenant context
}
```

This endpoint:
1. Validates the user credentials
2. Checks if the user has access to the specified tenant
3. Sets the tenant context in the session
4. Returns a JWT token with tenant context

### Implementing Custom Tenant-Aware Endpoints

```typescript
// src/collections/CustomCollection/endpoints/customEndpoint.ts
import type { Endpoint } from 'payload/config'
import { getUserTenantIDs } from '../../../utilities/getUserTenantIDs'

export const customTenantEndpoint: Endpoint = {
  path: '/tenant/:tenantId/custom-action',
  method: 'post',
  handler: async (req, res) => {
    const { tenantId } = req.params
    const userTenantIDs = getUserTenantIDs(req.user)
    
    // Verify user has access to this tenant
    if (!userTenantIDs.includes(tenantId) && !userTenantIDs.includes('*')) {
      return res.status(403).json({ 
        error: 'Access denied to this tenant' 
      })
    }
    
    // Perform tenant-scoped operation
    const result = await req.payload.find({
      collection: 'pages',
      where: {
        tenant: { equals: tenantId }
      }
    })
    
    return res.json({ 
      success: true, 
      tenant: tenantId,
      pageCount: result.totalDocs 
    })
  }
}
```

## API Security Best Practices

### 1. Always Validate Tenant Access

```typescript
// Before any tenant-specific operation
const hasAccess = getUserTenantIDs(req.user).includes(tenantId) || 
                  isSuperAdmin(req.user)

if (!hasAccess) {
  throw new ForbiddenError('Access denied to this tenant')
}
```

### 2. Use Depth Limiting

Prevent expensive nested queries:
```bash
GET /api/pages?depth=2  // Limit relationship depth
```

### 3. Implement Rate Limiting

```typescript
// In custom endpoints
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/api/custom', rateLimiter)
```

### 4. Validate Tenant Context in Mutations

```typescript
// When creating/updating tenant-scoped data
beforeChange: [
  ({ data, req }) => {
    const userTenants = getUserTenantIDs(req.user)
    
    if (data.tenant && !userTenants.includes(data.tenant)) {
      throw new Error('Cannot assign to unauthorized tenant')
    }
    
    return data
  }
]
```

## Testing API Endpoints

### Using cURL

```bash
# Login
TOKEN=$(curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant1@payloadcms.com","password":"demo"}' \
  | jq -r '.token')

# Get pages
curl -X GET http://localhost:3000/api/pages \
  -H "Authorization: JWT $TOKEN" \
  | jq '.docs'

# Create a page
curl -X POST http://localhost:3000/api/pages \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Page",
    "slug": "api-test",
    "tenant": "your-tenant-id"
  }'
```

### Using JavaScript/TypeScript

```typescript
// Using fetch
const login = async () => {
  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'tenant1@payloadcms.com',
      password: 'demo'
    })
  })
  
  const { token } = await response.json()
  return token
}

const getPages = async (token: string) => {
  const response = await fetch('/api/pages', {
    headers: { 'Authorization': `JWT ${token}` }
  })
  
  return response.json()
}

// Using Payload SDK
import { getPayloadClient } from 'payload'

const payload = await getPayloadClient({ 
  seed: false,
  email: 'tenant1@payloadcms.com',
  password: 'demo'
})

const pages = await payload.find({
  collection: 'pages',
  // Automatically filtered by user's tenant access
})
```

## Webhooks and Tenant Context

When implementing webhooks for tenant events:

```typescript
// In collection config
hooks: {
  afterChange: [
    async ({ doc, req, operation }) => {
      if (operation === 'create') {
        // Send webhook with tenant context
        await sendWebhook({
          url: process.env.WEBHOOK_URL,
          data: {
            event: 'page.created',
            tenant: doc.tenant,
            page: doc,
            timestamp: new Date()
          },
          headers: {
            'X-Tenant-ID': doc.tenant,
            'X-Webhook-Secret': process.env.WEBHOOK_SECRET
          }
        })
      }
    }
  ]
}
```

## Error Handling

Common API errors and their meanings:

| Status Code | Error | Description |
|-------------|-------|-------------|
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User lacks permission for this tenant/resource |
| 404 | Not Found | Resource doesn't exist or user can't access it |
| 422 | Validation Error | Invalid data provided |

Example error response:
```json
{
  "errors": [
    {
      "message": "You do not have permission to access this tenant",
      "field": "tenant"
    }
  ]
}
