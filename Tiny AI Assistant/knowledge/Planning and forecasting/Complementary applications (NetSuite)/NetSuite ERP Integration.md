# Complementary Applications Playbook - NetSuite ERP Integration

This playbook outlines the technical protocols, data flows, and architectural conventions for connecting NetSuite ERP with IBM Planning Analytics (TM1).

## 1. Core Integration Methods

### SuiteAnalytics Connect (ODBC / JDBC)
- Target Use Case: Pulling high-volume transactional ledger and General Ledger actuals directly into TM1.
- Implementation:
  1. Enable the "SuiteAnalytics Connect" service in the NetSuite account settings.
  2. Install the NetSuite ODBC or JDBC driver on the TM1 server.
  3. Configure a System DSN mapping to NetSuite's database connection.
  4. Write TM1 TurboIntegrator (TI) processes using standard SQL queries to extract actuals.
- Optimization Rule: To prevent transaction table locking on NetSuite, direct ODBC queries should target NetSuite's analytics warehouse or read-only data views rather than live operational tables.

### SuiteTalk REST API (Programmatic Integration)
- Target Use Case: Real-time metadata synchronization (accounts, custom segments) and event-driven updates.
- Implementation:
  1. NetSuite's REST API allows running SuiteQL queries programmatically via JSON payloads.
  2. Implement Python scripts using the TM1py library to fetch JSON transaction records.
  3. The script authenticates with NetSuite using Token-Based Authentication (TBA) or OAuth 2.0 to bypass password expiry limits.
  4. TM1py maps the JSON records into pandas DataFrames and writes them directly to TM1 cubes via the TM1 REST API.

## 2. Decoupled Data Warehouse Architecture (Best Practice)
- High-volume enterprises decouple NetSuite from TM1 by introducing a middle-tier data warehouse (e.g., Snowflake, SQL Server, Google BigQuery).
- NetSuite extracts data to the warehouse using pipelines like Celigo or Fivetran, and TM1 TI processes ingest data from the warehouse, eliminating API concurrency bottlenecks.

## 3. Reference Sources
- NetSuite SuiteAnalytics Connect Guide (netsuite.com)
- SuiteTalk REST Web Services Integration Guide (netsuite.com)
- TM1py Python REST API automation documentation (github.com/cubewise/tm1py)
- Celigo NetSuite Integration Specs (celigo.com)
