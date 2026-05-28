import re
from pathlib import Path

def upgrade():
    p = Path("docs.html")
    content = p.read_text(encoding="utf-8")
    
    # Update CSS
    new_css = """
        /* Enterprise Layout */
        .doc-layout {
            display: grid;
            grid-template-columns: 280px minmax(0, 1fr) 260px;
            gap: 2rem;
            margin-top: 64px;
            max-width: 1600px;
            width: 100%;
            margin-left: auto;
            margin-right: auto;
            padding: 0 2rem;
        }

        .sidebar {
            position: sticky;
            top: 64px;
            height: calc(100vh - 64px);
            border-right: 1px solid var(--border-color);
            background-color: var(--bg-page);
            overflow-y: auto;
            padding: 2.25rem 1.75rem 2.25rem 0;
            z-index: 10;
        }
        
        .sidebar-right {
            position: sticky;
            top: 64px;
            height: calc(100vh - 64px);
            border-left: 1px solid var(--border-color);
            background-color: var(--bg-page);
            overflow-y: auto;
            padding: 2.25rem 0 2.25rem 1.75rem;
            z-index: 10;
        }

        .content-panel {
            padding: 3rem 1.5rem;
            max-width: 900px;
            margin: 0 auto;
            width: 100%;
        }
        
        .toc-title {
            font-family: var(--font-display);
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-heading);
            margin-bottom: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .toc-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            border-left: 1px solid var(--border-color);
            padding-left: 0;
            margin-left: 2px;
        }
        
        .toc-link {
            font-size: 0.85rem;
            color: var(--text-light);
            text-decoration: none;
            transition: var(--transition);
            display: block;
            padding-left: 1rem;
            position: relative;
            line-height: 1.4;
        }
        
        .toc-link:hover {
            color: var(--primary);
        }
        
        .toc-link.active {
            color: var(--primary);
            font-weight: 600;
        }
        
        .toc-link.active::before {
            content: '';
            position: absolute;
            left: -1px;
            top: 0;
            bottom: 0;
            width: 2px;
            background-color: var(--primary);
        }
        
        header {
            background-color: hsla(var(--bg-card-hsl, 0, 0%, 100%), 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        
        [data-theme="dark"] header {
            background-color: rgba(0, 0, 0, 0.85);
            border-bottom: 1px solid var(--border-color);
        }
        
        @media (max-width: 1200px) {
            .doc-layout {
                grid-template-columns: 280px minmax(0, 1fr);
            }
            .sidebar-right {
                display: none;
            }
        }
        
        @media (max-width: 900px) {
            .doc-layout {
                grid-template-columns: 1fr;
                padding: 0 1rem;
            }
            .sidebar {
                display: none;
            }
        }
"""
    
    # Replace old layout CSS
    content = re.sub(
        r'/\* Documentation Layout Container \*/.*?(?=/\* Content Typography Styling \*/)', 
        new_css, 
        content, 
        flags=re.DOTALL
    )
    
    # Inject Right Sidebar HTML
    right_sidebar_html = """
        <!-- Main Content Area -->
        <main class="content-panel">
"""
    
    right_sidebar_closing = """
        </main>
        
        <!-- Table of Contents Sidebar -->
        <aside class="sidebar-right">
            <div class="toc-container">
                <div class="toc-title">On this page</div>
                <ul class="toc-list" id="toc-list">
                    <!-- Injected by JS -->
                </ul>
            </div>
        </aside>
    </div>
"""
    
    content = content.replace('<!-- Main Content Area -->\n        <main class="content-panel">', right_sidebar_html)
    
    # Find the closing main tag before the script
    content = re.sub(
        r'        </main>\s+</div>\s+<!-- Scripts -->',
        right_sidebar_closing + "\n\n    <!-- Scripts -->",
        content
    )
    
    # Inject TOC generation JS
    toc_js = """
    // Dynamic Table of Contents Generator
    function generateTOC() {
        const sections = document.querySelectorAll('.doc-section');
        const tocList = document.getElementById('toc-list');
        if (!tocList) return;
        
        tocList.innerHTML = '';
        
        // Find the currently visible section
        const activeSection = document.querySelector('.doc-section[style*="display: block"]') || document.querySelector('.doc-section');
        if (!activeSection) return;
        
        const headings = activeSection.querySelectorAll('h2, h3');
        
        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = 'heading-' + index;
            }
            
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + heading.id;
            a.className = 'toc-link';
            a.textContent = heading.textContent;
            
            if (heading.tagName.toLowerCase() === 'h3') {
                a.style.paddingLeft = '2rem';
                a.style.fontSize = '0.8rem';
            }
            
            a.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                document.querySelectorAll('.toc-link').forEach(link => link.classList.remove('active'));
                a.classList.add('active');
            });
            
            li.appendChild(a);
            tocList.appendChild(li);
        });
        
        // Highlight first item by default
        const firstLink = tocList.querySelector('.toc-link');
        if (firstLink) firstLink.classList.add('active');
    }
    
    // Call generateTOC when section changes
    const originalSwitchSection = window.switchSection || function(){};
    window.switchSection = function(sectionId) {
        // Call original
        document.querySelectorAll('.doc-section').forEach(sec => {
            sec.style.display = 'none';
        });
        document.getElementById(sectionId).style.display = 'block';
        
        document.querySelectorAll('.sidebar-link-item').forEach(li => {
            li.classList.remove('active');
            if (li.getAttribute('data-section') === sectionId) {
                li.classList.add('active');
            }
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Generate new TOC
        setTimeout(generateTOC, 50);
    };
    
    // Initialize TOC on load
    setTimeout(generateTOC, 500);
"""
    
    content = content.replace('// Set default section on load', toc_js + '\n\n    // Set default section on load')
    
    # Save the updated file
    p.write_text(content, encoding="utf-8")
    print("Enterprise upgrade complete.")

upgrade()
