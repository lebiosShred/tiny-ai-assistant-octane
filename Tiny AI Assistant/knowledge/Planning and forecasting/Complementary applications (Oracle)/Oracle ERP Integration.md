# Complementary Applications Playbook - Oracle ERP Integration

This playbook outlines the technical protocols, data flows, and architectural conventions for connecting Oracle ERP with IBM Planning Analytics (TM1).

## 1. Data Flow Directions & Integration Protocols

### Inbound Integration (TM1 Scenario Forecasts to Oracle General Ledger)
- High-Volume Journal Loads (FBDI): There is no dedicated high-volume "Create Journal" REST API in Oracle Cloud ERP. High-volume transfers must use File-Based Data Import (FBDI).
  1. The TM1 TurboIntegrator (TI) process exports planning scenarios to a formatted FBDI CSV file, zipped with a metadata manifest.
  2. The ZIP file is uploaded to the Oracle Universal Content Manager (UCM) using the "erpintegrations" REST API endpoint.
  3. The "Import Journals" Enterprise Scheduler Service (ESS) job is triggered via the "erpintegrations" REST API to load the data into the GL interface tables and post them to the ledger.
- Low-Volume or Real-Time Journal Loads (SOAP): For real-time allocations or low-volume write-backs, TM1 can call the "JournalImportService" SOAP Web Service to submit journals directly to the GL_INTERFACE tables.

### Outbound Integration (Oracle GL Actuals to TM1 Cubes)
- Bulk Ledger Exports (BICC): The BI Cloud Connector (BICC) is the enterprise standard for bulk extraction. BICC extracts GL transactions to OCI Object Storage or AWS S3 in CSV format, which TM1 TI then retrieves.
- Scheduled Report Delivery (OTBI / BI Publisher): Schedule BI Publisher reports to extract journal details as CSV files and deliver them via SFTP. A TM1 TI process is scheduled to ingest these CSV files from the SFTP directory.
- Standard REST APIs: Oracle Financials Cloud REST APIs are used only for low-volume metadata synchronization (such as cost centers or account segment changes) or transaction-specific drill-through lookups.

## 2. Secure Hybrid Cloud Architecture
- Planning Analytics Agent: For IBM Planning Analytics Cloud instances, connecting to on-premises Oracle databases requires the installation of the Planning Analytics Agent on the local server hosting Oracle.
- The Agent establishes an outbound TLS-encrypted tunnel, allowing TM1 to run SQL queries via ODBC against the Oracle database without opening inbound ports in the corporate firewall.

## 3. Reference Sources
- Oracle Cloud Financials Integration Services Guide (docs.oracle.com)
- IBM Planning Analytics Cloud Connectivity and Secure Gateways (ibm.com/docs)
- TM1py Python REST API automation documentation (github.com/cubewise/tm1py)
- Oracle A-Team Integration Patterns (ateam-oracle.com)
