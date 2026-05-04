'use client';
import { Sidebar } from '@/components/sidebar';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KeyboardShortcuts />
      <div className="flex min-h-screen bg-bg-primary">
        <Sidebar />
        <main className="ml-52 flex-1 p-6">
          {children}
        </main>
      </div>
    </>
  );
}
