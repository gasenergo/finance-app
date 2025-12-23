'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowRightLeft, Briefcase, FileText, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'ДДС', href: '/cashflow', icon: ArrowRightLeft },
  { name: 'Работы', href: '/jobs', icon: Briefcase },
  { name: 'Счета', href: '/invoices', icon: FileText },
  { name: 'Ещё', href: '/menu', icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="flex justify-around">
        {navigation.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn('flex flex-col items-center py-2 px-3 text-xs', isActive ? 'text-blue-600' : 'text-gray-500')}
            >
              <item.icon className="h-6 w-6 mb-1" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}