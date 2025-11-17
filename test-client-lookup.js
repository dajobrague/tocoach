// Test script to debug client lookup
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing');
console.log('Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testClientLookup() {
    const email = 'carlos.ramirez@example.com';
    const tenantHost = 'ironfit.localhost';

    console.log('\n=== Testing Client Lookup ===');
    console.log('Email:', email);
    console.log('Tenant Host:', tenantHost);
    console.log('\n--- Test 1: Direct query on clients table ---');

    // Test 1: Direct query
    const { data: directData, error: directError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email);

    console.log('Direct query result:', directData);
    console.log('Direct query error:', directError);

    if (directData && directData.length > 0) {
        console.log('Client tenant UUID:', directData[0].tenant);
    }

    console.log('\n--- Test 2: Query tenants table ---');

    // Test 2: Check tenants table
    const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('host', tenantHost);

    console.log('Tenant query result:', tenantData);
    console.log('Tenant query error:', tenantError);

    console.log('\n--- Test 3: Check what tenant UUID references ---');

    if (directData && directData.length > 0) {
        const tenantUuid = directData[0].tenant;
        console.log('Looking for UUID:', tenantUuid);

        // Check if it's a trainer_id
        const { data: trainerCheck } = await supabase
            .from('trainers')
            .select('*')
            .eq('id', tenantUuid);
        console.log('Trainer lookup:', trainerCheck);
    }

    console.log('\n--- Test 4: Alternative approach - manual lookup ---');

    // Get tenant first
    if (tenantData && tenantData.length > 0) {
        const tenantInfo = tenantData[0];
        console.log('Tenant trainer_id:', tenantInfo.trainer_id);

        // Query clients by tenant UUID (assuming it's trainer_id)
        if (directData && directData.length > 0) {
            const clientTenantUuid = directData[0].tenant;
            console.log('Client tenant UUID:', clientTenantUuid);
            console.log('Match?', clientTenantUuid === tenantInfo.trainer_id);
        }
    }

    console.log('\n=== Test Complete ===\n');
}

testClientLookup().catch(console.error);

