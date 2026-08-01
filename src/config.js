// vulcan/src/config.js
// VULCAN — Model 2 Only. Throughput. P1:$1M P10:$5T.
export const SYSTEM    = 'VULCAN'
export const VERSION   = '1.0'
export const EXECUTOR  = '0xEc92EF0C897b48A3525Df011D08011c5eB2D6D39'
export const TREASURY  = '0xCCCF1C9A2154750A0D7CceeD51fE0f9b4c1906e8'
export const BALANCER  = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
export const SWAP_SIG  = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
export const MEMORY_MB = 80
export const PIN       = process.env.DASHBOARD_PASSKEY || '3530588'
export const PORT      = parseInt(process.env.PORT || '3000')
export const MPKEY     = process.env.MODEMPAY_SECRET_KEY || ''
export const REF       = 'Vulcan Operator: Bun Omar SECKA'

// Same 20 chains
export const CHAINS = [
  { name:'arb-mainnet',       id:42161,  http:'https://arb-mainnet.g.alchemy.com/v2/X0nWXU_gGc2Q7P_FrF_tM',       blocks:345600, fl:2100 },
  { name:'sei-mainnet',       id:1329,   http:'https://sei-mainnet.g.alchemy.com/v2/-vnNUoR-xYBdJc-EVAEtr',       blocks:345600, fl:800  },
  { name:'sonic-mainnet',     id:146,    http:'https://sonic-mainnet.g.alchemy.com/v2/bvVHqI4zTiNSN8Hkx9vqj',     blocks:172800, fl:700  },
  { name:'sonic-mainnet-2',   id:146,    http:'https://sonic-mainnet.g.alchemy.com/v2/OwN_yxTn0r3jg4KxlqkYJ',     blocks:172800, fl:700  },
  { name:'solana-mainnet',    id:0,      http:'https://solana-mainnet.g.alchemy.com/v2/FOimj4oVe521S4xNZC9FO',     blocks:172800, fl:1200 },
  { name:'base-mainnet',      id:8453,   http:'https://base-mainnet.g.alchemy.com/v2/3aotTt1Kv1x-fWDF7_kab',      blocks:43200,  fl:1400 },
  { name:'opt-mainnet',       id:10,     http:'https://opt-mainnet.g.alchemy.com/v2/sGjcCN-W3Ls8XQNNqSsNn',       blocks:43200,  fl:1100 },
  { name:'polygon-mainnet',   id:137,    http:'https://polygon-mainnet.g.alchemy.com/v2/CfWwmhym4lH5r7_T7_oU0',   blocks:40754,  fl:1800 },
  { name:'avax-mainnet',      id:43114,  http:'https://avax-mainnet.g.alchemy.com/v2/qbhq33J1d5gA1fa2F9oTc',      blocks:42146,  fl:1200 },
  { name:'blast-mainnet',     id:81457,  http:'https://blast-mainnet.g.alchemy.com/v2/0zddkzYwBs_J7lTLPQJAr',     blocks:43200,  fl:800  },
  { name:'zksync-mainnet',    id:324,    http:'https://zksync-mainnet.g.alchemy.com/v2/-2hgPK_0yIugOtz8gd2bN',    blocks:43200,  fl:900  },
  { name:'scroll-mainnet',    id:534352, http:'https://scroll-mainnet.g.alchemy.com/v2/2Hfl39Jdr3cIONf6P6evX',    blocks:28800,  fl:600  },
  { name:'linea-mainnet',     id:59144,  http:'https://linea-mainnet.g.alchemy.com/v2/1orEe9d1Y0Z6pcu0YsUPH',     blocks:43200,  fl:700  },
  { name:'mantle-mainnet',    id:5000,   http:'https://mantle-mainnet.g.alchemy.com/v2/TjtdcQ2UzexinqajRW1AX',    blocks:43200,  fl:500  },
  { name:'gnosis-mainnet',    id:100,    http:'https://gnosis-mainnet.g.alchemy.com/v2/rcXlHBD_ATzcywKP_3yOv',    blocks:16941,  fl:400  },
  { name:'worldchain-mainnet',id:480,    http:'https://worldchain-mainnet.g.alchemy.com/v2/KYeP7PjTazpg9y1cESm3h',blocks:43200,  fl:300  },
  { name:'berachain-mainnet', id:80094,  http:'https://berachain-mainnet.g.alchemy.com/v2/2dJONPcgoCkGLFULJ1ugZ', blocks:43200,  fl:600  },
  { name:'unichain-mainnet',  id:1301,   http:'https://unichain-mainnet.g.alchemy.com/v2/oFFJFW-FxwGOnCaNx21LO',  blocks:43200,  fl:500  },
  { name:'bnb-mainnet',       id:56,     http:'https://bnb-mainnet.g.alchemy.com/v2/6iqYCCQwSTR6b-tJKucS-',      blocks:28328,  fl:1500 },
  { name:'eth-mainnet',       id:1,      http:'https://eth-mainnet.g.alchemy.com/v2/jKhd0hz6ZYWaDlacqh_dx',      blocks:7200,   fl:8200 },
].map(c=>({...c,ws:c.http.replace('https://','wss://')}))

export const TOTAL_FLASH  = CHAINS.reduce((s,c)=>s+c.fl,0)*1e6
export const TOTAL_CYCLES = CHAINS.reduce((s,c)=>s+c.blocks,0)

// Propeller P1=$1M → P10=$5T (Model 2 hard ceiling)
export const PROPELLER = {
  1:  { r:1e6,   flash:500e6,   cycles:50000  },
  2:  { r:5e6,   flash:1e9,     cycles:200000 },
  3:  { r:1e7,   flash:2e9,     cycles:500000 },
  4:  { r:5e7,   flash:5e9,     cycles:1e6    },
  5:  { r:1e8,   flash:10e9,    cycles:2e6    },
  6:  { r:5e8,   flash:15e9,    cycles:3e6    },
  7:  { r:1e9,   flash:20e9,    cycles:5e6    },
  8:  { r:1e11,  flash:30e9,    cycles:7e6    },
  9:  { r:1e12,  flash:40e9,    cycles:7.5e6  },
  10: { r:5e12,  flash:45.59e9, cycles:8e6    },  // $5T hard cap
}
export const getProp = (n) => PROPELLER[Math.max(1,Math.min(10,Math.round(n)))]

export const USDC = {
  137:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  1:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  8453:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
}
export const STABLE0 = new Set([
  '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
  '0x45dda9cb7c25131df268515131f647d726f50608',
  '0x4c36388be6f416a29c8d8eee81c771ce6be14b5',
])
