
import 'dotenv/config'
import { sql, updateElectionState, getLatestElection } from '../lib/db'
import { getElectionState, isZkpEnabled } from '../lib/contract'

async function main() {
    console.log('🧪 Starting Election Creation Debug...');

    const electionName = `Debug Election ${Date.now()}`;
    console.log(`Creating election: "${electionName}"...`);

    // 1. Create Election
    const newElection = await updateElectionState('Created', undefined, electionName);
    console.log('✅ DB Insert Result:', newElection);

    if (newElection.state !== 'Created') {
        console.error('❌ IMMEDIATE ERROR: Election created with state', newElection.state);
        process.exit(1);
    } else {
        console.log('✅ Election created correctly in DB.');
    }

    // 2. Poll DB for 30 seconds to see if it changes
    console.log('⏳ Monitoring DB state for 30 seconds...');

    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const current = await sql`SELECT * FROM elections WHERE id = ${newElection.id}`;

        if (current.length === 0) {
            console.error('❌ Election disappeared!');
            break;
        }

        const state = current[0].state;
        console.log(`[${i * 5}s] State: ${state}`);

        if (state === 'Ended') {
            console.error('❌ DETECTED AUTO-END!');

            // Check transaction_logs to see WHO did it?
            const logs = await sql`SELECT * FROM transaction_logs WHERE created_at > ${newElection.created_at} ORDER BY id DESC LIMIT 5`;
            console.log('Recent Transaction Logs:', logs);
            break;
        }
    }

    console.log('🏁 Debug finished.');
    process.exit(0);
}

main().catch(console.error);
