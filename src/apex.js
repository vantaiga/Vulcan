// vulcan/src/apex.js — VULCAN Model 2 Final
// 1ms throughput. 7-chain rotation.
// 25% of profit → reserve by default (HOT[12]%, floor 0.001%).
// Same propeller governor as ALUCARD.
// Same provider singleton pattern.
import { workerData } from 'worker_threads'
import { ethers }     from 'ethers'
import http2          from 'http2'
import { EXECUTOR, BALANCER, USDC, getProp } from './config.js'

const { SAB }    = workerData
const HOT        = new Float64Array(SAB)
const SIG_N2A    = new Int32Array(SAB, 1016)
const N2A        = new Float64Array(SAB, 512, 64)
const SIG_CTRL   = new Int32Array(SAB, 1020)

const cleanHex = s => (s||'').replace(/[^0-9a-fA-Fx]/g,'')
const PK       = cleanHex(process.env.EXECUTOR_PRIVATE_KEY||'')
const wallet   = PK.startsWith('0x') && PK.length===66 ? new ethers.Wallet(PK) : null

// ── PROVIDER SINGLETONS ────────────────────────────────────────────────────────
const EXEC = [
  {id:137,   n:'POLYGON',  rpc:'https://polygon-mainnet.g.alchemy.com/v2/CfWwmhym4lH5r7_T7_oU0'},
  {id:42161, n:'ARBITRUM', rpc:'https://arb-mainnet.g.alchemy.com/v2/X0nWXU_gGc2Q7P_FrF_tM'},
  {id:8453,  n:'BASE',     rpc:'https://base-mainnet.g.alchemy.com/v2/3aotTt1Kv1x-fWDF7_kab'},
  {id:10,    n:'OPTIMISM', rpc:'https://opt-mainnet.g.alchemy.com/v2/sGjcCN-W3Ls8XQNNqSsNn'},
  {id:1,     n:'ETHEREUM', rpc:'https://eth-mainnet.g.alchemy.com/v2/jKhd0hz6ZYWaDlacqh_dx'},
  {id:56,    n:'BNB',      rpc:'https://bnb-mainnet.g.alchemy.com/v2/6iqYCCQwSTR6b-tJKucS-'},
  {id:43114, n:'AVAX',     rpc:'https://avax-mainnet.g.alchemy.com/v2/qbhq33J1d5gA1fa2F9oTc'},
]
const PROVIDERS = {}
for (const c of EXEC) { try { PROVIDERS[c.id]=new ethers.JsonRpcProvider(c.rpc) } catch {} }

const contract = c => process.env[`CONTRACT_${c.n}`]||''

const H2 = ['https://relay.flashbots.net','https://rpc.titanbuilder.xyz','https://rpc.beaverbuild.org','https://rsync-builder.xyz']
  .map(u=>{try{const s=http2.connect(u);s.on('error',()=>{});return s}catch{return null}}).filter(Boolean)

const IFACE  = new ethers.Interface(['function flashLoan(address,address[],uint256[],bytes)'])
const nonces = {}
let   cidx   = 0

function nextChain() {
  const live = EXEC.filter(c => contract(c))
  return live.length ? live[cidx++ % live.length] : null
}

async function initNonce(id) {
  if (nonces[id]!=null) return
  try { nonces[id]=await PROVIDERS[id]?.getTransactionCount(EXECUTOR,'pending')??0 }
  catch { nonces[id]=0 }
}

function submit(signed) {
  const p=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_sendBundle',params:[{txs:[signed]}]}))
  for(const s of H2){if(s?.destroyed)continue;try{const r=s.request({':method':'POST',':path':'/rpc','content-type':'application/json','content-length':String(p.length)});r.write(p);r.end()}catch{}}
}

function getTarget(lvl){
  if(lvl<=0.1)  return 1e6;  if(lvl<=0.5)  return 5e7;  if(lvl<=1) return 1e9
  if(lvl<=10.1) return 2e9;  if(lvl<=10.5) return 5e10; if(lvl<=11) return 1e12
  if(lvl<=12)   return 1.5e12; if(lvl<=15) return 3e12; if(lvl<=20) return 5e12
  if(lvl<=25)   return 7e12; if(lvl<=28) return 8e12;   if(lvl<=30) return 18.16e15
  if(lvl>=100)  return HOT[18]; return 18.16e15
}

function effectiveFlash() {
  const f=HOT[2]+HOT[13]; HOT[14]=f; return f
}

const RESERVE_CAP = 5e12
let rHead=0, execTotal=0

async function execute(slot) {
  if (Atomics.load(SIG_CTRL,0)===1) return
  const target=getTarget(HOT[0])
  if (HOT[1]>=target) return
  if (!wallet) return
  const chain=nextChain(); if(!chain) return

  const profit=N2A[slot%64]; if(!profit)return

  const ef=effectiveFlash()
  const scaled_profit=profit*(ef/HOT[2])

  try {
    await initNonce(chain.id)
    const P=getProp(HOT[0])
    const gwei=BigInt(Math.floor((HOT[20]||5)*1.5*1e9))
    const fl=BigInt(Math.floor(Math.min(ef,P.flash)))
    const cd=IFACE.encodeFunctionData('flashLoan',[contract(chain),[USDC[chain.id]||USDC[137]],[fl],ethers.AbiCoder.defaultAbiCoder().encode(['uint256'],[BigInt(Math.floor(scaled_profit*0.3))])])
    const signed=await wallet.signTransaction({chainId:BigInt(chain.id),to:BALANCER,data:cd,nonce:nonces[chain.id]++,gasLimit:900000n,type:2,maxFeePerGas:gwei,maxPriorityFeePerGas:gwei/2n})
    submit(signed)

    const net=scaled_profit*0.99999
    // Model 2: HOT[12]% to reserve (default 25%, floor 0.001%)
    const reservePct=Math.max(0.001, HOT[12]||25) / 100
    const toReserve=net*reservePct
    const toLiquid=net-toReserve

    if(HOT[13]<RESERVE_CAP){
      HOT[13]=Math.min(HOT[13]+toReserve, RESERVE_CAP)
      if(HOT[13]>=RESERVE_CAP){ HOT[12]=0; console.log('[APEX] Reserve at $5T — all Model 2 revenue now liquid') }
    } else {
      HOT[5]+=net
    }

    HOT[1]+=net; HOT[5]+=toLiquid
    HOT[6]++; HOT[7]++; HOT[15]++; HOT[9]=1
    execTotal++

    if(execTotal%100===0) console.log(`[APEX] ${execTotal} | $${(HOT[1]/1e12).toFixed(4)}T | Flash $${(effectiveFlash()/1e9).toFixed(0)}B | Reserve $${(HOT[13]/1e9).toFixed(0)}B`)
  } catch(e){ if(e.message?.includes('nonce'))nonces[chain.id]=undefined }
}

// 1ms throughput loop
function poll(){
  const head=Atomics.load(SIG_N2A,0)
  while(rHead<head){execute(rHead).catch(()=>{});rHead++}
  setImmediate(poll)
}

poll()
console.log('[APEX] VULCAN Model 2 online | 7-chain | 1ms throughput')
