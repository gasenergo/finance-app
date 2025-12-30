// src/components/features/invoices/invoices-list.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Eye,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  updateInvoiceStatus, 
  markInvoiceAsPaid, 
  deleteInvoice 
} from '@/app/actions/invoices';
import { formatCurrency } from '@/lib/engine/calculations';
import type { Client, Profile } from '@/types/database';
import type { DistributionBreakdown } from '@/lib/engine/distribution';

interface InvoiceWithRelations {
  id: string;
  invoice_number: string;
  client_id: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  paid_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  client: Client | null;
  creator: Profile | null;
  jobs?: Array<{
    job: {
      id: string;
      description: string;
      amount: number;
      work_type?: { name: string } | null;
      custom_work_name?: string | null;
    };
  }>;
}

interface ParticipantOption {
  id: string;
  full_name: string;
  participant_type: 'partner' | 'percentage';
  percentage_rate: number | null;
}

interface InvoicesListProps {
  initialInvoices: InvoiceWithRelations[];
  clients: Client[];
  currentUser: Profile;
  participants: ParticipantOption[];
}

const statusConfig = {
  draft: { label: 'Черновик', variant: 'default' as const, icon: FileText },
  sent: { label: 'Выставлен', variant: 'warning' as const, icon: Send },
  paid: { label: 'Оплачен', variant: 'success' as const, icon: CheckCircle },
  cancelled: { label: 'Отменён', variant: 'error' as const, icon: XCircle },
};

export function InvoicesList({ initialInvoices, clients, currentUser, participants }: InvoicesListProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // Детали счёта
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRelations | null>(null);
  
  // Результат распределения
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<DistributionBreakdown | null>(null);

  // Диалог оплаты с выбором участников
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceWithRelations | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());

  const isAdmin = currentUser.role === 'admin';

  const filteredInvoices = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchClient = clientFilter === 'all' || inv.client_id === clientFilter;
    return matchStatus && matchClient;
  });

  // Статистика
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length,
  };

  const handleStatusChange = async (invoiceId: string, newStatus: 'draft' | 'sent' | 'cancelled') => {
    setLoading(invoiceId);
    setError('');
    
    try {
      await updateInvoiceStatus(invoiceId, newStatus);
      setInvoices(prev => prev.map(inv => 
        inv.id === invoiceId 
          ? { ...inv, status: newStatus }
          : inv
      ));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении');
    } finally {
      setLoading(null);
    }
  };

  const handleOpenPaymentDialog = (invoice: InvoiceWithRelations) => {
    setSelectedInvoiceForPayment(invoice);
    setSelectedParticipants(new Set(participants.map(p => p.id)));
    setError('');
    setPaymentDialogOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoiceForPayment || selectedParticipants.size === 0) return;
    
    setLoading(selectedInvoiceForPayment.id);
    setError('');
    
    try {
      const result = await markInvoiceAsPaid(
        selectedInvoiceForPayment.id, 
        Array.from(selectedParticipants)
      );
      
      setInvoices(prev => prev.map(inv => 
        inv.id === selectedInvoiceForPayment.id 
          ? { ...inv, status: 'paid' as const, paid_at: new Date().toISOString() }
          : inv
      ));
      
      setPaymentDialogOpen(false);
      setSelectedInvoiceForPayment(null);
      
      if (result.breakdown) {
        setBreakdown(result.breakdown);
        setBreakdownOpen(true);
      }
      
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при оплате');
    } finally {
      setLoading(null);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Удалить счёт? Работы вернутся в статус "Свободные".')) {
      return;
    }
    
    setLoading(invoiceId);
    setError('');
    
    try {
      await deleteInvoice(invoiceId);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении');
    } finally {
      setLoading(null);
    }
  };

  const openDetails = (invoice: InvoiceWithRelations) => {
    setSelectedInvoice(invoice);
    setDetailsOpen(true);
  };

  // Уникальные клиенты для фильтра
  const clientsInInvoices = [...new Map(
    invoices.map(inv => [inv.client_id, { id: inv.client_id, name: inv.client?.name }])
  ).values()];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Счета</h1>
        <p className="text-sm text-gray-500 mt-1">
          Всего: {stats.total} • Черновиков: {stats.draft} • Выставлено: {stats.sent} • Оплачено: {stats.paid}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="draft">Черновики</SelectItem>
            <SelectItem value="sent">Выставленные</SelectItem>
            <SelectItem value="paid">Оплаченные</SelectItem>
            <SelectItem value="cancelled">Отменённые</SelectItem>
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Все клиенты" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все клиенты</SelectItem>
            {clientsInInvoices.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Нет счетов"
          description={statusFilter !== 'all' ? 'Попробуйте изменить фильтр' : 'Создайте счёт из раздела "Работы"'}
        />
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => {
            const status = statusConfig[invoice.status];
            const StatusIcon = status.icon;
            const isLoading = loading === invoice.id;
            
            return (
              <Card key={invoice.id} className={isLoading ? 'opacity-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium">
                          {invoice.invoice_number}
                        </span>
                        <Badge variant={status.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-gray-600">{invoice.client?.name}</p>
                      <p className="text-sm text-gray-400">
                        {invoice.jobs?.length || 0} работ • 
                        Создан {new Date(invoice.created_at).toLocaleDateString('ru-RU')}
                        {invoice.paid_at && (
                          <> • Оплачен {new Date(invoice.paid_at).toLocaleDateString('ru-RU')}</>
                        )}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(invoice)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {isAdmin && invoice.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(invoice.id, 'sent')}
                            disabled={isLoading}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Выставить
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(invoice.id)}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {isAdmin && invoice.status === 'sent' && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleOpenPaymentDialog(invoice)}
                            disabled={isLoading}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Оплачено
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                            disabled={isLoading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invoice Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Счёт {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Клиент</p>
                  <p className="font-medium">{selectedInvoice.client?.name}</p>
                </div>
                <Badge variant={statusConfig[selectedInvoice.status].variant}>
                  {statusConfig[selectedInvoice.status].label}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Работы в счёте</p>
                <div className="space-y-2">
                  {selectedInvoice.jobs?.map(({ job }) => (
                    <div 
                      key={job.id}
                      className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{job.description}</p>
                        <p className="text-xs text-gray-500">
                          {job.work_type?.name || job.custom_work_name}
                        </p>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(job.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Итого</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(selectedInvoice.total_amount)}
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>Создал: {selectedInvoice.creator?.full_name}</p>
                <p>Дата: {new Date(selectedInvoice.created_at).toLocaleDateString('ru-RU')}</p>
                {selectedInvoice.paid_at && (
                  <p>Оплачен: {new Date(selectedInvoice.paid_at).toLocaleDateString('ru-RU')}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Participants Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оплата счёта {selectedInvoiceForPayment?.invoice_number}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Сумма</p>
              <p className="text-2xl font-bold">
                {selectedInvoiceForPayment && formatCurrency(selectedInvoiceForPayment.total_amount)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Участники проекта:</p>
              <div className="space-y-2">
                {participants.map(p => (
                  <label 
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedParticipants.has(p.id)}
                      onChange={() => toggleParticipant(p.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                    <Badge variant={p.participant_type === 'partner' ? 'default' : 'warning'}>
                      {p.participant_type === 'partner' ? 'Партнёр' : `${p.percentage_rate}%`}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            {selectedParticipants.size === 0 && (
              <p className="text-sm text-red-500">Выберите хотя бы одного участника</p>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={selectedParticipants.size === 0 || loading !== null}
              loading={loading === selectedInvoiceForPayment?.id}
            >
              Подтвердить оплату
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution Breakdown Dialog */}
      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Счёт оплачен!
            </DialogTitle>
          </DialogHeader>
          
          {breakdown && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Прибыль распределена между участниками:
              </p>

              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Сумма счёта</span>
                  <span className="font-medium">{formatCurrency(breakdown.grossAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-red-600">
                  <span>Налоги ({((breakdown.taxAmount / breakdown.grossAmount) * 100).toFixed(0)}%)</span>
                  <span>-{formatCurrency(breakdown.taxAmount)}</span>
                </div>
                {breakdown.fundContribution > 0 && (
                  <div className="flex justify-between py-2 border-b text-yellow-600">
                    <span>В фонд</span>
                    <span>-{formatCurrency(breakdown.fundContribution)}</span>
                  </div>
                )}
              </div>

              {breakdown.percentagePayments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Процентникам:</p>
                  {breakdown.percentagePayments.map(p => (
                    <div key={p.userId} className="flex justify-between py-1">
                      <span>{p.userName}</span>
                      <span className="text-green-600">+{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {breakdown.partnerPayments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Партнёрам:</p>
                  {breakdown.partnerPayments.map(p => (
                    <div key={p.userId} className="flex justify-between py-1">
                      <span>{p.userName}</span>
                      <span className="text-green-600">+{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between font-medium">
                  <span>Всего распределено</span>
                  <span className="text-green-600">
                    {formatCurrency(breakdown.totalDistributed)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Баланс фонда: {formatCurrency(breakdown.newFundBalance)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setBreakdownOpen(false)}>
              Отлично!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}