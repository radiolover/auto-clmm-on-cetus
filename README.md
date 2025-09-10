# auto-clmm-on-cetus
auto-clmm-on-cetus is a liquidity mining tool on the SUI blockchain that dynamically adjusts the distribution range of positions by tracking the current price in real time.

Warning: Mining rewards may not be sufficient to cover impermanent loss, gas costs, and swap fees, and may result in losses.

```bash
# set up
npm i @cetusprotocol/aggregator-sdk
npm i @cetusprotocol/sui-clmm-sdk
npm i @cetusprotocol/cetus-sui-clmm-sdk
npm i sqlite3
npm i @types/sqlite3

# run
cd /path/to/src/v2
tsc
node miner.js
```

