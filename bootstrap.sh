bash
set -e

Create directories

mkdir -p apps/web/src/app/{dashboard,markets,proposals,positions,settings}
mkdir -p apps/web/src/{components,lib/solana,lib/raydium,lib/storage}
mkdir -p packages/strategy-core/src/{executors,types}

Root workspace files

cat > package.json <<'JSON'
{
"name": "degen-loop",
"private": true,
"workspaces": ["apps/", "packages/"],
"scripts": {
"dev": "pnpm --filter @degen/web dev",
"build": "pnpm --filter @degen/web build",
"start": "pnpm --filter @degen/web start"
}
}
JSON

cat > pnpm-workspace.yaml <<'YAML'
packages:

• "apps/*"
• "packages/*"
YAML
cat > LICENSE <<'TXT'
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
TXT

cat > README.md (http://readme.md/) <<'MD'

degen-loop (M1)

Next.js app + Solana kit scaffold for a degen trading loop UI.

• Next.js (App Router)
• wallet-standard + ConnectorKit
• @solana/client + @solana/react-hooks
• @solana/kit for RPC/transactions
• Raydium compute quoting (skeleton)
• strategy-core (types/executors)
Getting Started

1. Copy apps/web/.env.example to apps/web/.env.local and set NEXT_PUBLIC_SOLANA_RPC
2. pnpm install
3. pnpm dev
Deploy to Vercel; add NEXT_PUBLIC_SOLANA_RPC in project env.
MD

App package

mkdir -p apps/web

cat > apps/web/package.json <<'JSON'
{
"name": "@degen/web",
"private": true,
"scripts": {
"dev": "next dev -p 3000",
"build": "next build",
"start": "next start -p 3000"
},
"dependencies": {
"next": "14.2.4",
"react": "18.2.0",
"react-dom": "18.2.0",
"zod": "^3.22.4"
}
}
JSON

cat > apps/web/next.config.mjs <<'JS'
const nextConfig = { reactStrictMode: true };
export default nextConfig;
JS

cat > apps/web/.env.example <<'ENV'
NEXT_PUBLIC_SOLANA_RPC=
NEXT_PUBLIC_CLUSTER=mainnet
NEXT_PUBLIC_APP_NAME=Signal Mesh Degen
ENV

App layout & pages

cat > apps/web/src/app/layout.tsx <<'TSX'
export const metadata = { title: "degen-loop" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
return (<html lang="en"><body>{children}</body></html>);
}
TSX

cat > apps/web/src/app/page.tsx <<'TSX'
export default function Page() { return <div style={{padding:16}}>home (M1 scaffold)</div>; }
TSX

for p in dashboard markets proposals positions settings; do
cat > apps/web/src/app/$p/page.tsx <<'TSX'
export default function Page() {
return <div style={{padding:16}}>page (M1 scaffold)</div>;
}
TSX
done

Components & libs

cat > apps/web/src/components/WalletConnect.tsx <<'TSX'
'use client';
export default function WalletConnect() { return <button>Connect Wallet (stub)</button>; }
TSX

cat > apps/web/src/lib/solana/kit.ts <<'TS'
export function initSolana() {
const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
if (!rpc) console.warn('NEXT_PUBLIC_SOLANA_RPC not set');
return { rpc };
}
TS

cat > apps/web/src/lib/raydium/quote.ts <<'TS'
export type ComputeQuote = { amountOut: string; otherAmountThreshold: string };
export async function getComputeQuote(_args: any): Promise<ComputeQuote> {
return { amountOut: '0', otherAmountThreshold: '0' };
}
TS

cat > apps/web/src/lib/storage/types.ts <<'TS'
import { z } from 'zod';
export const Proposal = z.object({ id: z.string(), pair: z.string(), slippageBps: z.number() });
export const Position = z.object({ mint: z.string(), amountRaw: z.string() });
export type TProposal = z.infer<typeof Proposal>;
export type TPosition = z.infer<typeof Position>;
TS

strategy-core package

mkdir -p packages/strategy-core

cat > packages/strategy-core/package.json <<'JSON'
{
"name": "@degen/strategy-core",
"private": true,
"version": "0.1.0",
"main": "dist/index.js",
"types": "dist/index.d.ts",
"scripts": { "build": "tsc -p tsconfig.json" },
"devDependencies": { "typescript": "^5.4.2" }
}
JSON

cat > packages/strategy-core/tsconfig.json <<'JSON'
{
"compilerOptions": {
"target": "ES2020",
"module": "ESNext",
"declaration": true,
"outDir": "dist",
"strict": true,
"moduleResolution": "Bundler",
"skipLibCheck": true
},
"include": ["src/**/*"]
}
JSON

cat > packages/strategy-core/src/types/index.ts <<'TS'
export type Proposal = { id: string; pair: string; slippageBps: number };
export type Position = { mint: string; amountRaw: string };
TS

cat > packages/strategy-core/src/executors/swap.ts <<'TS'
import type { Proposal } from "../types";
export async function executeSwap(_p: Proposal): Promise<{ tx: string }> {
return { tx: '' };
}
TS

Commit

git add .
git commit -m "feat: M1 scaffold (Next.js + wallet stubs + solana kit init + strategy-core types)"
