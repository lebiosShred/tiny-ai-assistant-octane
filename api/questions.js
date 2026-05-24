import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const defaultQuestionsFile = path.join(process.cwd(), 'knowledge', 'custom-questions.json');
    const customQuestionsFile = path.join('/tmp', 'custom-questions.json');

    if (req.method === 'GET') {
        const { variant } = req.query;
        if (!variant) {
            res.status(400).json({ error: 'Missing variant query parameter.' });
            return;
        }

        // Try reading from the /tmp custom overrides first
        fs.readFile(customQuestionsFile, 'utf8', (err, data) => {
            if (!err) {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed[variant]) {
                        res.status(200).json(parsed[variant]);
                        return;
                    }
                } catch (e) {}
            }

            // Fallback to reading the default checked-in questions from repository
            fs.readFile(defaultQuestionsFile, 'utf8', (err2, data2) => {
                if (err2) {
                    res.status(200).json([]);
                    return;
                }
                try {
                    const parsed2 = JSON.parse(data2);
                    res.status(200).json(parsed2[variant] || []);
                } catch (e2) {
                    res.status(200).json([]);
                }
            });
        });
        return;
    }

    if (req.method === 'POST') {
        const { variant, questions } = req.body;
        if (!variant || !Array.isArray(questions)) {
            res.status(400).json({ error: 'Invalid payload. Expecting variant and questions array.' });
            return;
        }

        // Read from /tmp, fallback to default questions file if /tmp doesn't exist yet
        fs.readFile(customQuestionsFile, 'utf8', (err, data) => {
            let existing = {};
            if (!err) {
                try { existing = JSON.parse(data); } catch (e) {}
            } else {
                // Pre-populate with default questions if custom doesn't exist
                try {
                    const defaultData = fs.readFileSync(defaultQuestionsFile, 'utf8');
                    existing = JSON.parse(defaultData);
                } catch (e) {}
            }

            existing[variant] = questions;

            fs.writeFile(customQuestionsFile, JSON.stringify(existing, null, 2), 'utf8', (err2) => {
                if (err2) {
                    res.status(500).json({ error: 'Failed to write custom questions on server.' });
                    return;
                }
                res.status(200).json({ status: 'success', message: 'Questions registered on server.' });
            });
        });
        return;
    }

    res.status(405).json({ error: 'Method Not Allowed' });
}
