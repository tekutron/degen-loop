'use client';

// Legacy compatibility shim.
// Some older imports referenced `apps/web/WalletConnect.tsx` directly.
// Keep this file, but implement using Solana Wallet Adapter.

import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function WalletConnect() {
  return <WalletMultiButton />;
}
