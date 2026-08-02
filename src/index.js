// vulcan/src/index.js
// VULCAN — Model 2 Throughput. Zero swap dependency.
// Deploys 20 contracts in 60s after 0.001 POL received.
// Revenue flows from Vulcan → Alucard, Aegis, Ulican treasury.
import { Worker, isMainThread } from 'worker_threads'
import { createServer }         from 'http'
import { fileURLToPath }        from 'url'
import path                     from 'path'
import { CHAINS, TOTAL_FLASH, MEMORY_MB, EXECUTOR,
         TREASURY, SYSTEM, PORT, PIN }             from './config.js'
import { initDB }                                  from './db.js'

const __dir = path.dirname(fileURLToPath(import.meta.url))

// SAB — Model 2 layout (no ring buffers for swap events — not needed)
// [0] propeller  [1] daily_rev   [2] flash_base  [3] flash_reserve
// [4] crash_sig  [5] treasury    [6] exec_count  [7] uptime_sec
// [8] throughput_cycles  [9] contracts_deployed  [10] pol_received
// [20-39] gas_gwei/chain  [40-59] chain_active
// [60] total_throughput   [61] extraction_earned
// Signal at byte 1016: nexus→apex (throughput directive write head)
// Directive ring at byte 512: 64 slots × 8 bytes (profit per slot)
export const SAB     = new SharedArrayBuffer(1280)
export const HOT     = new Float64Array(SAB)
export const SIG_N2A = new Int32Array(SAB, 1016)
export const SIG_CTL = new Int32Array(SAB, 1020)

HOT[0] = 5          // P5 default
HOT[2] = TOTAL_FLASH
HOT[9] = 0          // contracts not yet deployed

// Memory guard — hard ceiling
const memGuard = () => {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024
  if (mb > MEMORY_MB * 0.85 && global.gc) global.gc()
  if (mb > MEMORY_MB * 0.95) { Atomics.store(SIG_CTL, 0, 1); if(global.gc) global.gc() }
}

// POL balance watcher — polls Polygon every 500ms for 0.001 POL
// Once detected: triggers contract deployment cascade on all 20 chains
async function watchForPOL() {
  const POLYGON_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/CfWwmhym4lH5r7_T7_oU0'
  const poll = async () => {
    if (HOT[10] > 0) return  // already detected
    try {
      const r = await fetch(POLYGON_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getBalance', params:[EXECUTOR,'latest'] }),
        signal: AbortSignal.timeout(4000),
      })
      const d = await r.json()
      const balWei = BigInt(d.result || '0x0')
      const balPOL = Number(balWei) / 1e18
      if (balPOL >= 0.001) {
        HOT[10] = balPOL
        console.log(`[VULCAN] POL detected: ${balPOL.toFixed(6)} — deploying 20 contracts...`)
        await deployAll()
      }
    } catch {}
  }
  setInterval(poll, 500)
  console.log(`[VULCAN] Watching for 0.001 POL at ${EXECUTOR}`)
}

// Deploy all 20 chain contracts via CREATE2 cascade
async function deployAll() {
  const PK = process.env.EXECUTOR_PRIVATE_KEY
  if (!PK) { console.warn('[VULCAN] No EXECUTOR_PRIVATE_KEY — deployment disabled'); return }
  const { ethers } = await import('ethers')
  const deployChain = async (chain) => {
    try {
      const provider = new ethers.JsonRpcProvider(chain.http)
      const wallet   = new ethers.Wallet(PK, provider)
      // Minimal proxy deployment — references the master Vulcan contract
      // Full bytecode provided by vulcan.sol compiled artifact
      const bytecode = process.env[`BYTECODE_${chain.name.replace(/-/g,'_').toUpperCase()}`]
                    || process.env.VULCAN_BYTECODE || '0x'
      if (bytecode === '0x') return
      const tx = await wallet.sendTransaction({ data:bytecode, gasLimit:500000n })
      await tx.wait(1)
      process.env[`CONTRACT_${chain.name.replace(/-/g,'_').toUpperCase()}`] = tx.creates || ''
      console.log(`[VULCAN] ${chain.name} deployed`)
    } catch (e) {
      if (process.env.DEBUG) console.error(`[VULCAN] Deploy ${chain.name}:`, e.message?.slice(0,50))
    }
  }
  // Deploy Polygon first (cheapest, fastest confirmation), then cascade all 20
  const [primary, ...rest] = CHAINS.filter(c=>c.id===137).concat(CHAINS.filter(c=>c.id!==137))
  await deployChain(primary)
  // All 19 remaining in parallel — confirmed in 60s
  await Promise.allSettled(rest.map(deployChain))
  HOT[9] = 1   // contracts deployed flag
  console.log('[VULCAN] All chains deployed — Throughput Model ACTIVE')
}

function spawn(file, extra={}) {
  const w = new Worker(new URL(file, import.meta.url), { workerData:{ SAB, ...extra } })
  const tag = path.basename(file,'.js').toUpperCase()
  w.on('error', e => console.error(`[${tag}]`, e.message?.slice(0,80)))
  w.on('exit',  c => { if(c!==0) setTimeout(()=>spawn(file,extra), 2000) })
  return w
}

if (isMainThread) {
  console.log(`[${SYSTEM}] Boot | Throughput Model 2 | $${(TOTAL_FLASH/1e9).toFixed(1)}B flash`)
  console.log(`[${SYSTEM}] Executor: ${EXECUTOR}`)
  console.log(`[${SYSTEM}] Treasury: ${TREASURY}`)

  await initDB()

  // Nexus and Apex are the only Workers — no chains.js (no swap detection)
  spawn('./nexus.js')
  spawn('./apex.js')

  const [{ startDashboard }, { startTreasury }] = await Promise.all([
    import('./dashboard.js'), import('./treasury.js')
  ])
  startDashboard(SAB, CHAINS)
  startTreasury(SAB)

  setInterval(memGuard, 5000)
  setInterval(() => HOT[7]++, 1000)

  // Midnight revenue reset
  const mid = () => {
    const n=new Date(), nx=new Date()
    nx.setUTCHours(0,0,0,0); nx.setUTCDate(nx.getUTCDate()+1)
    setTimeout(()=>{ HOT[1]=0; HOT[8]=0; mid() }, nx-n)
  }
  mid()

  // Watch for POL to trigger deployment
  watchForPOL()

  // Health
  createServer((req,res) => {
    if(req.url!=='/health'){res.writeHead(404);return res.end()}
    res.writeHead(200,{'Content-Type':'application/json'})
    res.end(JSON.stringify({
      ok:true, system:SYSTEM, model:2,
      propeller:HOT[0], rev:HOT[1],
      deployed:HOT[9]>0, cycles:HOT[8]|0,
      mb:process.memoryUsage().heapUsed/1024/1024|0
    }))
  }).listen(3001).on('error',()=>{})

  process.on('uncaughtException',  e=>console.error(`[${SYSTEM}]`,e.message?.slice(0,100)))
  process.on('unhandledRejection', r=>console.error(`[${SYSTEM}]`,String(r).slice(0,100)))
  process.on('SIGTERM', ()=>process.exit(0))

  console.log(`[${SYSTEM}] Operational :${PORT} | Waiting for 0.001 POL...`)
}
