import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const questionsFile = path.join('/tmp', 'custom-questions.json');

    if (req.method === 'GET') {
        const { variant } = req.query;
        if (!variant) {
            res.status(400).json({ error: 'Missing variant query parameter.' });
            return;
        }

        fs.readFile(questionsFile, 'utf8', (err, data) => {
            if (err) {
                res.status(200).json([]);
                return;
            }
            try {
                const parsed = JSON.parse(data);
                res.status(200).json(parsed[variant] || []);
            } catch (e) {
                res.status(200).json([]);
            }
        });
        return;
    }

    if (req.method === 'POST') {
        const { variant, questions } = req.body;
        if (!variant || !Array.isArray(questions)) {
            res.status(400).json({ error: 'Invalid payload. Expecting variant and questions array.' });
            return;
        }

        fs.readFile(questionsFile, 'utf8', (err, data) => {
            let existing = {};
            if (!err) {
                try { existing = JSON.parse(data); } catch (e) {}
            }
            existing[variant] = questions;

            fs.writeFile(questionsFile, JSON.stringify(existing, null, 2), 'utf8', (err2) => {
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
