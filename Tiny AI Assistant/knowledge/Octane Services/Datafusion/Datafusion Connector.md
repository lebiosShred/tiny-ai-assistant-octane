# Datafusion TM1-to-Power BI Connector Playbook

Datafusion is a lightweight, low-code connector designed to stream TM1 data directly into Power BI, Qlik, and Tableau without the need for manual CSV exports or intermediate databases.

## Key Technical Features
* Zero TM1 Development: Requires no modification of the underlying TM1 database structure.
* Direct Piping: Streams data discretely from TM1 to the reporting tool in real-time. No customer data is stored on third-party servers.
* Lightweight Footprint: App takes up less than 100MB on the local server hosting the TM1 instance.
* Operating System Support: Compatible with all active versions of Windows Server.
* Cloud & On-Premises: Works across both on-premises TM1 and TM1 Cloud deployments.

## Installation and Synchronization Workflow
1. Download App: Users download and run a Windows-based application on their local server.
2. Generate Connection Links: Users open the application, key in credentials, select a specific dataset or metadata, and click to generate a secure link.
3. Link Power BI: Users copy and paste the link code into Power BI.
4. Auto-Library: Power BI stores a library of these links so the configuration only needs to be completed once.
5. Scheduled Syncs: Users schedule updates or trigger them manually from within Power BI.

## Pricing and Licensing
* Unlimited Users: No seat limits.
* Unlimited Data & Links: No data throughput limits.
* Unlimited Servers: Works across dev, staging, prod, and local environments.
* Trial Version: Free 60-day trial (setup completed in a 1-hour online session).
* Subscriptions: Available on monthly or annual contracts (annual billing offers a 16% discount).
