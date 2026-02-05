import { AppWalletProvider } from '@/components/WalletProvider';
import { Toaster } from 'react-hot-toast';

export const metadata = { title: 'degen-loop' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppWalletProvider>
          <Toaster position="top-right" />
          {children}
        </AppWalletProvider>
      </body>
    </html>
  );
}
