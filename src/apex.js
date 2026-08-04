// vulcan/src/apex.js — VULCAN Model 2
// Fixed: provider singletons (no OOM), cleanHex PK, continuous counter
// Model 2: 7-chain rotation for throughput distribution
// Revenue starts in accumulator mode, switches to on-chain when contracts deployed
import { workerData } from 'worker_threads'
import { ethers }     from 'ethers'
import http2          from 'http2'
import { EXECUTOR, BALANCER, USDC, getProp } from './config.js'

const { SAB }    = workerData
const HOT        = new Float64Array(SAB)
const SIG_N2A    = new Int32Array(SAB, 1016)
const N2A        = new Float64Array(SAB, 512, 64)

// ── PRIVATE KEY ───────────────────────────────────────────────────────────────
const cleanHex = s => (s || '').replace(/[^0-9a-fA-Fx]/g, '')
const PK       = cleanHex(process.env.EXECUTOR_PRIVATE_KEY || '')
const wallet   = PK.startsWith('0x') && PK.length === 66 ? new ethers.Wallet(PK) : null

// ── 7 EXECUTION CHAIN SINGLETONS — created once at module load ────────────────
const EXEC_CHAINS = [
  { id:137,   name:'POLYGON',   rpc:'https://polygon-mainnet.g.alchemy.com/v2/CfWwmhym4lH5r7_T7_oU0' },
  { id:42161, name:'ARBITRUM',  rpc:'https://arb-mainnet.g.alchemy.com/v2/X0nWXU_gGc2Q7P_FrF_tM'    },
  { id:8453,  name:'BASE',      rpc:'https://base-mainnet.g.alchemy.com/v2/3aotTt1Kv1x-fWDF7_kab'   },
  { id:10,    name:'OPTIMISM',  rpc:'https://opt-mainnet.g.alchemy.com/v2/sGjcCN-W3Ls8XQNNqSsNn'    },
  { id:1,     name:'ETHEREUM',  rpc:'https://eth-mainnet.g.alchemy.com/v2/jKhd0hz6ZYWaDlacqh_dx'    },
  { id:56,    name:'BNB',       rpc:'https://bnb-mainnet.g.alchemy.com/v2/6iqYCCQwSTR6b-tJKucS-'    },
  { id:43114, name:'AVAX',      rpc:'https://avax-mainnet.g.alchemy.com/v2/qbhq33J1d5gA1fa2F9oTc'   },
]

const PROVIDERS = {}
for (const c of EXEC_CHAINS) {
  try { PROVIDERS[c.id] = new ethers.JsonRpcProvider(c.rpc) } catch {}
}

const contract = (c) => process.env[`CONTRACT_${c.name}`] || ''

const H2 = [
  'https://relay.flashbots.net',
  'https://rpc.titanbuilder.xyz',
  'https://rpc.beaverbuild.org',
  'https://rsync-builder.xyz',
].map(u=>{try{const s=http2.connect(u);s.on('error',()=>{});return s}catch{return null}}).filter(Boolean)

const IFACE    = new ethers.Interface(['function flashLoan(address,address[],uint256[],bytes)'])
const nonces   = {}
let   chainIdx = 0, rHead = 0, totalExec = 0

function nextChain() {
  const live = EXEC_CHAINS.filter(c => contract(c))
  if (!live.length) return null
  return live[chainIdx++ % live.length]
}

async function initNonce(cid) {
  if (nonces[cid] != null) return
  try { nonces[cid] = await PROVIDERS[cid]?.getTransactionCount(EXECUTOR,'pending') ?? 0 }
  catch { nonces[cid] = 0 }
}

function submit(signed) {
  const p = Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_sendBundle',params:[{txs:[signed]}]}))
  for (const s of H2) {
    if (s?.destroyed) continue
    try { const r=s.request({':method':'POST',':path':'/rpc','content-type':'application/json','content-length':String(p.length)});r.write(p);r.end() } catch {}
  }
}

async function execute(slot) {
  const profit = N2A[slot % 64]
  if (!profit) return

  const net  = profit * 0.99999
  HOT[1]    += net
  HOT[5]    += net
  HOT[3]     = Math.min(HOT[3] + net * 0.5, 100e9)
  HOT[6]++
  totalExec++

  if (totalExec % 100 === 0) {
    console.log(`[APEX] ${totalExec} | $${(HOT[1]/1e12).toFixed(4)}T | Flash $${((HOT[2]+HOT[3])/1e9).toFixed(0)}B`)
  }

  if (!wallet) return
  const chain = nextChain()
  if (!chain) return     // no contracts deployed yet

  try {
    await initNonce(chain.id)
    const P    = getProp(HOT[0])
    const gwei = BigInt(Math.floor((HOT[20] || 5) * 1.5 * 1e9))
    const fl   = BigInt(Math.floor(Math.min(profit*200, P.flash)))
    const cd   = IFACE.encodeFunctionData('flashLoan', [
      contract(chain),
      [USDC[chain.id] || USDC[137]],
      [fl],
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256'],[BigInt(Math.floor(profit*0.3))])
    ])
    const signed = await wallet.signTransaction({
      chainId:BigInt(chain.id), to:BALANCER, data:cd,
      nonce:nonces[chain.id]++, gasLimit:900000n, type:2,
      maxFeePerGas:gwei, maxPriorityFeePerGas:gwei/2n,
    })
    submit(signed)
  } catch(e) {
    if (e.message?.includes('nonce')) nonces[chain.id] = undefined
    if (process.env.DEBUG) console.error('[APEX]', e.message?.slice(0,80))
  }
}

function poll() {
  const head = Atomics.load(SIG_N2A, 0)
  while (rHead < head) { execute(rHead).catch(()=>{}); rHead++ }
  setImmediate(poll)
}

poll()
console.log('[APEX] VULCAN Model 2 online | 7-chain rotation')
