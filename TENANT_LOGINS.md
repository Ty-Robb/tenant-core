# Tenant Login Credentials

This document contains all the login credentials created by the seed script.

## Admin Panel Access

URL: http://localhost:3000/admin

## User Accounts

### 1. Super Admin
- **Email**: demo@payloadcms.com
- **Password**: demo
- **Access**: All tenants (system-wide admin)
- **Role**: super-admin

### 2. Tenant 1 Admin (Gold)
- **Email**: tenant1@payloadcms.com
- **Password**: demo
- **Username**: tenant1
- **Access**: Tenant 1 only
- **Tenant**: Gold (gold.localhost)
- **Role**: tenant-admin

### 3. Tenant 2 Admin (Silver)
- **Email**: tenant2@payloadcms.com
- **Password**: demo
- **Username**: tenant2
- **Access**: Tenant 2 only
- **Tenant**: Silver (silver.localhost)
- **Role**: tenant-admin

### 4. Tenant 3 Admin (Bronze)
- **Email**: tenant3@payloadcms.com
- **Password**: demo
- **Username**: tenant3
- **Access**: Tenant 3 only
- **Tenant**: Bronze (bronze.localhost)
- **Role**: tenant-admin

### 5. Multi-Tenant Admin
- **Email**: multi-admin@payloadcms.com
- **Password**: demo
- **Username**: multi-admin
- **Access**: All three tenants (Tenant 1, 2, and 3)
- **Role**: tenant-admin for all assigned tenants

## Tenant Information

### Tenant 1
- **Name**: Tenant 1
- **Slug**: gold
- **Domain**: gold.localhost
- **Home Page**: Created with title "Page for Tenant 1"

### Tenant 2
- **Name**: Tenant 2
- **Slug**: silver
- **Domain**: silver.localhost
- **Home Page**: Created with title "Page for Tenant 2"

### Tenant 3
- **Name**: Tenant 3
- **Slug**: bronze
- **Domain**: bronze.localhost
- **Home Page**: Created with title "Page for Tenant 3"

## Access Methods

### 1. Domain-based Access (requires hosts file setup)
- Gold: http://gold.localhost:3000
- Silver: http://silver.localhost:3000
- Bronze: http://bronze.localhost:3000

### 2. Slug-based Access (works without hosts file)
- Gold: http://localhost:3000/tenant-slugs/gold
- Silver: http://localhost:3000/tenant-slugs/silver
- Bronze: http://localhost:3000/tenant-slugs/bronze

### 3. Login Pages
**Domain-based:**
- http://gold.localhost:3000/login
- http://silver.localhost:3000/login
- http://bronze.localhost:3000/login

**Slug-based:**
- http://localhost:3000/tenant-slugs/gold/login
- http://localhost:3000/tenant-slugs/silver/login
- http://localhost:3000/tenant-slugs/bronze/login

## Testing Different Scenarios

1. **Super Admin**: Use demo@payloadcms.com to access everything
2. **Single Tenant**: Use tenant1@payloadcms.com to see only Tenant 1 data
3. **Multi-Tenant**: Use multi-admin@payloadcms.com to switch between tenants
4. **Cross-Tenant Isolation**: Login as tenant1@payloadcms.com and verify you cannot see Tenant 2 or 3 data

## Notes

- All passwords are set to "demo" for testing purposes
- These credentials are created by the seed script in `src/seed.ts`
- To recreate these users, run: `SEED_DB=true pnpm dev`
