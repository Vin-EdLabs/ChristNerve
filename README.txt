CHRISTNERVE SYSTEM README
========================

ChristNerve is a multi-tenant church management and member engagement platform designed to help churches operate digitally, communicate clearly, manage ministry workflows, and grow community impact. It brings together church administration, pastoral care, attendance, giving, announcements, content publishing, live events, and a member-powered marketplace in one unified system.

This platform is built for churches that want more than a basic website. It is a complete digital church operating system with tenant isolation, role-based access control, real-time collaboration, branding, and public-facing ministry experiences.


WHAT THIS SYSTEM DOES
---------------------

ChristNerve covers the complete lifecycle of church operations, including:
- Member and staff management
- Attendance tracking
- Financial giving and expense management
- Church events, announcements, and communication
- Department and ministry organization
- Pastoral care workflows
- Sermons, devotionals, bulletins, feed content, and growth reporting
- Notifications and automation
- Live room hosting and church livestream workflows
- Marketplace storefronts for members and sellers
- Public church discovery and visitor engagement
- Platform leadership and multi-church administration

It is built for a church ecosystem where members are not only participants, but also contributors to ministry, commerce, and visibility.


SYSTEM OVERVIEW
---------------

The platform is structured around a multi-tenant model. Every church is treated as an independent tenant with its own:
- branding and identity
- members and staff
- attendance records
- giving data
- announcements and events
- pastoral workflows
- media content
- marketplace listings
- reports and dashboards

This ensures that a church’s data stays isolated and secure while the platform operator can manage multiple church organizations from one control plane.


CORE PRODUCT LAYERS
-------------------

1. Platform Layer
The platform layer is the control center for operators and super administrators.

This includes:
- managing church tenants
- reviewing new church registrations
- approving or rejecting church accounts
- monitoring platform health and usage
- viewing audit trails and notifications
- managing platform-level settings and oversight

2. Church Layer
Each church has a private, branded portal for staff and members.

This includes:
- admin dashboard
- member management
- attendance tracking
- finance and expenses
- events and announcements
- departments
- pastoral care
- content publishing
- live rooms and livestream link management
- marketplace tools

3. Public Layer
The public layer gives churches a digital front door.

This includes:
- public church page
- visit experience
- event visibility
- member storefronts
- listing discovery
- public join flows and church interest capture


ARCHITECTURE
------------

The system is split into:

Frontend
- React + TypeScript
- Vite + modern SPA routing
- Tenant-aware navigation
- Public pages, church dashboard pages, admin pages, and marketplace pages
- Real-time interfaces for live and chat experiences
- PWA-friendly install and notification support

Backend
- Node.js + Express + TypeScript
- REST-style API routes grouped by feature area
- Tenant-aware middleware and authorization checks
- PostgreSQL data access with parameterized SQL
- JWT-based authentication
- Socket.IO for live event updates and real-time communication
- File and media upload support
- notification services and live session support

Database
- PostgreSQL
- schema migrations and seed datasets
- tenant-based record isolation
- data support for church operations, marketplace, and social ministry features


LIVE ROOM AND LIVE STREAM FEATURES
---------------------------------

This product includes a strong live communication layer designed for modern church engagement.

Live room features:
- create church live rooms
- manage active rooms and sessions
- join rooms with secure or public access flow
- host teaching sessions, prayer meetings, worship sessions, and ministry meetings
- support video-based church engagement from the dashboard
- integrate room presence and active session overlays
- connect with live call components and room workflows

Live stream features:
- store and manage livestream URLs
- enable church livestream publishing and promotion
- present live stream content through the church dashboard and public experience
- support a church’s digital worship flow
- integrate with live media pages and church-life modules

Technical live stack:
- LiveKit integration for streaming and room infrastructure
- Socket.IO for real-time presence and interaction updates
- room creation and public join flows
- active call overlay UI for ongoing live sessions
- church livestream management under the church-life and live modules

This means the platform is not just static church content. It supports live, real-time ministry experiences, making it suitable for:
- Sunday service livestreams
- prayer meetings
- virtual events
- teaching rooms
- youth gatherings
- ministry calls
- live announcements and online worship


MAIN MODULES
------------

1. Dashboard
The church dashboard provides a summary of core operational health.

Tracked metrics include:
- total and active members
- recent attendance
- monthly giving
- new members
- events and announcements
- pastoral care status
- active listings and store activity
- ministry trends and church activity

2. Members
The members module manages the full church membership database.

Includes:
- member registration and records
- search and filtering
- status management
- department assignments
- profile details and verification
- member number generation
- credential setup and PIN management
- avatar upload and profile creation
- storefront identity creation
- promotion to staff or leadership roles

3. Attendance
The attendance module records both service-level and member-level participation.

Includes:
- attendance records by service type
- total attendance and demographic summaries
- visitor counts
- check-in tracking for members
- reporting and trend visibility
- personal attendance history for members

4. Finance
The finance module covers stewardship and church accounting.

Includes:
- giving records for tithe, offering, thanksgiving, mission, building fund, and more
- expense tracking and approvals
- payment method recording
- member-linked giving data
- summary dashboards and trends
- finance user restrictions and review flow

5. Events and Announcements
The church can share important updates, events, and notices.

Includes:
- event creation and publishing
- event categories and schedule management
- announcement posting and pinning
- audience targeting and department-specific communication
- edit and deletion workflows
- public visibility to visitors and members

6. Departments and Ministry Structures
Departments support church organizational flow.

Includes:
- department creation and management
- leaders and responsibilities
- member assignment
- ministry posts and updates
- cross-ministry communication flow

7. Pastoral Care
Pastoral care is a dedicated ministry support module.

Includes:
- prayer requests
- anonymous prayer submission
- follow-up management
- welfare cases
- cell group management
- assignment tracking
- pastoral care dashboards and reporting

8. Church Life and Content
This area covers day-to-day church content publishing.

Includes:
- sermons
- daily devotionals
- Sunday bulletins
- church feed posts
- reactions and engagement
- growth tracking
- birthdays and milestones
- WhatsApp support workflows
- public church content experiences

9. Notifications
The notification system keeps the congregation and staff informed.

Includes:
- personal and church-wide messaging
- unread counts
- read actions
- device registration
- browser push support
- Firebase Cloud Messaging integration
- PWA notification support

10. Marketplace
The marketplace connects church members to economic activity and community engagement.

Buyer-side features:
- browse listings
- category and search filtering
- listing detail pages
- seller profiles and reviews
- cart and ordering flow
- chat with sellers
- storefront browsing

Seller-side features:
- list products and services
- manage images and pricing
- review orders and messages
- maintain storefront identity
- approve and manage marketplace activity

11. Public Church Experience
This layer helps churches attract visitors and present their brand online.

Includes:
- public church profile
- visit page
- event visibility
- church description and ministry overview
- member storefront discovery
- public join requests

12. Super Admin Portal
The platform layer provides management for multiple church tenants.

Includes:
- church list and detail views
- platform monitoring
- registration review
- tenant approval and deactivation flows
- status and subscription management
- notification and audit oversight


USER ROLES AND ACCESS
---------------------

The system supports multiple relationship types:

Super Admin
- manages the full platform
- controls tenants and registration flow
- reviews church health and activity

Church Administrator
- manages church configuration and user operations
- coordinates value-heavy workflows

Pastor / Leadership
- oversees ministry operations and content
- manages announcements, departments, and reports

Finance User
- monitors giving and expenses
- reviews financial records and summaries

Department Leader / Staff
- works on ministry-specific workflows and communication

Member
- accesses their profile, attendance, pastoral tools, and storefront
- participates in the church community and marketplace

Role-based access is enforced to prevent cross-tenant data leakage.


AUTHENTICATION AND SECURITY
---------------------------

The platform uses layered security for tenant-aware access.

Includes:
- JWT-based authentication
- church-specific tenant resolution
- member and staff account separation
- production host and localhost tenant detection
- church mismatch protection
- role-based authorization
- secure upload handling
- audit recording for sensitive activity
- CORS and security headers


DEPLOYMENT AND OPERATIONS
-------------------------

The repository is structured for real deployment and operational use.

Operational support includes:
- PM2 process management
- Nginx hosting and reverse proxy support
- HTTPS-ready deployment patterns
- health endpoints for monitoring
- upload directory support
- environment-based configuration
- tenant host routing
- scripts for setup, repair, and migrations


SETUP SUMMARY
-------------

Typical setup flow:
1. Create the PostgreSQL database
2. Run database schema and seed scripts
3. Configure environment variables
4. Install backend dependencies
5. Start the API server
6. Install frontend dependencies
7. Start the frontend app
8. Sign in through demo credentials or create a church admin flow


DEMO USAGE
----------

The project includes demo churches and sample users for local testing. Common examples include:
- pastor@pka.com / password123
- finance@pka.com / password123
- admin@pka.com / password123
- pastor@grace.com / password123
- pastor@livingword.com / password123

These demo accounts are grouped under different church tenants and showcase the multi-tenant church environment.


WHY THIS SYSTEM IS POWERFUL
---------------------------

ChristNerve is powerful because it combines all the major parts of a modern church ecosystem into one coordinated platform:
- administrative control
- member care
- ministry communication
- live worship and digital engagement
- giving and stewardship
- business enablement for church members
- public community visibility
- tenant-scale operations for many churches

This makes it far more than a church website. It is a church operating platform, a ministry engagement system, and a digital member ecosystem.


FINAL SUMMARY
-------------

ChristNerve is a comprehensive digital platform for churches that want to organize ministry, support members, expand outreach, and create a modern church experience online. It includes a full church management dashboard, member registry, attendance, finance, announcements, pastoral care, content publishing, live rooms, livestream support, public church pages, and a member marketplace.

The live room and livestream capabilities are built into the platform’s broader church communication architecture, making it ready for online services, virtual teaching, ministry meetings, prayer gatherings, and live digital engagement.

This project is designed as a real, feature-rich church operating system, not just a demo or landing page.

END OF README
-------------
