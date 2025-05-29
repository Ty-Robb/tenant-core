# Multi-Tenant System Documentation

This document explains how the multi-tenant system works in the tenant-core project.

## Overview

This project implements a multi-tenant architecture using Payload CMS with the `@payloadcms/plugin-multi-tenant` plugin. Each tenant represents a separate organization or client that can have its own isolated data while sharing the same application infrastructure.

## How Tenants Work

### 1. Tenant Structure

Each tenant has:
- **Name**: A display name for the tenant (e.g., "Tenant 1")
- **Slug**: A URL-friendly identifier (e.g., "gold", "silver", "bronze")
- **Domain**: A domain/subdomain for tenant-specific access (e.g., "gold.localhost")

### 2. Data Isolation

The multi-tenant plugin ensures data isolation by:
- Automatically adding a `tenant` field to configured collections (currently `Pages`)
- Filtering data based on the user's tenant access
- Preventing cross-tenant data access

### 3. User Roles and Access

#### User Types:
1. **Super Admin** (`roles: ['super-admin']`)
   - Has access to all tenants
   - Can manage all data across the system
   - Example: demo@payloadcms.com

2. **Tenant Admin** (`roles: ['tenant-admin']`)
   - Has admin access to specific tenant(s)
   - Can only see and manage data for their assigned tenant(s)
   - Examples: tenant1@payloadcms.com (Tenant 1 only)

3. **Multi-Tenant Admin**
   - A user with tenant-admin role for multiple tenants
   - Example: multi-admin@payloadcms.com (access to all three tenants)

### 4. Accessing Different Tenants

There are two routing strategies implemented:

#### A. Domain-based routing (`/tenant-domains/[tenant]/`)
- Access tenants via subdomains
- Examples:
  - http://gold.localhost:3000 → Tenant 1
  - http://silver.localhost:3000 → Tenant 2
  - http://bronze.localhost:3000 → Tenant 3

#### B. Slug-based routing (`/tenant-slugs/[tenant]/`)
- Access tenants via URL path
- Examples:
  - http://localhost:3000/tenant-slugs/gold → Tenant 1
  - http://localhost:3000/tenant-slugs/silver → Tenant 2
  - http://localhost:3000/tenant-slugs/bronze → Tenant 3

### 5. Tenant-Specific Features

#### Pages Collection
- Each page is associated with a specific tenant
- Pages are automatically filtered based on the current tenant context
- The `slug` field is unique per tenant (same slug can exist in different tenants)

#### Login System
- Tenant-specific login pages:
  - Domain-based: http://gold.localhost:3000/login
  - Slug-based: http://localhost:3000/tenant-slugs/gold/login
- Users can only log in to tenants they have access to

## Development Setup

### Local Development with Subdomains

To test domain-based routing locally, you need to set up local subdomains:

1. **On macOS/Linux**, add to `/etc/hosts`:
   ```
   127.0.0.1 gold.localhost
   127.0.0.1 silver.localhost
   127.0.0.1 bronze.localhost
   ```

2. **On Windows**, add to `C:\Windows\System32\drivers\etc\hosts`:
   ```
   127.0.0.1 gold.localhost
   127.0.0.1 silver.localhost
   127.0.0.1 bronze.localhost
   ```

### Testing Different User Scenarios

1. **Super Admin Access**
   - Login: demo@payloadcms.com / demo
   - Can access admin panel and see all tenants
   - Can switch between tenants in the admin UI

2. **Single Tenant Admin**
   - Login: tenant1@payloadcms.com / demo
   - Can only see Tenant 1 data
   - Cannot access other tenants' data

3. **Multi-Tenant Admin**
   - Login: multi-admin@payloadcms.com / demo
   - Can switch between all assigned tenants
   - Useful for agencies managing multiple clients

## Code Structure

### Key Files

- `src/payload.config.ts` - Multi-tenant plugin configuration
- `src/collections/Tenants/` - Tenant collection definition
- `src/collections/Users/` - User collection with tenant relationships
- `src/collections/Pages/` - Example of a tenant-scoped collection
- `src/app/(app)/tenant-domains/` - Domain-based routing implementation
- `src/app/(app)/tenant-slugs/` - Slug-based routing implementation

### Access Control

Access control is implemented through:
- `src/access/isSuperAdmin.ts` - Check if user is super admin
- `src/utilities/getUserTenantIDs.ts` - Get user's accessible tenant IDs
- Collection-specific access controls in each collection's `access` folder

## Adding New Tenant-Scoped Collections

To add a new collection that should be tenant-scoped:

1. Create the collection in `src/collections/`
2. Add it to the multi-tenant plugin configuration in `payload.config.ts`:
   ```typescript
   plugins: [
     multiTenantPlugin<Config>({
       collections: {
         pages: {},
         yourNewCollection: {}, // Add here
       },
       // ... rest of config
     }),
   ],
   ```

3. The plugin will automatically:
   - Add a `tenant` field to the collection
   - Filter data based on user's tenant access
   - Apply tenant-based access controls

## Production Considerations

1. **Domain Configuration**
   - Set up actual subdomains in your DNS provider
   - Configure your hosting platform to handle wildcard subdomains

2. **SSL Certificates**
   - Use wildcard SSL certificates for subdomain-based routing
   - Or configure individual certificates for each tenant domain

3. **Performance**
   - Consider implementing caching strategies per tenant
   - Monitor database queries to ensure efficient tenant filtering

4. **Scaling**
   - The shared database approach works well for moderate numbers of tenants
   - For large-scale deployments, consider database sharding strategies
