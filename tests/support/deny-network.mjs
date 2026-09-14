// Loaded in the child MCP process. Offline tests must never reach Graph or a DB.
globalThis.fetch = async () => { throw new Error('OFFLINE_TEST_NETWORK_BLOCKED'); };
