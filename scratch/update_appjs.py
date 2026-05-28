import re

app_path = r"demo/app.js"

with open(app_path, 'r', encoding='utf-8') as f:
    app_code = f.read()

new_battlecards = """const BATTLECARDS = {
        A: [
            {q: "Why did you contact us? What do you hope to achieve?", tip: "Understand the main driving force."},
            {q: "Why do you think you need TM1?", tip: "Validate TM1 as the correct solution."},
            {q: "Is this for a single department or across the company?", tip: "Gauge project scope."},
            {q: "What will you primarily use TM1 for?", tip: "Core use-case definition."},
            {q: "What application would you like TM1 to replace?", tip: "Identify current legacy system."},
            {q: "How are you currently managing budgeting and forecasting?", tip: "Find manual pain points."},
            {q: "How many people are involved in the planning process?", tip: "Estimate license requirements."},
            {q: "How long does your budgeting or forecasting cycle typically take?", tip: "Time-saving ROI."},
            {q: "What is the most frustrating part of your current process?", tip: "Emphasize pain points."},
            {q: "How confident are you in the numbers you are producing?", tip: "Highlight data integrity risks."},
            {q: "What does success look like for this project?", tip: "Define success criteria."},
            {q: "Do you have a target completion date?", tip: "Timeline constraints."},
            {q: "Does your firm have a policy on cloud or on-premise?", tip: "Deployment environment."},
            {q: "What is the minimum you need TM1 to do?", tip: "Define MVP scope."},
            {q: "What are the nice-to-have functions that can be added later?", tip: "Phase 2 scope."},
            {q: "Who will support TM1 after handover — IT or finance?", tip: "Post-go-live ownership."},
            {q: "Who are the project stakeholders? First names and titles will do.", tip: "Identify decision makers."},
            {q: "What are the busiest times of year we should plan around?", tip: "Avoid deployment conflicts."},
            {q: "Can you share a requirements document?", tip: "Expedite scoping."},
            {q: "What budget range do you have in mind?", tip: "Qualify financial capacity."},
            {q: "How many data sources need to integrate with TM1 eg ERP, ledgers, databases? Are they cloud or on-premise, and will any new ones need to be added?", tip: "Data integration complexity."},
            {q: "Are data reconciliation and load processes manual or automated?", tip: "Pitch DataFusion if manual."},
            {q: "How many TM1 licenses will you need?", tip: "Seat count estimation."},
            {q: "How many will be admin licenses?", tip: "Admin ratio."},
            {q: "Do you expect to need more licenses over time?", tip: "Growth trajectory."},
            {q: "Do you have casual users who only log in once a year?", tip: "Differentiate user types."},
            {q: "Do you use any reporting tools against TM1 data eg Power BI?", tip: "BI integration needs."},
            {q: "How many reports need to be built?", tip: "Delivery scope."},
            {q: "Will you report using cube views, PAX or PAW?", tip: "UI preferences."},
            {q: "Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below.", tip: "Dashboard complexity."},
            {q: "What are the manual data reconciliation processes?", tip: "Automatable tasks."},
            {q: "Are data load and mapping processes manual or automated?", tip: "Identify ETL gaps."},
            {q: "What are the most complicated Excel computations? Please describe the logic and paste screenshots below.", tip: "Rule complexity."},
            {q: "How much of what you need from TM1 is already being done in Excel today?", tip: "Current Excel footprint."},
            {q: "Do users contribute data directly? If yes, please paste screenshots of the input templates below.", tip: "Write-back requirements."},
            {q: "Which business processes are covered eg budgeting, forecasting, workforce planning, sales planning? (Anaplan)", tip: "Current Anaplan footprint."},
            {q: "How many models do you have and how many users interact with them? (Anaplan)", tip: "Model scale."},
            {q: "How is data loaded into Anaplan — manually, via CloudWorks, Anaplan Connect, or API?", tip: "Migration approach."},
            {q: "What source systems feed data into Anaplan eg ERP, CRM, HR?", tip: "Integrations."},
            {q: "How do users interact with the model — via dashboards, NUX pages, or Excel? (Anaplan)", tip: "UI translation."},
            {q: "Do users contribute data directly, or is the model read-only for most? (Anaplan)", tip: "Write-back vs Reporting."},
            {q: "Which business processes are covered eg budgeting, forecasting, consolidation, reporting? (Jedox)", tip: "Jedox footprint."},
            {q: "Is Jedox deployed on-premise or cloud?", tip: "Hosting."},
            {q: "How is data loaded into Jedox — via ETL integrator, scripts, or manually?", tip: "Data pipelines."},
            {q: "What source systems feed data into Jedox eg SAP, ERP, databases?", tip: "Source mapping."},
            {q: "Do users interact via Excel reports, Jedox Web, or both?", tip: "End-user experience."},
            {q: "Do users contribute data directly via input templates? (Jedox)", tip: "Write-back needs."}
        ],
        B: [
            {q: "Why did you contact us? What do you hope to achieve?", tip: "Understand primary goal."},
            {q: "How long have you been using TM1?", tip: "Legacy vs fresh deployment."},
            {q: "What do you primarily use TM1 for?", tip: "Core business function."},
            {q: "Where does it fall short — including performance, speed, or usability issues?", tip: "Identify pain points."},
            {q: "Is TM1 used across the business or only within finance?", tip: "Determine enterprise spread."},
            {q: "Have users adopted TM1 or do they resort to Excel?", tip: "Adoption issues."},
            {q: "Is it difficult to make enhancements? Who makes them?", tip: "Identify internal capability gaps."},
            {q: "Is the instance cloud or on-premise?", tip: "Hosting environment."},
            {q: "What does success look like for this project?", tip: "Success criteria."},
            {q: "Do you have a target completion date?", tip: "Timeline."},
            {q: "Does your firm have a policy on cloud or on-premise?", tip: "Deployment restrictions."},
            {q: "What is the minimum you need TM1 to do?", tip: "MVP Scope."},
            {q: "What are the nice-to-have functions that can be added later?", tip: "Phase 2."},
            {q: "How long ago did users receive training?", tip: "Pitch training courses."},
            {q: "Who are the project stakeholders? First names and titles will do.", tip: "Stakeholder mapping."},
            {q: "What are the busiest times of year we should plan around?", tip: "Scheduling conflicts."},
            {q: "Can you share a requirements document?", tip: "Fast-track scoping."},
            {q: "What budget range do you have in mind?", tip: "Budget qualification."},
            {q: "How many data sources does TM1 integrate with eg ERP, ledgers, databases? Are they cloud or on-premise?", tip: "ETL complexity."},
            {q: "Will any new data sources need to be added?", tip: "Future integration needs."},
            {q: "Are data reconciliation and load processes manual or automated?", tip: "Pitch automation."},
            {q: "Are you using PAW, Perspectives, Excel, or a combination?", tip: "UI preferences."},
            {q: "How many TM1 licenses do you have?", tip: "Current scale."},
            {q: "How many are admin licenses?", tip: "Ratio check."},
            {q: "Do you expect to need more licenses?", tip: "Growth check."},
            {q: "Do you have casual users who only log in once a year?", tip: "Usage frequency."},
            {q: "What is the license renewal date? We may be able to get you a better rate.", tip: "Renewal timeline."},
            {q: "Were the licenses purchased directly from IBM or via a third party?", tip: "Licensing channel."},
            {q: "Do you use any reporting tools against TM1 data eg Power BI?", tip: "BI Tools."},
            {q: "How many reports need to be built?", report: "Scope estimation."},
            {q: "Will you report using cube views, PAX or PAW?", tip: "UI strategy."},
            {q: "Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below.", tip: "Dashboard design."},
            {q: "How many developers have worked on TM1 since it was set up?", tip: "Codebase history."},
            {q: "How many cubes are in TM1?", tip: "Model complexity."},
            {q: "How many reports are in TM1?", tip: "Reporting scope."},
            {q: "How many security groups do you have?", tip: "Security overhead."},
            {q: "What are the log file sizes?", tip: "Rule performance checks."},
            {q: "How much memory does TM1 use in total?", tip: "RAM usage."},
            {q: "How much memory do the feeders use?", tip: "Feeder optimization."},
            {q: "Do you need a like-for-like migration or are you building from scratch? (On-premise)", tip: "Migration scope."},
            {q: "What is the server RAM size? (On-premise)", tip: "Hardware capability."},
            {q: "What is the server hard disk size? (On-premise)", tip: "Hardware limits."},
            {q: "What version of TM1 are you using? (On-premise)", tip: "Upgrade requirement."},
            {q: "Is there a prod and dev server? (On-premise)", tip: "Environment isolation."},
            {q: "How many instances of TM1 do you have? (On-premise)", tip: "Instance sprawl."},
            {q: "Do any Excel reports use Action Buttons? (On-premise)", tip: "Macro dependencies."},
            {q: "Do you use TM1 Web? If yes, how many Excel reports are published to it? (On-premise)", tip: "Web reporting."}
        ]
    };"""

app_pattern = re.compile(r'const BATTLECARDS = \{.*?\]\s*\n\s*\};', re.DOTALL)
app_new = app_pattern.sub(new_battlecards, app_code)

# Remove Variant C dropdown syncing in app.js
app_new = re.sub(r'\} else if \(variant === "C"\) \{\s*synthVariantSelect\.value = "Variant C";', '', app_new)
app_new = re.sub(r'if \(val === "Variant C"\) \{\s*variant = "C";\s*\} else ', '', app_new)


with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_new)
print("Updated app.js")
