'use client';

import { useMemo } from 'react';
import { useWallets, useWallet } from '@wallet-standard/react';

export function WalletConnect() {
  const wallets = useWallets();
  const { account, connect, disconnect } = useWallet();

  const phantom = useMemo(
    () => wallets.find((w) => w.name.toLowerCase().includes('phantom')),
    [wallets]
  );

  if (!phantom) return <div style={{ fontSize: 12 }}>Install Phantom.</div>;

  return account ? (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ fontSize: 12 }}>
        {account.address.slice(0, 4)}…{account.address.slice(-4)}
      </div>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  ) : (
    <button onClick={() => connect(phantom)}>Connect Phantom</button>
  );
}
