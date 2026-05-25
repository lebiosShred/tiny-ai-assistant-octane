import json

with open('scratch/customer_profiles_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

markdown = """# Octane Software Solutions - Target Customer Profiles & Segment Playbook

This playbook contains the official list of target customer profiles and historical clients that Octane Software Solutions serves, mapped to their respective industries, pain points, and products in use. Use this data to qualify prospects and determine the most relevant services (Octane Black, Octane Blue, DataFusion, watsonx AI Pilots) to recommend.

---

## 1. Core Buyer Segments (Who We Serve Today)

| Segment Name | Typical Title | Key Pain Points | Recommended Octane Product/Service |
| :--- | :--- | :--- | :--- |
| **Large TM1 Shops** (e.g. Macquarie, Westpac) | System Owner or IT | Cost of resource, Accessing quality resource, Stuck with inflexible vendors, Internal resources are not that skilled, Support and Development maturity, growing pains | **Octane Black** (Full support, onshore/offshore, for 200+ user scales) |
| **Mid Size TM1 Shops** (e.g. NewsCorp) | CFO or Head of FP&A | High cost of support, backlog of projects, Support is ad hoc, In-house resource drives the agenda, not modern setup | **Octane Blue** (DevOps Support) with roadmap to expand to licenses |
| **Small TM1 Shops** (e.g. Shift) | CFO or Head of FP&A | High cost of support, backlog of projects, Support is ad hoc, In-house resource drives the agenda | **Octane Blue** (DevOps Support) |
| **TM1 Shops still On-Premise** | CFO or Head of FP&A | Legacy Perspectives/Excel dependencies, migration risk, outdated infrastructure | **TM1 Modernisation Play** (Cloud/PA migration) |
| **New TM1 Supply Chain Prospects** | CFO or Head of Supply Chain | Manual Excel demand planning, inventory planning, disconnected supply & demand, unable to scale, reconciliation issues | **Custom Supply Chain Model** (Accelerated development using Octane's template) |
| **New TM1 FP&A Prospects** | CFO or Head of FP&A | Manual budgeting/forecasting, slow insights, looking to move to FP&A platform, turnover >$50M | **IBM Planning Analytics (TM1)** |
| **Enterprise AI in Finance (Large)** (e.g. NewsCorp, Macquarie) | CFO | Slow month-end close (5+ days), manual reporting, drowning in repetitive queries, no ROI visibility, turnover >$500M | **Octane Finance Agent + FastClose** |
| **MidMarket AI in Finance** (e.g. Rinnai, Shift) | CFO | Month-end reporting is manual/slow, CFO chashing data, no self-serve reporting, board packs take too long, struggling to hire, turnover $100M-$500M | **FastClose** entry point, then upsell to **Finance Agent** |
| **IBM PA + AI Upgrade** (Existing TM1 Shops) | CFO, System Owner, Head of FP&A | TM1 not delivering AI-powered insights, investment underutilized, competitor pressure, manual reporting | **Finance Agent** on top of existing Planning Analytics |

---

## 2. Historical & Active Client Profiles (Sheila's Reference Data)

Use these real-world examples to build credibility and reference relevant stories during the call.

### 2.1 Steric
* **Sector / Industry:** Healthcare & Life Sciences / Sterilisation & Infection Prevention
* **Key Contact:** Deanna Chapman
* **Data Points:** Growing operational support requirements, need for reliable TM1 administration and continuous optimisation.
* **Pain Points:** Limited in-house TM1 bandwidth, support responsiveness, ongoing maintenance and enhancement management.
* **Product in Use:** **Octane Blue**

### 2.2 GreyOrange
* **Sector / Industry:** Technology & Automation / Robotics & Supply Chain Automation
* **Key Contact:** Nageswara Reddy Kondreddy (Partner)
* **Data Points:** Enterprise planning support requirements across automation operations in APAC.
* **Pain Points:** Need for stable analytics support, faster issue resolution, maintaining planning system performance.
* **Product in Use:** **Octane Blue Support**

### 2.3 Iqony / STEAG
* **Sector / Industry:** Energy & Utilities / Renewable Energy & Industrial Services
* **Key Contact:** Carola Jochheim
* **Data Points:** Existing DataFusion customer renewing annual subscription (Germany / APAC).
* **Pain Points:** Data integration complexity, maintaining seamless connectivity between source ERP systems and Planning Analytics.
* **Product in Use:** **DataFusion**

### 2.4 Shift
* **Sector / Industry:** Financial Services / Automotive Finance & FinTech
* **Key Contact:** Alvin Ah-Chok
* **Data Points:** Scaling planning processes, ongoing TM1 operational support, enterprise planning transformation initiative.
* **Pain Points:** Spreadsheet dependency, slow planning cycles, manual forecasting, need for faster FP&A cycles.
* **Product in Use:** **Octane Blue** & **IBM Planning Analytics**

### 2.5 mycar
* **Sector / Industry:** Retail & Automotive Services / Automotive Servicing & Retail
* **Key Contact:** Olivia McKellar / Vicki Carline
* **Data Points:** Infrastructure expansion, migration from TM1 to IBM Planning Analytics platform.
* **Pain Points:** Legacy TM1 environment limitations, performance bottlenecks, memory limitations, increasing planning model complexity, upgrade requirements.
* **Product in Use:** **Additional RAM / Infrastructure Upgrade** & **IBM Planning Analytics Upgrade**

### 2.6 McPherson’s
* **Sector / Industry:** Consumer Goods / Health, Beauty & Consumer Products
* **Key Contact:** Will Clemente
* **Data Points:** Large-scale analytics transformation and planning modernisation initiative.
* **Pain Points:** Legacy reporting limitations, disconnected planning processes, need for modern FP&A capabilities.
* **Product in Use:** **IBM Planning Analytics**

### 2.7 News Corp Australia
* **Sector / Industry:** Media & Entertainment / Publishing & Digital Media
* **Key Contact:** Ritwik Deo
* **Data Points:** Existing TeamOne environment renewal and platform continuity.
* **Pain Points:** User adoption, collaboration inefficiencies, maintaining enterprise reporting continuity.
* **Product in Use:** **TeamOne Renewal**

### 2.8 Fintechs (Accounts Payable Pain Point)
* **Sector / Industry:** Fintech / Payments (AU / NZ)
* **Typical Title:** CFO / Financial Controller
* **Segment Criteria:** Operating 3+ years, CFO present, $10M+ annual revenue, raised Series C, using Excel or TM1.
* **Scenario A (Accounts Payable Volume):**
  * **Pain Points:** Dealing with too many transactions in accounts payable.
  * **Recommended Product:** **TM1**
* **Scenario B (Hiring AP Staff):**
  * **Pain Points:** Tried to hire accounts payable staff in the last 3 months and can't find people.
  * **Recommended Product:** **AI Assistants**
"""

with open('knowledge/customer_profiles.md', 'w', encoding='utf-8') as f:
    f.write(markdown.strip())

print("Playbook generated successfully.")
