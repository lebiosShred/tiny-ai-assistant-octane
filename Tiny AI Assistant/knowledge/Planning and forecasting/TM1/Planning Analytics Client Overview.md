# IBM Planning Analytics (TM1) Playbook

This document captures the enterprise value, architecture, and deployment options for IBM Planning Analytics (powered by TM1 technology).

## 1. Product Core & Architecture
- Multidimensional Engine: Powered by the in-memory TM1 write-back engine. It enables fast, secure, and flexible modeling of complex datasets.
- User Interfaces:
  * Planning Analytics Workspace (PAW): Web-based portal providing dashboarding, visual analysis, and administrative controls.
  * Planning Analytics for Excel (PAfE): Excel add-in delivering direct connection to governed TM1 cubes.
  * Planning Analytics Assistant: Web-based generative AI advisor powered by watsonx.

## 2. Key Capabilities & AI Features
- Multivariate AI Forecasting: Uncovers relationships between complex variables (e.g., supply chain production volume vs. inventory cost). Enables what-if scenario simulations.
- Watsonx Generative AI Features:
  * Chart Insights: Natural language summaries highlighting patterns and takeaways.
  * Explain Cell: Traces cell values and provides verbal explanations of data origins.
  * Outlier Analysis: Automatically detects data anomalies and reports them in plain language.
  * Impact Analysis: Highlights dependencies driving performance metrics.
  * Recommend a View: Speeds up data search.
- Agentic AI Automations: Enables automated month-end consolidation, processing of unstructured data, and compliance checks.

## 3. Client Outcomes & Target Metrics
- Volkswagen Group Services: Reduced monthly reporting time from 7 days to a few seconds. Improved productivity by 85%.
- Novolex: Improved inventory position by 16% in the first year. Completed supply chain forecasts 83% faster.
- RIU: Reduced budgeting and consolidation time by 70%. Eliminated hundreds of hours of manual spreadsheet edits.
- SolarBR (Coca-Cola): Decreased modeling time by 25%. Increased reporting output 10x with zero headcount increase.
- Primark: Integrated retail processes across 480+ stores in 18 markets, accelerating period-end close.

## 4. Deployment Flexibility
- Fully Managed SaaS: Runs as a managed service on AWS and Microsoft Azure. Available in Essentials, Standard, and Premium tiers.
- Containerized (Cartridge): Deployed on IBM Cloud Pak for Data or in hybrid environments.
- On-Premises: Deployed locally on Windows or Linux servers.
