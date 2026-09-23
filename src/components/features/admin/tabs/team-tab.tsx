'use client';

import { Edit, Key, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/engine/calculations';
import type { TeamMember } from '@/types/database';

export function TeamTab({
  team,
  onAddUser,
  onEditUser,
  onResetPassword
}: {
  team: TeamMember[];
  onAddUser: () => void;
  onEditUser: (user: TeamMember) => void;
  onResetPassword: (userId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Команда</CardTitle>
        <Button size="sm" onClick={onAddUser}>
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {team.map(user => (
            <div
              key={user.id}
              className={`p-4 rounded-lg border ${user.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.full_name}</span>
                    <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                      {user.role === 'admin' ? 'Админ' : 'Юзер'}
                    </Badge>
                    {user.participant_type && (
                      <Badge variant={user.participant_type === 'partner' ? 'success' : 'warning'}>
                        {user.participant_type === 'partner' ? 'Партнёр' : `${user.percentage_rate}%`}
                      </Badge>
                    )}
                    {!user.is_active && (
                      <Badge variant="error">Неактивен</Badge>
                    )}
                  </div>
                  {user.balance && user.balance[0] && (
                    <p className="text-sm text-gray-500 mt-1">
                      Баланс: {formatCurrency(user.balance[0].available_amount)} •
                      Заработано: {formatCurrency(user.balance[0].total_earned)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEditUser(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onResetPassword(user.id)}>
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
