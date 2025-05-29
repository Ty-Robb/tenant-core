# Multi-Tenant User Guide

This guide explains how the multi-tenant system works from an end-user's perspective, covering the complete user journey from sign-up to daily usage.

## Table of Contents

1. [Overview](#overview)
2. [New Customer Sign-Up](#new-customer-sign-up)
3. [First Login Experience](#first-login-experience)
4. [Day-to-Day Usage](#day-to-day-usage)
5. [Team Management](#team-management)
6. [User Roles](#user-roles)
7. [Multi-Tenant Users](#multi-tenant-users)
8. [Common User Workflows](#common-user-workflows)
9. [What Users Don't See](#what-users-dont-see)
10. [Real-World Analogy](#real-world-analogy)

## Overview

In a multi-tenant system, each organization (tenant) gets their own isolated workspace. Think of it like apartment buildings - everyone has their own apartment (tenant) in the same building (application), but you can't access your neighbor's apartment.

## New Customer Sign-Up

### Self-Service Registration Flow

When Sarah wants to create a workspace for her company "Acme Corp":

1. **Visit Main Website**
   - Goes to `yourapp.com`
   - Clicks "Start Free Trial" or "Sign Up"

2. **Registration Form**
   ```
   Company Name: Acme Corp
   Your Name: Sarah Johnson
   Email: sarah@acmecorp.com
   Choose Subdomain: acme
   Password: ********
   ```

3. **Automatic Setup**
   - ✅ Creates new tenant "Acme Corp"
   - ✅ Assigns subdomain `acme.yourapp.com`
   - ✅ Creates Sarah as tenant admin
   - ✅ Sends welcome email
   - ✅ Sets up default workspace

4. **Welcome Email**
   ```
   Subject: Welcome to YourApp - Acme Corp workspace is ready!
   
   Hi Sarah,
   
   Your workspace is ready at: https://acme.yourapp.com
   
   Click here to complete setup and invite your team.
   ```

## First Login Experience

### Initial Setup Wizard

When Sarah first logs in at `acme.yourapp.com/login`:

1. **Welcome Screen**
   - Personalized greeting
   - Quick tour option
   - Setup checklist

2. **Company Customization**
   - Upload company logo
   - Set brand colors
   - Configure company details
   - Set timezone and preferences

3. **Profile Setup**
   - Complete personal profile
   - Upload profile picture
   - Set notification preferences

4. **Invite Team Members**
   - Option to invite colleagues
   - Can skip and do later
   - Bulk invite via CSV

5. **Feature Configuration**
   - Enable/disable features
   - Set default permissions
   - Configure integrations

## Day-to-Day Usage

### Accessing Your Workspace

**URL Structure:**
- Always at: `acme.yourapp.com`
- Bookmarkable and shareable with team
- SSL secured

**What Users See:**
- Company-branded interface
- Only Acme Corp's data
- Team members from Acme only
- Customized features for their plan

### Typical Dashboard

```
┌─────────────────────────────────────────┐
│  [Acme Logo]  Dashboard    Sarah ▼      │
├─────────────────────────────────────────┤
│                                         │
│  Welcome back, Sarah!                   │
│                                         │
│  Quick Stats:                           │
│  • 5 team members                       │
│  • 23 active projects                   │
│  • 156 pages created                    │
│                                         │
│  Recent Activity:                       │
│  • John updated "Q4 Report"             │
│  • Mary created "New Campaign"          │
│  • System backup completed              │
│                                         │
└─────────────────────────────────────────┘
```

## Team Management

### Inviting Team Members

#### Method 1: Direct Email Invite

1. **Navigate to Team Section**
   ```
   Dashboard → Settings → Team Members → Invite
   ```

2. **Send Invitation**
   ```
   Email: john@acmecorp.com
   Role: [Dropdown: Admin / Editor / Viewer]
   Message: "Hi John, join our Acme workspace!"
   [Send Invitation]
   ```

3. **Recipient Experience**
   - John receives branded email
   - Clicks unique invite link
   - Lands on `acme.yourapp.com/invite/abc123`
   - Creates password
   - Automatically joined to Acme tenant

#### Method 2: Invite Link

1. **Generate Invite Link**
   ```
   Settings → Team → Generate Invite Link
   Link: acme.yourapp.com/join/xyz789
   Expires: 7 days
   Max uses: 10
   ```

2. **Share with Team**
   - Send via Slack/email
   - Post in company wiki
   - Include in onboarding docs

### Managing Team Members

**Team List View:**
```
Team Members (5)
┌────────────────┬──────────────┬────────┬──────────┐
│ Name           │ Email        │ Role   │ Actions  │
├────────────────┼──────────────┼────────┼──────────┤
│ Sarah Johnson  │ sarah@...    │ Admin  │ You      │
│ John Smith     │ john@...     │ Admin  │ Edit │ ✗ │
│ Mary Davis     │ mary@...     │ Editor │ Edit │ ✗ │
│ Bob Wilson     │ bob@...      │ Viewer │ Edit │ ✗ │
│ Pending        │ alex@...     │ Admin  │ Resend │ ✗│
└────────────────┴──────────────┴────────┴──────────┘
```

## User Roles

### Within Each Tenant

#### Tenant Admin
- ✅ Full access to all features
- ✅ Invite/remove team members
- ✅ Manage billing and subscription
- ✅ Configure tenant settings
- ✅ Access all content

#### Tenant Editor
- ✅ Create and edit content
- ✅ Publish changes
- ✅ View all content
- ❌ Cannot manage team
- ❌ Cannot change settings

#### Tenant Viewer
- ✅ View all content
- ✅ Download/export allowed items
- ❌ Cannot edit anything
- ❌ Cannot invite others
- ❌ Read-only access

## Multi-Tenant Users

### Users in Multiple Organizations

**Scenario**: Sarah consults for multiple companies

1. **Multiple Memberships**
   - Member of "Acme Corp" (Admin)
   - Member of "Beta Inc" (Editor)
   - Member of "Gamma LLC" (Viewer)

2. **Tenant Switcher**
   ```
   ┌─────────────────────┐
   │ Current: Acme Corp ▼│
   ├─────────────────────┤
   │ • Acme Corp (Admin) │
   │ • Beta Inc (Editor) │
   │ • Gamma LLC (Viewer)│
   │ ─────────────────── │
   │ + Add Organization  │
   └─────────────────────┘
   ```

3. **Switching Experience**
   - Click dropdown to see all tenants
   - Select different tenant
   - Page refreshes to new context
   - URL changes to new subdomain
   - See only that tenant's data

## Common User Workflows

### Content Management Workflow

1. **Creating Content**
   ```
   1. Login to acme.yourapp.com
   2. Navigate to Content → Pages
   3. Click "New Page"
   4. Fill in details
   5. Save/Publish
   6. Automatically tagged to Acme tenant
   ```

2. **Collaboration**
   ```
   1. Sarah creates draft
   2. Assigns to John for review
   3. John gets notification
   4. John logs in, sees only Acme content
   5. Reviews and approves
   6. Sarah publishes
   ```

### Project Management Example

```
Acme Corp Workspace
├── Projects (visible to all Acme users)
│   ├── Q4 Marketing Campaign
│   ├── Website Redesign
│   └── Product Launch 2024
├── Team Members (5)
├── Documents (Acme only)
└── Settings (Admin only)
```

## What Users Don't See

### Complete Isolation

Users NEVER see:
- ❌ Other tenants' existence
- ❌ System-wide admin panels
- ❌ Data from other companies
- ❌ Users from other tenants
- ❌ Global system settings
- ❌ Other tenants' URLs
- ❌ Cross-tenant statistics

### Behind the Scenes

What's hidden:
- Database isolation per tenant
- Automatic data filtering
- Tenant ID assignment
- System-level operations
- Infrastructure details

## Real-World Analogy

### Think of it like Slack

**Similarities to Slack Workspaces:**

1. **Separate Workspaces**
   - Acme has `acme.slack.com`
   - Beta has `beta.slack.com`
   - Complete isolation

2. **Joining Multiple**
   - Can be in multiple workspaces
   - Switch between them
   - Different roles in each

3. **Team Management**
   - Invite by email
   - Manage permissions
   - Remove members

4. **Data Isolation**
   - Can't see other workspaces
   - Messages stay within workspace
   - Files are workspace-specific

## Benefits for Users

### 1. **Privacy & Security**
- Your data is completely isolated
- No accidental data leaks
- Tenant-specific backups

### 2. **Customization**
- Brand it as your own
- Configure for your needs
- Choose your features

### 3. **Simplicity**
- Clean, focused interface
- Only see relevant data
- No clutter from others

### 4. **Team Collaboration**
- Easy to invite colleagues
- Everyone sees same data
- Real-time updates

### 5. **Scalability**
- Grow at your own pace
- Add users as needed
- Upgrade when ready

## Frequently Asked Questions

### For End Users

**Q: Can I be in multiple organizations?**
A: Yes, you can be a member of multiple tenants with different roles in each.

**Q: How do I switch between organizations?**
A: Use the tenant switcher dropdown in the top navigation.

**Q: Can people from other companies see our data?**
A: No, complete isolation ensures only your team sees your data.

**Q: How do I invite someone to our workspace?**
A: Go to Settings → Team → Invite and enter their email address.

**Q: What happens if I forget which subdomain to use?**
A: Check your welcome email or contact your admin for the correct URL.

**Q: Can we customize the look and feel?**
A: Yes, tenant admins can upload logos and set brand colors.

## Support and Help

### Getting Help

1. **In-App Help**
   - Click the ? icon
   - Search documentation
   - Contact support

2. **Tenant Admin**
   - First point of contact
   - Can manage most issues
   - Has elevated permissions

3. **Support Team**
   - For technical issues
   - Billing questions
   - Feature requests

---

This guide covers the essential user experience in a multi-tenant system. For technical implementation details, see the [Technical Documentation](./TENANTS-TECHNICAL.md).
