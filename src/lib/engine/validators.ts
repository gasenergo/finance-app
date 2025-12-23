import { z } from 'zod';

export const createJobSchema = z.object({
  client_id: z.string().uuid('Выберите клиента'),
  description: z.string().min(1, 'Введите описание'),
  work_type_id: z.string().uuid().nullable(),
  custom_work_name: z.string().nullable(),
  amount: z.number().positive('Сумма должна быть больше 0'),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;