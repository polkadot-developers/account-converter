# EVM to SS58 Address Converter

A static web tool for converting addresses between Ethereum (EVM) and SS58 formats used by Polkadot ecosystem chains.

## What It Does

Converts addresses bidirectionally between:

- **Ethereum addresses** (20-byte hex format, e.g., `0x742d35...`)
- **SS58 addresses** (Substrate format, e.g., `12BPKz35o...`)

Supports three networks:
- Polkadot Hub
- Kusama Hub
- Polkadot Hub Testnet (Paseo)

## How It Works

**Ethereum → SS58**: Pads the 20-byte Ethereum address to 32 bytes with `0xEE` suffix, then encodes with SS58 format using the selected network prefix.

**SS58 → Ethereum**: Decodes the SS58 address. If it ends with `0xEE` padding, strips it to recover the original Ethereum address. Otherwise, hashes the native Substrate address with Keccak256 and takes the last 20 bytes.

All conversions are deterministic and work offline.