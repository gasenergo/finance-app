'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ArrowRightLeft, Briefcase, FileText, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Движение ДС', href: '/cashflow', icon: ArrowRightLeft },
  { name: 'Работы', href: '/jobs', icon: Briefcase },
  { name: 'Счета', href: '/invoices', icon: FileText },
  { name: 'Настройки', href: '/admin', icon: Settings, adminOnly: true },
];

interface SidebarProps {
  isAdmin: boolean;
  userName: string;
}

export function Sidebar({ isAdmin, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
      <div className="flex flex-col flex-grow pt-5 pb-4">
        <div className="px-4 mb-8">
          <span className="text-xl font-bold">💰 FinTrack</span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {navigation
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <item.icon className={cn('mr-3 h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-400')} />
                  {item.name}
                </Link>
              );
            })}
        </nav>
        <div className="px-2 py-4 border-t">
          <div className="px-3 py-2 text-sm text-gray-500">{userName}</div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400" />
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}