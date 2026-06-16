const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEMO_DIR = path.join(__dirname, '../demo');
const INDEX_CSS_PATH = path.join(DEMO_DIR, 'index.css');

const TARGET_FILES = [
    path.join(DEMO_DIR, 'admin_setup.html'),
    path.join(DEMO_DIR, 'app.js'),
    path.join(DEMO_DIR, 'ai-assistant.js')
];

let classMap = new Map(); // style string -> class name
let classCounter = 1;

function generateClassName(styleStr) {
    if (classMap.has(styleStr)) {
        return classMap.get(styleStr);
    }
    // Attempt to generate semantic names based on style content
    let name = 'util-';
    
    // Some heuristics
    if (styleStr.includes('text-align: center')) name += 'text-center-';
    if (styleStr.includes('flex')) name += 'flex-';
    if (styleStr.includes('font-size')) name += 'text-sm-';
    if (styleStr.includes('color: #ff4d4d') || styleStr.includes('color: rgba(255,99,71')) name += 'text-error-';
    if (styleStr.includes('rgba(0,0,0,0.4)')) name += 'text-muted-';
    
    // Append hash to guarantee uniqueness
    const hash = crypto.createHash('md5').update(styleStr).digest('hex').substring(0, 6);
    const finalName = name + hash;
    classMap.set(styleStr, finalName);
    return finalName;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modifications = 0;

    // Regex to match style="<anything>"
    // Note: JS template literals might use single or double quotes, but HTML usually uses double quotes.
    // The regex handles style="..." and style='...'
    const styleRegex = /style=(["'])(.*?)\1/g;
    
    content = content.replace(styleRegex, (match, quote, styleContent) => {
        const cleanStyle = styleContent.trim();
        if (!cleanStyle) return match; // Empty style
        
        const className = generateClassName(cleanStyle);
        modifications++;
        
        // Return nothing for the style attribute, we will inject the class separately.
        // Wait, replacing style="..." with class="..." works, but if there's already a class="...", we get duplicates.
        // Doing this perfectly with regex is risky. Let's do a naive replace to class="..." 
        // Then we'll do a second pass to merge adjacent class="..." attributes.
        return `class=${quote}${className}${quote}`;
    });

    // Pass 2: Merge duplicate class attributes inside the same tag (e.g. class="foo" class="bar")
    // This is a naive heuristic that merges two class= attributes separated by spaces.
    const classMergeRegex = /class=(["'])(.*?)\1\s+class=(["'])(.*?)\3/g;
    let mergedContent = content;
    let mergeModifications;
    do {
        mergeModifications = 0;
        mergedContent = mergedContent.replace(classMergeRegex, (match, q1, c1, q2, c2) => {
            mergeModifications++;
            return `class="${c1} ${c2}"`;
        });
    } while(mergeModifications > 0);

    // Save modified file
    if (modifications > 0) {
        fs.writeFileSync(filePath, mergedContent, 'utf8');
        console.log(`Updated ${path.basename(filePath)}: scrubbed ${modifications} inline styles.`);
    }
}

async function main() {
    console.log("Starting CSS Specificity Scrub...");
    
    // Ensure index.css exists
    if (!fs.existsSync(INDEX_CSS_PATH)) {
        fs.writeFileSync(INDEX_CSS_PATH, '', 'utf8');
    }

    TARGET_FILES.forEach(file => {
        if (fs.existsSync(file)) {
            processFile(file);
        } else {
            console.warn(`File not found: ${file}`);
        }
    });

    // Generate new CSS rules
    if (classMap.size > 0) {
        let cssAdditions = "\n\n/* =========================================\n";
        cssAdditions += "   AUTO-GENERATED UTILITY CLASSES (SCRUB)\n";
        cssAdditions += "   ========================================= */\n";
        
        for (const [styleStr, className] of classMap.entries()) {
            // Convert hardcoded RGBA to CSS variables where possible if in AXIOM mode.
            // For now, simply map the exact style to preserve 1:1 visual output.
            let optimizedStyle = styleStr;
            if (!optimizedStyle.endsWith(';')) optimizedStyle += ';';
            
            cssAdditions += `.${className} {\n    ${optimizedStyle.split(';').map(s => s.trim()).filter(s => s).join(';\n    ')};\n}\n`;
        }
        
        fs.appendFileSync(INDEX_CSS_PATH, cssAdditions, 'utf8');
        console.log(`Injected ${classMap.size} new utility classes into index.css`);
    } else {
        console.log("No inline styles found to scrub.");
    }
    
    console.log("CSS Scrub Complete.");
}

main();
