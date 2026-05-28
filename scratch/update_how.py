import re

file_path = r"HOW-PROPOSAL.md"

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

variant_a = """**Variant A: First-Time TM1 User (Finalized & Aligned)**

| # | Question |
|---|---|
| 1 | **Context:** Why did you contact us? What do you hope to achieve? |
| 2 | **Context:** Why do you think you need TM1? |
| 3 | **Context:** Is this for a single department or across the company? |
| 4 | **Context:** What will you primarily use TM1 for? |
| 5 | **Context:** What application would you like TM1 to replace? |
| 6 | **Context:** How are you currently managing budgeting and forecasting? |
| 7 | **Context:** How many people are involved in the planning process? |
| 8 | **Context:** How long does your budgeting or forecasting cycle typically take? |
| 9 | **Context:** What is the most frustrating part of your current process? |
| 10 | **Context:** How confident are you in the numbers you are producing? |
| 11 | **Project:** What does success look like for this project? |
| 12 | **Project:** Do you have a target completion date? |
| 13 | **Project:** Does your firm have a policy on cloud or on-premise? |
| 14 | **Project:** What is the minimum you need TM1 to do? |
| 15 | **Project:** What are the nice-to-have functions that can be added later? |
| 16 | **Project:** Who will support TM1 after handover — IT or finance? |
| 17 | **Project:** Who are the project stakeholders? First names and titles will do. |
| 18 | **Planning:** What are the busiest times of year we should plan around? |
| 19 | **Planning:** Can you share a requirements document? |
| 20 | **Planning:** What budget range do you have in mind? |
| 21 | **Planning:** How many data sources need to integrate with TM1 eg ERP, ledgers, databases? Are they cloud or on-premise, and will any new ones need to be added? |
| 22 | **Planning:** Are data reconciliation and load processes manual or automated? |
| 23 | **Licenses:** How many TM1 licenses will you need? |
| 24 | **Licenses:** How many will be admin licenses? |
| 25 | **Licenses:** Do you expect to need more licenses over time? |
| 26 | **Licenses:** Do you have casual users who only log in once a year? |
| 27 | **Reports:** Do you use any reporting tools against TM1 data eg Power BI? |
| 28 | **Reports:** How many reports need to be built? |
| 29 | **Reports:** Will you report using cube views, PAX or PAW? |
| 30 | **Reports:** Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below. |
| 31 | **Excel:** What are the manual data reconciliation processes? |
| 32 | **Excel:** Are data load and mapping processes manual or automated? |
| 33 | **Excel:** What are the most complicated Excel computations? Please describe the logic and paste screenshots below. |
| 34 | **Excel:** How much of what you need from TM1 is already being done in Excel today? |
| 35 | **Excel:** Do users contribute data directly? If yes, please paste screenshots of the input templates below. |
| 36 | **Anaplan:** Which business processes are covered eg budgeting, forecasting, workforce planning, sales planning? |
| 37 | **Anaplan:** How many models do you have and how many users interact with them? |
| 38 | **Anaplan:** How is data loaded into Anaplan — manually, via CloudWorks, Anaplan Connect, or API? |
| 39 | **Anaplan:** What source systems feed data into Anaplan eg ERP, CRM, HR? |
| 40 | **Anaplan:** How do users interact with the model — via dashboards, NUX pages, or Excel? |
| 41 | **Anaplan:** Do users contribute data directly, or is the model read-only for most? |
| 42 | **Jedox:** Which business processes are covered eg budgeting, forecasting, consolidation, reporting? |
| 43 | **Jedox:** Is Jedox deployed on-premise or cloud? |
| 44 | **Jedox:** How is data loaded into Jedox — via ETL integrator, scripts, or manually? |
| 45 | **Jedox:** What source systems feed data into Jedox eg SAP, ERP, databases? |
| 46 | **Jedox:** Do users interact via Excel reports, Jedox Web, or both? |
| 47 | **Jedox:** Do users contribute data directly via input templates? |"""

variant_b = """**Variant B: Existing TM1 User (Finalized & Aligned)**

| # | Question |
|---|---|
| 1 | **Context:** Why did you contact us? What do you hope to achieve? |
| 2 | **Context:** How long have you been using TM1? |
| 3 | **Context:** What do you primarily use TM1 for? |
| 4 | **Context:** Where does it fall short — including performance, speed, or usability issues? |
| 5 | **Context:** Is TM1 used across the business or only within finance? |
| 6 | **Context:** Have users adopted TM1 or do they resort to Excel? |
| 7 | **Context:** Is it difficult to make enhancements? Who makes them? |
| 8 | **Context:** Is the instance cloud or on-premise? |
| 9 | **Project:** What does success look like for this project? |
| 10 | **Project:** Do you have a target completion date? |
| 11 | **Project:** Does your firm have a policy on cloud or on-premise? |
| 12 | **Project:** What is the minimum you need TM1 to do? |
| 13 | **Project:** What are the nice-to-have functions that can be added later? |
| 14 | **Project:** How long ago did users receive training? |
| 15 | **Project:** Who are the project stakeholders? First names and titles will do. |
| 16 | **Planning:** What are the busiest times of year we should plan around? |
| 17 | **Planning:** Can you share a requirements document? |
| 18 | **Planning:** What budget range do you have in mind? |
| 19 | **Planning:** How many data sources does TM1 integrate with eg ERP, ledgers, databases? Are they cloud or on-premise? |
| 20 | **Planning:** Will any new data sources need to be added? |
| 21 | **Planning:** Are data reconciliation and load processes manual or automated? |
| 22 | **Planning:** Are you using PAW, Perspectives, Excel, or a combination? |
| 23 | **Licenses:** How many TM1 licenses do you have? |
| 24 | **Licenses:** How many are admin licenses? |
| 25 | **Licenses:** Do you expect to need more licenses? |
| 26 | **Licenses:** Do you have casual users who only log in once a year? |
| 27 | **Licenses:** What is the license renewal date? We may be able to get you a better rate. |
| 28 | **Licenses:** Were the licenses purchased directly from IBM or via a third party? |
| 29 | **Reports:** Do you use any reporting tools against TM1 data eg Power BI? |
| 30 | **Reports:** How many reports need to be built? |
| 31 | **Reports:** Will you report using cube views, PAX or PAW? |
| 32 | **Reports:** Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below. |
| 33 | **Technical:** How many developers have worked on TM1 since it was set up? |
| 34 | **Technical:** How many cubes are in TM1? |
| 35 | **Technical:** How many reports are in TM1? |
| 36 | **Technical:** How many security groups do you have? |
| 37 | **Technical:** What are the log file sizes? |
| 38 | **Technical:** How much memory does TM1 use in total? |
| 39 | **Technical:** How much memory do the feeders use? |
| 40 | **On-premise:** Do you need a like-for-like migration or are you building from scratch? |
| 41 | **On-premise:** What is the server RAM size? |
| 42 | **On-premise:** What is the server hard disk size? |
| 43 | **On-premise:** What version of TM1 are you using? |
| 44 | **On-premise:** Is there a prod and dev server? |
| 45 | **On-premise:** How many instances of TM1 do you have? |
| 46 | **On-premise:** Do any Excel reports use Action Buttons? |
| 47 | **On-premise:** Do you use TM1 Web? If yes, how many Excel reports are published to it? |"""

new_text = re.sub(r'\*\*Variant A: First-Time TM1 User \(Finalized \& Aligned\)\*\*.*?\| 12 \| What does success look like, and would a 60-day trial of connectors \(like DataFusion\) or a free Proof of Concept \(POC\) help validate the solution\? \|', variant_a, text, flags=re.DOTALL)
new_text = re.sub(r'\*\*Variant B: Existing TM1 User \(Finalized \& Aligned\)\*\*.*?\| 12 \| Who has final authority to approve support changes, and what is the timeline to transition support \(e\.g\. target date like October 31\)\? \|', variant_b, new_text, flags=re.DOTALL)
new_text = re.sub(r'\*\*Variant C: First-Time AI User \(Finalized \& Aligned\)\*\*.*?\| 12 \| What is your timeline for starting an AI pilot, and who are the key executive stakeholders involved\? \|', '', new_text, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Updated HOW-PROPOSAL.md")
