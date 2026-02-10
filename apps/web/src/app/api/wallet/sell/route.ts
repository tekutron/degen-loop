import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const WSOL = 'So11111111111111111111111111111111111111112';
const SWAP_SCRIPT = '/home/j/.openclaw/workspace/jupbot/sdkSwap.mjs';

export async function POST(req: Request) {
  try {
    const { mint } = await req.json();
    
    if (!mint) {
      return NextResponse.json({ error: 'Missing mint' }, { status: 400 });
    }

    // Don't allow selling SOL/wSOL
    if (mint === 'So11111111111111111111111111111111111111112' || mint === '11111111111111111111111111111111') {
      return NextResponse.json({ error: 'Cannot sell SOL' }, { status: 400 });
    }

    const rpc = process.env.HELIUS_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC;
    if (!rpc) {
      return NextResponse.json({ error: 'No RPC configured' }, { status: 500 });
    }

    // Use sdkSwap.mjs to sell 100% of token to wSOL
    const env = {
      ...process.env,
      HELIUS_RPC_URL: rpc,
      SWAP_WALLET: '/home/j/.openclaw/workspace/jupbot/wallets/generated_keypair.json',
      INPUT_MINT: mint,
      OUTPUT_MINT: WSOL,
      AMOUNT_LAMPORTS: '0', // Special: 0 means sell 100%
      SLIPPAGE_BPS: '300',
      FORCE_JUPITER: '1',
    };

    // Execute the swap
    const { stdout, stderr } = await execAsync(`node ${SWAP_SCRIPT}`, {
      env,
      cwd: '/home/j/.openclaw/workspace/jupbot',
      timeout: 60000,
    });

    // Parse transaction signature from output
    const txMatch = stdout.match(/TX IDs?: \[(.*?)\]/i) || stdout.match(/([1-9A-HJ-NP-Za-km-z]{87,88})/);
    const signature = txMatch ? (txMatch[1] || txMatch[0]).replace(/['"]/g, '').trim() : null;

    if (!signature) {
      return NextResponse.json({
        error: 'Swap completed but no signature found',
        stdout: stdout.slice(-500),
        stderr: stderr.slice(-500),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
    });
  } catch (e: any) {
    console.error('POST /api/wallet/sell error:', e);
    
    // Check if it's an exec error with output
    if (e.stdout || e.stderr) {
      return NextResponse.json({
        error: e.message || 'Swap failed',
        stdout: e.stdout?.slice(-500),
        stderr: e.stderr?.slice(-500),
      }, { status: 500 });
    }
    
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
