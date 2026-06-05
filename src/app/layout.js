import './globals.css';

export const metadata = {
  title: 'SOBA-Secure | Document Access Management Platform',
  description: 'A high-fidelity secure file access platform verified dynamically through the SOBA Identity Provider, featuring encrypted metadata in SQLite and real-time security log audits.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
