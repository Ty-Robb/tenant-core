# Setup Guide

This guide walks you through setting up the multi-tenant system from scratch or integrating it into an existing Payload CMS project.

## Prerequisites

- Node.js 18.20.2 or higher
- PostgreSQL or MongoDB database
- pnpm, npm, or yarn package manager

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd tenant-core

# Install dependencies
pnpm install
```

### 2. Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure your environment variables:

```env
# Database (choose one)
POSTGRES_URL=postgresql://user:password@localhost:5432/tenant_db
# or
DATABASE_URI=mongodb://localhost:27017/tenant_db

# Payload Secret (generate a secure random string)
PAYLOAD_SECRET=your-very-secure-random-string-here

# Application URL
APP_URL=http://localhost:3000
BASE_DOMAIN=localhost

# Optional: Email configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
FROM_EMAIL=noreply@example.com

# Optional: Enable seeding on first run
SEED_DB=true
```

### 3. Database Setup

#### For PostgreSQL:

```bash
# Create the database
createdb tenant_db

# Run migrations
pnpm payload migrate:create
pnpm payload migrate
```

#### For MongoDB:

No additional setup needed - collections will be created automatically.

### 4. Configure Hosts File (for local subdomain testing)

Add these entries to your hosts file:

**macOS/Linux:** `/etc/hosts`
**Windows:** `C:\Windows\System32\drivers\etc\hosts`

```
127.0.0.1 gold.localhost
127.0.0.1 silver.localhost
127.0.0.1 bronze.localhost
```

### 5. Run the Application

```bash
# Development mode with seeding
SEED_DB=true pnpm dev

# Development mode without seeding
pnpm dev

# Production build
pnpm build
pnpm start
```

## Manual Setup in Existing Project

### 1. Install Dependencies

```bash
pnpm add @payloadcms/plugin-multi-tenant
```

### 2. Configure Payload

Update your `payload.config.ts`:

```typescript
import { buildConfig } from 'payload'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { Pages } from './collections/Pages'

export default buildConfig({
  // ... your existing config
  
  collections: [
    Tenants,
    Users,
    Pages,
    // ... your other collections
  ],
  
  plugins: [
    multiTenantPlugin({
      collections: {
        pages: {},
        // Add other collections you want to be tenant-scoped
      },
      tenantField: {
        access: {
          read: () => true,
          update: ({ req }) => {
            if (isSuperAdmin(req.user)) return true
            return getUserTenantIDs(req.user).length > 0
          },
        },
      },
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => isSuperAdmin(user),
    }),
  ],
})
```

### 3. Create Required Collections

#### Tenants Collection

```typescript
// src/collections/Tenants/index.ts
import type { CollectionConfig } from 'payload/types'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier',
      },
      validate: (value) => {
        if (!value) return 'Slug is required'
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'Slug must contain only lowercase letters, numbers, and hyphens'
        }
        return true
      },
    },
    {
      name: 'domain',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Full domain or subdomain',
      },
    },
  ],
  access: {
    read: () => true,
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
}
```

#### Update Users Collection

```typescript
// src/collections/Users/index.ts
import type { CollectionConfig } from 'payload/types'

const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'username',
      type: 'text',
      unique: true,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        {
          label: 'Super Admin',
          value: 'super-admin',
        },
      ],
      access: {
        update: ({ req }) => isSuperAdmin(req.user),
      },
    },
    // The tenants field is added by the plugin
  ],
}

export default Users
```

### 4. Create Utility Functions

```typescript
// src/access/isSuperAdmin.ts
import type { User } from '../payload-types'

export const isSuperAdmin = (user: User | null): boolean => {
  return user?.roles?.includes('super-admin') || false
}

// src/utilities/getUserTenantIDs.ts
import type { User } from '../payload-types'
import { isSuperAdmin } from '../access/isSuperAdmin'

export const getUserTenantIDs = (user: User | null): string[] => {
  if (!user) return []
  if (isSuperAdmin(user)) return ['*']
  return user.tenants?.map(t => t.tenant) || []
}
```

### 5. Configure Next.js Routing

Update `next.config.mjs` for subdomain routing:

```javascript
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: '/tenant-domains/:tenant/:path*',
        has: [
          {
            type: 'host',
            value: '(?<tenant>[^.]+)\\..*',
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
```

## Troubleshooting

### Common Issues

#### 1. 404 Error on Subdomain Access

**Problem:** Getting 404 when accessing `gold.localhost:3000`

**Solutions:**
- Verify hosts file entries are correct
- Check Next.js rewrite configuration
- Ensure the tenant exists in the database
- Try slug-based routing first: `localhost:3000/tenant-slugs/gold`

#### 2. "No migration directory found" Error

**Problem:** Error when running seed command

**Solution:**
```bash
pnpm payload migrate:create
pnpm payload migrate
```

#### 3. Cannot Login to Tenant

**Problem:** Login fails for tenant-specific users

**Possible causes:**
- User doesn't have access to the tenant
- Incorrect tenant domain/slug
- Cookie domain mismatch

**Debug steps:**
```bash
# Check user's tenant access
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: JWT your-token"
```

#### 4. Data Not Filtering by Tenant

**Problem:** Users can see data from other tenants

**Solutions:**
- Verify collection is added to multi-tenant plugin config
- Check access control functions
- Ensure tenant field exists on documents

### Debug Mode

Enable debug logging by adding to your `.env`:

```env
DEBUG=payload:*
NODE_ENV=development
```

### Database Queries

Useful queries for debugging:

```sql
-- PostgreSQL: Check tenant assignments
SELECT u.email, t.name as tenant_name, ut.roles
FROM users u
JOIN users_tenants ut ON u.id = ut.parent_id
JOIN tenants t ON ut.tenant_id = t.id;

-- Check pages by tenant
SELECT p.title, p.slug, t.name as tenant_name
FROM pages p
JOIN tenants t ON p.tenant_id = t.id
ORDER BY t.name;
```

## Production Deployment

### 1. Environment Variables

Set production environment variables:

```env
NODE_ENV=production
PAYLOAD_SECRET=<strong-random-string>
POSTGRES_URL=<production-database-url>
APP_URL=https://yourdomain.com
BASE_DOMAIN=yourdomain.com
```

### 2. Database Migrations

Run migrations on production:

```bash
pnpm payload migrate
```

### 3. Domain Configuration

#### DNS Setup

Add wildcard DNS record:
```
*.yourdomain.com → your-server-ip
```

#### SSL Certificate

Use wildcard certificate:
```bash
# Using Let's Encrypt
certbot certonly --manual --preferred-challenges dns \
  -d "*.yourdomain.com" -d "yourdomain.com"
```

### 4. Reverse Proxy Configuration

#### Nginx Example

```nginx
server {
    listen 443 ssl http2;
    server_name *.yourdomain.com;
    
    ssl_certificate /path/to/wildcard.crt;
    ssl_certificate_key /path/to/wildcard.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Process Management

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "tenant-app" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

## Security Checklist

- [ ] Strong `PAYLOAD_SECRET` in production
- [ ] HTTPS enabled for all domains
- [ ] Database connection using SSL
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Environment variables not exposed
- [ ] Regular security updates
- [ ] Backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Access logs enabled

## Next Steps

1. Review [Common Patterns](./TENANTS-PATTERNS.md) for implementation examples
2. Check [API Usage](./TENANTS-API.md) for integration
3. Implement [Self-Service Registration](./TENANTS-SELF-SERVICE.md) if needed
