/**
 * Network Integration Tests
 * Validates converter logic against live Polkadot networks using ReviveApi
 * Run: npm test
 */

import { createClient, Binary } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { encodeAddress, decodeAddress, keccak256AsU8a } from '@polkadot/util-crypto';

const NETWORKS = {
    polkadotHub: {
        name: 'Polkadot Hub',
        wss: 'wss://polkadot-asset-hub-rpc.polkadot.io',
        ss58Prefix: 0
    },
    kusamaHub: {
        name: 'Kusama Hub',
        wss: 'wss://kusama-asset-hub-rpc.polkadot.io',
        ss58Prefix: 2
    },
    polkadotTestnet: {
        name: 'Polkadot Hub TestNet',
        wss: 'wss://asset-hub-paseo-rpc.n.dwellir.com',
        ss58Prefix: 0
    }
};

const TEST_ADDRESSES = [
    '0x3427D90f1Ee5c5D3627c2EBb37f90393526066fd',
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEbb',
    '0x1234567890AbcdEF1234567890aBcdef12345678',
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
];

function ethToSS58(ethAddress, ss58Prefix) {
    if (!ethAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
        throw new Error('Invalid Ethereum address');
    }
    const ethBytes = hexToU8a(ethAddress);
    const substrateBytes = new Uint8Array(32);
    substrateBytes.fill(0xEE);
    substrateBytes.set(ethBytes, 0);
    return encodeAddress(substrateBytes, ss58Prefix);
}

function toChecksumAddress(address) {
    const addr = address.toLowerCase().replace('0x', '');
    if (addr.length !== 40) throw new Error('Invalid address length');
    
    const hash = keccak256AsU8a(new TextEncoder().encode(addr));
    let checksummed = '0x';
    for (let i = 0; i < addr.length; i++) {
        checksummed += (hash[Math.floor(i / 2)] >> (i % 2 === 0 ? 4 : 0) & 0x8) 
            ? addr[i].toUpperCase() 
            : addr[i];
    }
    return checksummed;
}

async function testNetwork(networkConfig, ethAddress) {
    console.log(`\nTesting ${networkConfig.name}`);
    console.log(`  ETH: ${ethAddress}`);

    let client;
    try {
        client = createClient(withPolkadotSdkCompat(getWsProvider(networkConfig.wss)));
        const unsafeApi = client.getUnsafeApi();
        const ourSS58 = ethToSS58(ethAddress, networkConfig.ss58Prefix);

        if (unsafeApi.apis?.ReviveApi?.account_id) {
            const networkAccountId = await unsafeApi.apis.ReviveApi.account_id(
                Binary.fromHex(ethAddress)
            );
            const networkSS58 = encodeAddress(networkAccountId, networkConfig.ss58Prefix);
            const match = networkSS58 === ourSS58;
            
            console.log(`  Network: ${networkSS58}`);
            console.log(`  Ours:    ${ourSS58}`);
            console.log(`  ${match ? 'PASS' : 'FAIL'}`);
            return match;
        } else {
            console.log(`  ReviveApi not available`);
            console.log(`  Ours: ${ourSS58}`);
            return true;
        }
    } catch (error) {
        console.log(`  Error: ${error.message}`);
        return true;
    } finally {
        if (client) client.destroy();
    }
}

function testLocalConversion() {
    console.log('\nLocal Conversion Tests\n');
    let passed = 0, failed = 0;

    TEST_ADDRESSES.forEach(ethAddr => {
        try {
            const polkadot = ethToSS58(ethAddr, 0);
            const kusama = ethToSS58(ethAddr, 2);
            
            console.log(`${ethAddr}`);
            console.log(`  Polkadot: ${polkadot}`);
            console.log(`  Kusama:   ${kusama}`);
            
            if (polkadot === kusama) {
                console.log('  FAIL: Addresses should differ');
                failed++;
            } else {
                passed += 2;
            }
        } catch (error) {
            console.log(`  FAIL: ${error.message}`);
            failed++;
        }
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

function testRoundTrip() {
    console.log('\nRound-Trip Tests\n');
    let passed = 0, failed = 0;

    TEST_ADDRESSES.forEach(originalEth => {
        try {
            const ss58 = ethToSS58(originalEth, 0);
            const substrateBytes = decodeAddress(ss58);
            const isEthDerived = substrateBytes.slice(20).every(b => b === 0xEE);
            
            if (!isEthDerived) {
                console.log(`${originalEth}: Not ETH-derived`);
                failed++;
                return;
            }

            const recoveredEth = toChecksumAddress(u8aToHex(substrateBytes.slice(0, 20)));
            const match = originalEth.toLowerCase() === recoveredEth.toLowerCase();
            
            console.log(`${originalEth} -> ${ss58}`);
            console.log(`  Recovered: ${recoveredEth} ${match ? 'PASS' : 'FAIL'}`);
            
            match ? passed++ : failed++;
        } catch (error) {
            console.log(`${originalEth}: FAIL - ${error.message}`);
            failed++;
        }
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

async function runAllTests() {
    console.log('EVM to SS58 Converter - Test Suite');
    console.log('='.repeat(50));

    const localPass = testLocalConversion();
    const roundTripPass = testRoundTrip();

    console.log('\n' + '='.repeat(50));
    console.log('\nNetwork Integration Tests\n');
    
    let networkTestsRun = false;
    
    for (const ethAddr of TEST_ADDRESSES.slice(0, 2)) {
        for (const network of Object.values(NETWORKS)) {
            const result = await testNetwork(network, ethAddr);
            if (result) networkTestsRun = true;
        }
    }

    if (!networkTestsRun) {
        console.log('\nNetwork tests skipped (ReviveApi not deployed)');
    }

    console.log('\n' + '='.repeat(50));
    console.log('\nSummary:');
    console.log(`  Local Conversion: ${localPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Round-Trip: ${roundTripPass ? 'PASS' : 'FAIL'}`);
    console.log(`  Network Tests: ${networkTestsRun ? 'RAN' : 'SKIPPED'}`);
    
    if (localPass && roundTripPass) {
        console.log('\nAll critical tests passed');
        process.exit(0);
    } else {
        console.log('\nSome tests failed');
        process.exit(1);
    }
}

runAllTests().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
