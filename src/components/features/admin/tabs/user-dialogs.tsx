'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { TeamMember } from '@/types/database';

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  user: TeamMember | null;
  onSave: (data: {
    email?: string;
    password?: string;
    full_name: string;
    role: 'admin' | 'user';
    participant_type: 'partner' | 'percentage' | null;
    percentage_rate: number | null;
    is_active: boolean;
  }) => void;
  loading: boolean;
}

export function UserDialog({ open, ...props }: UserDialogProps) {
  return open ? <UserDialogContent open={open} {...props} /> : null;
}

function UserDialogContent({
  open,
  onClose,
  user,
  onSave,
  loading
}: UserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [role, setRole] = useState<'admin' | 'user'>(user?.role || 'user');
  const [participantType, setParticipantType] = useState<'partner' | 'percentage' | 'none'>(user?.participant_type || 'none');
  const [percentageRate, setPercentageRate] = useState(user?.percentage_rate ? String(user.percentage_rate) : '');
  const [isActive, setIsActive] = useState(user?.is_active ?? true);

  const handleSave = () => {
    onSave({
      email,
      password,
      full_name: fullName,
      role,
      participant_type: participantType === 'none' ? null : participantType,
      percentage_rate: participantType === 'percentage' ? parseFloat(percentageRate) : null,
      is_active: isActive
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Редактировать' : 'Новый'} участник</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!user && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Пароль</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Имя</label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Иван Иванов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Роль в системе</label>
            <Select value={role} onValueChange={(v: 'admin' | 'user') => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Пользователь</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Тип участника</label>
            <Select
              value={participantType}
              onValueChange={(v: 'partner' | 'percentage' | 'none') => setParticipantType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не участвует в распределении</SelectItem>
                <SelectItem value="partner">Партнёр (равная доля)</SelectItem>
                <SelectItem value="percentage">Процентник</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {participantType === 'percentage' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Процент (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={percentageRate}
                onChange={e => setPercentageRate(e.target.value)}
                placeholder="15"
              />
            </div>
          )}

          {user && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm">Активен</label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={!fullName || (!user && (!email || !password))}
          >
            {user ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PasswordDialog({
  open,
  onClose,
  onSave,
  loading
}: {
  open: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Сменить пароль</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Новый пароль</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Подтверждение</label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {password && confirm && password !== confirm && (
            <p className="text-sm text-red-500">Пароли не совпадают</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={() => {
              onSave(password);
              setPassword('');
              setConfirm('');
            }}
            loading={loading}
            disabled={!password || password !== confirm || password.length < 6}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
