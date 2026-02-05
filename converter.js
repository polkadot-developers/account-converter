/**
 * EVM to SS58 Address Converter
 * Using Polkadot.js libraries for 100% compatibility
 * 
 * Conversion Logic:
 * - ETH → SS58: 20-byte ETH address is padded to 32 bytes with 0xEE suffix
 * - SS58 → ETH: If padded (ends with 0xEE), strips to original; otherwise Keccak256 hash
 */

// Wait for Polkadot.js libraries to load
(function() {
    'use strict';

    // Check if libraries are loaded
    if (typeof polkadotUtil === 'undefined' || typeof polkadotUtilCrypto === 'undefined') {
        console.error('Polkadot.js libraries not loaded');
        return;
    }

    const { hexToU8a, u8aToHex } = polkadotUtil;
    const { encodeAddress, decodeAddress, keccak256AsU8a } = polkadotUtilCrypto;

    /**
     * Converts an Ethereum address to SS58 format
     * 
     * Process:
     * 1. Validate Ethereum address (must be 20 bytes)
     * 2. Create 32-byte array filled with 0xEE
     * 3. Copy 20 ETH bytes into first 20 positions
     * 4. Encode with SS58 using selected network prefix
     * 
     * @param {string} ethAddress - Ethereum address (0x + 40 hex chars)
     * @param {number} ss58Prefix - Network prefix
     * @returns {string} SS58-encoded address
     */
    function ethToSS58(ethAddress, ss58Prefix) {
        // Validate Ethereum address format
        if (!ethAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
            throw new Error('Invalid Ethereum address format. Expected 0x followed by 40 hex characters.');
        }

        // Convert ETH address to bytes (20 bytes)
        const ethBytes = hexToU8a(ethAddress);

        // Create 32-byte Substrate address: 20 bytes ETH + 12 bytes of 0xEE padding
        const substrateBytes = new Uint8Array(32);
        substrateBytes.fill(0xEE);
        substrateBytes.set(ethBytes, 0);

        // Encode as SS58 address
        return encodeAddress(substrateBytes, ss58Prefix);
    }

    /**
     * Converts an SS58 address to Ethereum format
     * 
     * Process:
     * 1. Decode SS58 address to 32-byte public key
     * 2. Check last 12 bytes:
     *    - If all 0xEE: This is an ETH-derived address, strip suffix to get original 20 bytes
     *    - Otherwise: This is a native Substrate address, hash with Keccak256 and take last 20 bytes
     * 3. Return checksummed Ethereum address
     * 
     * @param {string} ss58Address - SS58-encoded Substrate address
     * @returns {string} Checksummed Ethereum address
     */
    function ss58ToEth(ss58Address) {
        // Decode SS58 address to get 32-byte public key
        const substrateBytes = decodeAddress(ss58Address);

        // Check if last 12 bytes are all 0xEE (indicates ETH-derived address)
        const isEthDerived = substrateBytes.slice(20).every(byte => byte === 0xEE);

        let ethBytes;
        if (isEthDerived) {
            // ETH-derived: Strip 0xEE suffix to get original 20-byte ETH address
            ethBytes = substrateBytes.slice(0, 20);
        } else {
            // Native Substrate address: Hash with Keccak256 and take last 20 bytes
            const hash = keccak256AsU8a(substrateBytes);
            ethBytes = hash.slice(-20);
        }

        // Convert to hex and apply EIP-55 checksumming
        return toChecksumAddress(u8aToHex(ethBytes));
    }

    /**
     * Converts an Ethereum address to checksummed format (EIP-55)
     * 
     * @param {string} address - Ethereum address (with or without 0x prefix)
     * @returns {string} Checksummed Ethereum address with 0x prefix
     */
    function toChecksumAddress(address) {
        const addr = address.toLowerCase().replace('0x', '');
        
        if (addr.length !== 40) {
            throw new Error('Invalid Ethereum address length');
        }

        const hash = keccak256AsU8a(new TextEncoder().encode(addr));
        
        let checksummed = '0x';
        for (let i = 0; i < addr.length; i++) {
            if (hash[Math.floor(i / 2)] >> (i % 2 === 0 ? 4 : 0) & 0x8) {
                checksummed += addr[i].toUpperCase();
            } else {
                checksummed += addr[i];
            }
        }
        
        return checksummed;
    }

    /**
     * Validates an Ethereum address format
     */
    function isValidEthAddress(address) {
        return /^0x[0-9a-fA-F]{40}$/.test(address);
    }

    /**
     * Validates an SS58 address by attempting to decode it
     */
    function isValidSS58Address(address) {
        try {
            decodeAddress(address);
            return true;
        } catch {
            return false;
        }
    }

    // =============================================================================
    // Expose functions to window for global access
    // =============================================================================
    window.ethToSS58 = ethToSS58;
    window.ss58ToEth = ss58ToEth;
    window.toChecksumAddress = toChecksumAddress;
    window.isValidEthAddress = isValidEthAddress;
    window.isValidSS58Address = isValidSS58Address;

    // =============================================================================
    // UI Integration Functions
    // =============================================================================

    /**
     * Auto-convert ETH to SS58 on input
     */
    function autoConvertEthToSS58() {
        const ethInput = document.getElementById('ethAddress');
        const ss58Input = document.getElementById('ss58Address');
        const ethError = document.getElementById('ethError');
        const networkSelect = document.getElementById('network');

        // Clear previous errors
        ethError.classList.remove('show');
        ethInput.classList.remove('error');

        const ethAddress = ethInput.value.trim();
        
        if (!ethAddress) {
            ss58Input.value = '';
            return;
        }

        try {
            const ss58Prefix = parseInt(networkSelect.value);
            const ss58Address = ethToSS58(ethAddress, ss58Prefix);
            
            // Update SS58 field and apply checksum to ETH field
            ss58Input.value = ss58Address;
            ethInput.value = toChecksumAddress(ethAddress);
        } catch (error) {
            showError(ethError, ethInput, error.message);
            ss58Input.value = '';
        }
    }

    /**
     * Auto-convert SS58 to ETH on input (only if "mapped account" checkbox is checked)
     */
    function autoConvertSS58ToEth() {
        const ethInput = document.getElementById('ethAddress');
        const ss58Input = document.getElementById('ss58Address');
        const ss58Error = document.getElementById('ss58Error');
        const mappedCheckbox = document.getElementById('ss58MappedCheckbox');

        // Clear previous errors
        ss58Error.classList.remove('show');
        ss58Input.classList.remove('error');

        const ss58Address = ss58Input.value.trim();
        
        if (!ss58Address) {
            ethInput.value = '';
            return;
        }

        if (!mappedCheckbox || !mappedCheckbox.checked) {
            ethInput.value = '';
            showError(ss58Error, ss58Input, 'Check the box to confirm you have mapped this account before converting SS58 → ETH.');
            return;
        }

        try {
            const ethAddress = ss58ToEth(ss58Address);
            ethInput.value = ethAddress;
        } catch (error) {
            showError(ss58Error, ss58Input, error.message);
            ethInput.value = '';
        }
    }

    /**
     * Swap button - intelligently converts based on which field has a value
     */
    window.performSwap = function() {
        const ethInput = document.getElementById('ethAddress');
        const ss58Input = document.getElementById('ss58Address');
        const ethError = document.getElementById('ethError');
        const ss58Error = document.getElementById('ss58Error');
        const networkSelect = document.getElementById('network');
        
        const ethValue = ethInput.value.trim();
        const ss58Value = ss58Input.value.trim();
        
        // Clear errors
        clearError(ethError, ethInput);
        clearError(ss58Error, ss58Input);
        
        // If both have values or neither, prefer ETH -> SS58
        if (ethValue) {
            try {
                const ss58Prefix = parseInt(networkSelect.value);
                const ss58Address = ethToSS58(ethValue, ss58Prefix);
                ss58Input.value = ss58Address;
                ethInput.value = toChecksumAddress(ethValue);
            } catch (error) {
                showError(ethError, ethInput, error.message);
            }
        } else if (ss58Value) {
            const mappedCheckbox = document.getElementById('ss58MappedCheckbox');
            if (!mappedCheckbox.checked) {
                showError(ss58Error, ss58Input, 'Check the box to confirm you have mapped this account before converting SS58 → ETH.');
                return;
            }
            try {
                const ethAddress = ss58ToEth(ss58Value);
                ethInput.value = ethAddress;
            } catch (error) {
                showError(ss58Error, ss58Input, error.message);
            }
        }
    };

    /**
     * Copy address to clipboard with visual feedback
     */
    window.copyToClipboard = async function(inputId) {
        const input = document.getElementById(inputId);
        const button = event.currentTarget;
        
        if (!input.value.trim()) {
            return;
        }
        
        try {
            await navigator.clipboard.writeText(input.value);
            
            // Visual feedback
            button.classList.add('copied');
            
            // Change icon to checkmark temporarily
            const originalHTML = button.innerHTML;
            button.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            
            // Reset after 1.5 seconds
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = originalHTML;
            }, 1500);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    /**
     * Show error message and highlight input
     */
    function showError(errorElement, inputElement, message) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        inputElement.classList.add('error');
    }

    /**
     * Clear error for an input
     */
    function clearError(errorElement, inputElement) {
        errorElement.classList.remove('show');
        inputElement.classList.remove('error');
    }

    // Set up event listeners when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        const ethInput = document.getElementById('ethAddress');
        const ss58Input = document.getElementById('ss58Address');
        const networkSelect = document.getElementById('network');
        const ethError = document.getElementById('ethError');
        const ss58Error = document.getElementById('ss58Error');
        
        let ethConvertTimeout;
        let ss58ConvertTimeout;
        
        // ETH input: auto-convert with debounce
        ethInput.addEventListener('input', () => {
            clearError(ethError, ethInput);
            
            const value = ethInput.value.trim();
            if (value === '') {
                ss58Input.value = '';
                return;
            }
            
            // Debounce: wait 500ms after user stops typing
            clearTimeout(ethConvertTimeout);
            ethConvertTimeout = setTimeout(() => {
                if (value.length >= 42) { // Only convert if looks like a complete address
                    autoConvertEthToSS58();
                }
            }, 500);
        });
        
        // ETH input: instant convert on paste
        ethInput.addEventListener('paste', () => {
            setTimeout(() => {
                if (ethInput.value.trim()) {
                    autoConvertEthToSS58();
                }
            }, 50);
        });
        
        // SS58 input: only allow conversion when "mapped" checkbox is checked
        ss58Input.addEventListener('input', () => {
            clearError(ss58Error, ss58Input);
            
            const value = ss58Input.value.trim();
            if (value === '') {
                ethInput.value = '';
                return;
            }

            const mappedCheckbox = document.getElementById('ss58MappedCheckbox');
            if (!mappedCheckbox || !mappedCheckbox.checked) {
                // Block conversion: clear ETH immediately and show error
                ethInput.value = '';
                if (value.length >= 40) {
                    showError(ss58Error, ss58Input, 'Check the box to confirm you have mapped this account before converting SS58 → ETH.');
                }
                return;
            }
            
            // Checkbox is checked: debounce then convert
            clearTimeout(ss58ConvertTimeout);
            ss58ConvertTimeout = setTimeout(() => {
                if (value.length >= 40) {
                    autoConvertSS58ToEth();
                }
            }, 500);
        });
        
        // SS58 paste: same logic runs in input handler after paste inserts text
        ss58Input.addEventListener('paste', () => {
            // Let the input event handle it; just ensure we run one more check after paste is applied
            setTimeout(() => {
                const value = ss58Input.value.trim();
                if (!value || value.length < 40) return;
                const mappedCheckbox = document.getElementById('ss58MappedCheckbox');
                if (!mappedCheckbox || !mappedCheckbox.checked) {
                    ethInput.value = '';
                    showError(ss58Error, ss58Input, 'Check the box to confirm you have mapped this account before converting SS58 → ETH.');
                }
            }, 0);
        });
        
        // Network change: re-convert if ETH address exists
        networkSelect.addEventListener('change', () => {
            if (ethInput.value.trim()) {
                autoConvertEthToSS58();
            }
        });
        
        // Enter key support
        ethInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                autoConvertEthToSS58();
            }
        });
        
        ss58Input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                autoConvertSS58ToEth();
            }
        });

        // When user checks "mapped account", convert SS58 → ETH if SS58 field has a value
        const mappedCheckbox = document.getElementById('ss58MappedCheckbox');
        mappedCheckbox.addEventListener('change', () => {
            if (mappedCheckbox.checked && ss58Input.value.trim().length >= 40) {
                autoConvertSS58ToEth();
            } else if (!mappedCheckbox.checked && ss58Input.value.trim()) {
                ethInput.value = '';
                showError(ss58Error, ss58Input, 'Check the box to confirm you have mapped this account before converting SS58 → ETH.');
            }
        });
    });

    console.log('EVM to SS58 Converter loaded successfully (using Polkadot.js)');
})();
