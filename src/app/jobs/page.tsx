import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getJobs } from '@/app/actions/jobs';
import { getClients, getWorkTypes } from '@/app/actions/references';
import { AppLayout } from '@/components/layout/app-layout';
import { JobsList } from '@/components/features/jobs/jobs-list';

export default async function JobsPage() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    redirect('/login');
  }
  
  const [jobs, clients, workTypes] = await Promise.all([
    getJobs(),
    getClients(),
    getWorkTypes(),
  ]);
  
  return (
    <AppLayout isAdmin={currentUser.role === 'admin'} userName={currentUser.full_name}>
      <JobsList
        initialJobs={jobs}
        clients={clients}
        workTypes={workTypes}
        currentUser={currentUser}
      />
    </AppLayout>
  );
}