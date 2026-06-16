# Complementary Reporting Applications Playbook - Microsoft Power BI Integration

This playbook details the technical protocols, connection methods, and mapping optimization constraints when connecting Microsoft Power BI to IBM Planning Analytics (TM1).

## 1. Core Connection Pathways

### Specialized Third-Party Connectors
- Cubewise PowerConnect:
  * A purpose-built connector that directly queries TM1 cubes using the TM1 REST API.
  * It maps TM1 structures (cubes, dimensions, and hierarchies) and preserves TM1's cell-level and dimensional security groups automatically.
- TM1 Connect:
  * A commercial utility that acts as an ODBC/OData bridge.
  * It maps multidimensional OLAP cubes to tabular relations and features a "Smart Cache" layer to prevent direct query load on the TM1 engine.
- TMVGate (ITLink):
  * Generates secure Web URLs mapping to TM1 cube views, which Power BI consumes via its standard Web data connector. It streams data in JSON/CSV formats.

### Custom Python Scripting (TM1py)
- Implementation:
  1. Install Python and the TM1py library on the reporting machine or Gateway server.
  2. Write a Python script using TM1py to connect to the TM1 REST API and execute MDX queries or pull views.
  3. Load the data using Power BI's "Python script" data source.
  4. The script outputs a flattened pandas DataFrame, which Power BI maps to a relational table.

## 2. Technical Mapping & Performance Rules
- OLAP-to-Relational Flattening: TM1 cubes are multidimensional (OLAP), whereas Power BI operates on relational tables. The MDX queries must be structured to return unpivoted, flat tabular outputs.
- Ragged Hierarchies: TM1 allows child-parent relationships of varying depths. Power BI requires flattening these hierarchies into fixed-column tables to avoid visualization failures.
- Caching: Avoid DirectQuery modes. Scheduled refreshes (Import Mode) should be configured during off-peak hours to protect TM1 server CPU cycles.
- Security Alignment: TM1 cell-level security rules do not carry over to Power BI natively. You must manually replicate user-level filters using Power BI Row-Level Security (RLS).

## 3. Primary References and Sources
- Microsoft Power BI Desktop Data Sources (learn.microsoft.com)
- Cubewise PowerConnect Technical Specifications (cubewise.com)
- TM1 Connect Integration Manual (tm1connect.com)
- TMVGate Connector Documentation (itlink.com.sg)
