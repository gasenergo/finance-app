'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Briefcase, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createJob, deleteJob } from '@/app/actions/jobs';
import { createInvoice } from '@/app/actions/invoices';
import { formatCurrency } from '@/lib/engine/calculations';
import type { Job, Client, WorkType, Profile } from '@/types/database';

interface JobsListProps {
  initialJobs: Job[];
  clients: Client[];
  workTypes: WorkType[];
  currentUser: Profile;
}

const statusConfig = {
  available: { label: 'Свободна', variant: 'success' as const },
  invoiced: { label: 'В счёте', variant: 'warning' as const },
  paid: { label: 'Оплачена', variant: 'info' as const },
};

export function JobsList({ initialJobs, clients, workTypes, currentUser }: JobsListProps) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Form state
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [workTypeId, setWorkTypeId] = useState('custom');
  const [customWorkName, setCustomWorkName] = useState('');
  const [amount, setAmount] = useState('');

  const isAdmin = currentUser.role === 'admin';

  const filteredJobs = jobs.filter(job => 
    statusFilter === 'all' || job.status === statusFilter
  );

  const selectedJobsData = jobs.filter(j => selectedJobs.has(j.id));
  const selectedTotal = selectedJobsData.reduce((sum, j) => sum + Number(j.amount), 0);
  const selectedClientId = selectedJobsData[0]?.client_id;

  const handleSelect = (id: string, job: Job) => {
    if (job.status !== 'available') return;
    
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      if (newSelected.size === 0 || job.client_id === selectedClientId) {
        newSelected.add(id);
      }
    }
    setSelectedJobs(newSelected);
  };

  const handleCreateJob = async () => {
    if (!clientId || !description || !amount) return;
    
    setLoading(true);
    try {
      const newJob = await createJob({
        client_id: clientId,
        description,
        work_type_id: workTypeId === 'custom' ? null : workTypeId,
        custom_work_name: workTypeId === 'custom' ? customWorkName : null,
        amount: parseFloat(amount),
      });
      setJobs(prev => [newJob, ...prev]);
      setFormOpen(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Удалить работу?')) return;
    try {
      await deleteJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedClientId || selectedJobs.size === 0) return;
    try {
      await createInvoice(selectedClientId, Array.from(selectedJobs));
      setSelectedJobs(new Set());
      router.push('/invoices');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const resetForm = () => {
    setClientId('');
    setDescription('');
    setWorkTypeId('custom');
    setCustomWorkName('');
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Работы</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Новая работа
        </Button>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Все статусы" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="available">Свободные</SelectItem>
          <SelectItem value="invoiced">В счёте</SelectItem>
          <SelectItem value="paid">Оплаченные</SelectItem>
        </SelectContent>
      </Select>

      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Нет работ"
          description="Создайте первую работу"
          action={
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать работу
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => {
            const status = statusConfig[job.status];
            const canSelect = job.status === 'available' && 
              (selectedJobs.size === 0 || job.client_id === selectedClientId);
            
            return (
              <Card 
                key={job.id} 
                className={selectedJobs.has(job.id) ? 'ring-2 ring-blue-500' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-medium">{job.description}</h3>
                      <p className="text-sm text-gray-500">{job.client?.name}</p>
                    </div>
                    {job.status === 'available' && (
                      <div className="flex gap-2">
                        {canSelect && (
                          <input
                            type="checkbox"
                            checked={selectedJobs.has(job.id)}
                            onChange={() => handleSelect(job.id, job)}
                            className="h-5 w-5"
                          />
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDeleteJob(job.id)} className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <div>
                      <p className="text-sm text-gray-500">
                        {job.work_type?.name || job.custom_work_name}
                      </p>
                      <p className="text-lg font-semibold">{formatCurrency(job.amount)}</p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {job.creator?.full_name} • {new Date(job.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedJobs.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-auto z-40">
          <div className="bg-white border rounded-xl shadow-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Выбрано: {selectedJobs.size}</p>
              <p className="text-lg font-semibold">{formatCurrency(selectedTotal)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedJobs(new Set())}>Отмена</Button>
              <Button onClick={handleCreateInvoice}>
                <FileText className="h-4 w-4 mr-2" />
                Создать счёт
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая работа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Клиент</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Описание</label>
              <Input 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                placeholder="Редизайн главной страницы"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Тип работы</label>
              <Select value={workTypeId} onValueChange={(v) => {
                setWorkTypeId(v);
                const wt = workTypes.find(w => w.id === v);
                if (wt?.default_price) setAmount(String(wt.default_price));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Свой вариант</SelectItem>
                  {workTypes.map(wt => (
                    <SelectItem key={wt.id} value={wt.id}>
                      {wt.name} {wt.default_price && `(${formatCurrency(wt.default_price)})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {workTypeId === 'custom' && (
              <div>
                <label className="block text-sm font-medium mb-1">Название</label>
                <Input 
                  value={customWorkName} 
                  onChange={e => setCustomWorkName(e.target.value)}
                  placeholder="Консультация"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Сумма (₽)</label>
              <Input 
                type="number"
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="100000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Отмена</Button>
            <Button onClick={handleCreateJob} loading={loading}>Создать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}