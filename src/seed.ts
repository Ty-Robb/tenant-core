import { Config } from 'payload'

export const seed: NonNullable<Config['onInit']> = async (payload): Promise<void> => {
  // Determine domain based on environment
  const isProduction = process.env.NODE_ENV === 'production'
  const baseDomain = isProduction ? 'usepriority.com' : 'localhost:3000'
  
  const tenant1 = await payload.create({
    collection: 'tenants',
    data: {
      name: 'Gold',
      slug: 'gold',
      domain: `gold.${baseDomain}`,
    },
  })

  const tenant2 = await payload.create({
    collection: 'tenants',
    data: {
      name: 'Silver',
      slug: 'silver',
      domain: `silver.${baseDomain}`,
    },
  })

  const tenant3 = await payload.create({
    collection: 'tenants',
    data: {
      name: 'Bronze',
      slug: 'bronze',
      domain: `bronze.${baseDomain}`,
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'demo@payloadcms.com',
      password: 'demo',
      roles: ['super-admin'],
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'tenant1@payloadcms.com',
      password: 'demo',
      tenants: [
        {
          roles: ['tenant-admin'],
          tenant: tenant1.id,
        },
      ],
      username: 'tenant1',
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'tenant2@payloadcms.com',
      password: 'demo',
      tenants: [
        {
          roles: ['tenant-admin'],
          tenant: tenant2.id,
        },
      ],
      username: 'tenant2',
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'tenant3@payloadcms.com',
      password: 'demo',
      tenants: [
        {
          roles: ['tenant-admin'],
          tenant: tenant3.id,
        },
      ],
      username: 'tenant3',
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'multi-admin@payloadcms.com',
      password: 'demo',
      tenants: [
        {
          roles: ['tenant-admin'],
          tenant: tenant1.id,
        },
        {
          roles: ['tenant-admin'],
          tenant: tenant2.id,
        },
        {
          roles: ['tenant-admin'],
          tenant: tenant3.id,
        },
      ],
      username: 'multi-admin',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      slug: 'home',
      tenant: tenant1.id,
      title: 'Page for Tenant 1',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      slug: 'home',
      tenant: tenant2.id,
      title: 'Page for Tenant 2',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      slug: 'home',
      tenant: tenant3.id,
      title: 'Page for Tenant 3',
    },
  })
}
