
const fetch = require('node-fetch') || global.fetch;

async function run() {
    try {
        console.log('Triggering fix-state...');
        const res = await fetch('http://localhost:3000/api/debug/fix-state');
        const json = await res.json();
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
