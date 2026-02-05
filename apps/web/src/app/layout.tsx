import { AppWalletProvider } from '@/components/WalletProvider';

export const metadata = { title: "degen-loop" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppWalletProvider>{children}</AppWalletProvider>
      </body>
    </html>
  );
}
