# Complementary Applications Playbook - Tableau Visualization Integration

This playbook details the technical protocols, connection methods, and performance optimization rules when connecting Tableau to IBM Planning Analytics (TM1).

## 1. Core Integration Methods

### Scheduled ETL & Staging Database (Industry Standard for Performance)
- Target Use Case: Large datasets, corporate reporting dashboards, and high-frequency queries.
- Implementation:
  1. Write a TM1 TurboIntegrator (TI) process to export consolidated cube views.
  2. Staging Database: The TI process writes the exported data to an intermediate relational database (e.g., SQL Server or Oracle) or flat CSV files.
  3. Tableau connects directly to this staging database or reads the flat files.
- Benefit: This decouples Tableau from the active TM1 calculation engine, preventing performance issues on the TM1 server during dashboard refreshes.

### Tableau Hyper API & TM1py (Automated Extract Generation)
- Target Use Case: Low-latency, high-performance Tableau dashboards.
- Implementation:
  1. A scheduled Python script connects to the TM1 REST API via the TM1py library.
  2. The script extracts cell data from a TM1 view into a pandas DataFrame using the `execute_view_dataframe` method.
  3. The Tableau Hyper API (or the `pantab` library) converts the DataFrame directly into a `.hyper` extract file.
  4. The Python script uploads and publishes the `.hyper` extract to Tableau Server or Tableau Cloud using the Tableau Server Client (TSC) API.

### Specialized Connectors
- TM1Connect:
  * A utility that acts as an ODBC-compliant server.
  * It translates TM1's multidimensional cubes and dimensions into flat relational tables, enabling Tableau to issue standard SQL-like queries directly against TM1 views.

## 2. Optimization Rules & Security
- Avoid Live Connections: Connecting Tableau live to large multidimensional cubes can cause slow rendering and high CPU load on the TM1 server. Use Tableau Data Extracts (TDE/Hyper) scheduled for off-peak hours.
- Flat Data Mapping: Multidimensional parent-child hierarchies must be flattened into structured columns before Tableau ingestion.
- Security Integration: TM1's security profiles do not carry over to Tableau automatically. Replicate security restrictions inside Tableau worksheets or apply manual row filters to match TM1 permissions.

## 3. Primary References and Sources
- Tableau Hyper API Developer Guide (tableau.com)
- Tableau Server Client (TSC) Library (github.com/tableau/server-client-python)
- TM1Connect Technical Specifications (tm1connect.com)
- TM1py Python REST API automation documentation (github.com/cubewise/tm1py)
