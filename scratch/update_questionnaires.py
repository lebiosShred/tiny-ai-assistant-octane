import re
import os

docs_path = r"demo/docs.html"
index_path = r"demo/index.html"

with open(docs_path, 'r', encoding='utf-8') as f:
    docs = f.read()

docs_html = """<h2>Battlecard Questionnaire Variants</h2>
                <p>Selectable discovery scripts available on the teleprompter panel:</p>
                
                <h3>Variant A: First-Time TM1 / Planning Analytics Users</h3>
                <p><em>Targeting: Prospects consolidating data manually in Excel who do not run a dedicated multi-dimensional database.</em></p>
                
                <h4>Context</h4>
                <ul>
                    <li>Why did you contact us? What do you hope to achieve?</li>
                    <li>Why do you think you need TM1?</li>
                    <li>Is this for a single department or across the company?</li>
                    <li>What will you primarily use TM1 for?</li>
                    <li>What application would you like TM1 to replace?</li>
                    <li>How are you currently managing budgeting and forecasting?</li>
                    <li>How many people are involved in the planning process?</li>
                    <li>How long does your budgeting or forecasting cycle typically take?</li>
                    <li>What is the most frustrating part of your current process?</li>
                    <li>How confident are you in the numbers you are producing?</li>
                </ul>

                <h4>Project</h4>
                <ul>
                    <li>What does success look like for this project?</li>
                    <li>Do you have a target completion date?</li>
                    <li>Does your firm have a policy on cloud or on-premise?</li>
                    <li>What is the minimum you need TM1 to do?</li>
                    <li>What are the nice-to-have functions that can be added later?</li>
                    <li>Who will support TM1 after handover — IT or finance?</li>
                    <li>Who are the project stakeholders? First names and titles will do.</li>
                </ul>

                <h4>Planning</h4>
                <ul>
                    <li>What are the busiest times of year we should plan around?</li>
                    <li>Can you share a requirements document?</li>
                    <li>What budget range do you have in mind?</li>
                    <li>How many data sources need to integrate with TM1 eg ERP, ledgers, databases? Are they cloud or on-premise, and will any new ones need to be added?</li>
                    <li>Are data reconciliation and load processes manual or automated?</li>
                </ul>

                <h4>Licenses</h4>
                <ul>
                    <li>How many TM1 licenses will you need?</li>
                    <li>How many will be admin licenses?</li>
                    <li>Do you expect to need more licenses over time?</li>
                    <li>Do you have casual users who only log in once a year?</li>
                </ul>

                <h4>Reports</h4>
                <ul>
                    <li>Do you use any reporting tools against TM1 data eg Power BI?</li>
                    <li>How many reports need to be built?</li>
                    <li>Will you report using cube views, PAX or PAW?</li>
                    <li>Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below.</li>
                </ul>

                <h4>Excel users</h4>
                <ul>
                    <li>What are the manual data reconciliation processes?</li>
                    <li>Are data load and mapping processes manual or automated?</li>
                    <li>What are the most complicated Excel computations? Please describe the logic and paste screenshots below.</li>
                    <li>How much of what you need from TM1 is already being done in Excel today?</li>
                    <li>Do users contribute data directly? If yes, please paste screenshots of the input templates below.</li>
                </ul>

                <h4>Anaplan users</h4>
                <ul>
                    <li>Which business processes are covered eg budgeting, forecasting, workforce planning, sales planning?</li>
                    <li>How many models do you have and how many users interact with them?</li>
                    <li>How is data loaded into Anaplan — manually, via CloudWorks, Anaplan Connect, or API?</li>
                    <li>What source systems feed data into Anaplan eg ERP, CRM, HR?</li>
                    <li>How do users interact with the model — via dashboards, NUX pages, or Excel?</li>
                    <li>Do users contribute data directly, or is the model read-only for most?</li>
                </ul>

                <h4>Jedox users</h4>
                <ul>
                    <li>Which business processes are covered eg budgeting, forecasting, consolidation, reporting?</li>
                    <li>Is Jedox deployed on-premise or cloud?</li>
                    <li>How is data loaded into Jedox — via ETL integrator, scripts, or manually?</li>
                    <li>What source systems feed data into Jedox eg SAP, ERP, databases?</li>
                    <li>Do users interact via Excel reports, Jedox Web, or both?</li>
                    <li>Do users contribute data directly via input templates?</li>
                </ul>

                <h3>Variant B: Existing TM1 / Planning Analytics Users</h3>
                <p><em>Targeting: Prospects who already run IBM Planning Analytics / TM1 but face support bottlenecks, performance limits, or require upgrades.</em></p>
                
                <h4>Context</h4>
                <ul>
                    <li>Why did you contact us? What do you hope to achieve?</li>
                    <li>How long have you been using TM1?</li>
                    <li>What do you primarily use TM1 for?</li>
                    <li>Where does it fall short — including performance, speed, or usability issues?</li>
                    <li>Is TM1 used across the business or only within finance?</li>
                    <li>Have users adopted TM1 or do they resort to Excel?</li>
                    <li>Is it difficult to make enhancements? Who makes them?</li>
                    <li>Is the instance cloud or on-premise?</li>
                </ul>

                <h4>Project</h4>
                <ul>
                    <li>What does success look like for this project?</li>
                    <li>Do you have a target completion date?</li>
                    <li>Does your firm have a policy on cloud or on-premise?</li>
                    <li>What is the minimum you need TM1 to do?</li>
                    <li>What are the nice-to-have functions that can be added later?</li>
                    <li>How long ago did users receive training?</li>
                    <li>Who are the project stakeholders? First names and titles will do.</li>
                </ul>

                <h4>Planning</h4>
                <ul>
                    <li>What are the busiest times of year we should plan around?</li>
                    <li>Can you share a requirements document?</li>
                    <li>What budget range do you have in mind?</li>
                    <li>How many data sources does TM1 integrate with eg ERP, ledgers, databases? Are they cloud or on-premise?</li>
                    <li>Will any new data sources need to be added?</li>
                    <li>Are data reconciliation and load processes manual or automated?</li>
                    <li>Are you using PAW, Perspectives, Excel, or a combination?</li>
                </ul>

                <h4>Licenses</h4>
                <ul>
                    <li>How many TM1 licenses do you have?</li>
                    <li>How many are admin licenses?</li>
                    <li>Do you expect to need more licenses?</li>
                    <li>Do you have casual users who only log in once a year?</li>
                    <li>What is the license renewal date? We may be able to get you a better rate.</li>
                    <li>Were the licenses purchased directly from IBM or via a third party?</li>
                </ul>

                <h4>Reports</h4>
                <ul>
                    <li>Do you use any reporting tools against TM1 data eg Power BI?</li>
                    <li>How many reports need to be built?</li>
                    <li>Will you report using cube views, PAX or PAW?</li>
                    <li>Do you need static reports or dynamic dashboards? If you have a dashboard, please paste a screenshot below.</li>
                </ul>

                <h4>Technical</h4>
                <ul>
                    <li>How many developers have worked on TM1 since it was set up?</li>
                    <li>How many cubes are in TM1?</li>
                    <li>How many reports are in TM1?</li>
                    <li>How many security groups do you have?</li>
                    <li>What are the log file sizes?</li>
                    <li>How much memory does TM1 use in total?</li>
                    <li>How much memory do the feeders use?</li>
                </ul>

                <h4>On-premise users only</h4>
                <ul>
                    <li>Do you need a like-for-like migration or are you building from scratch?</li>
                    <li>What is the server RAM size?</li>
                    <li>What is the server hard disk size?</li>
                    <li>What version of TM1 are you using?</li>
                    <li>Is there a prod and dev server?</li>
                    <li>How many instances of TM1 do you have?</li>
                    <li>Do any Excel reports use Action Buttons?</li>
                    <li>Do you use TM1 Web? If yes, how many Excel reports are published to it?</li>
                </ul>"""

docs_pattern = re.compile(r'<h2>Battlecard Questionnaire Variants</h2>.*?</ul>\n\s*</section>', re.DOTALL)
docs_new = docs_pattern.sub(docs_html + "\n            </section>", docs)
with open(docs_path, 'w', encoding='utf-8') as f:
    f.write(docs_new)

with open(index_path, 'r', encoding='utf-8') as f:
    index = f.read()

index = re.sub(r'<option value="C">Variant C[^<]*</option>', '', index)
index = re.sub(r'<option value="Variant C">Variant C[^<]*</option>', '', index)
with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index)

print("done docs and index")
