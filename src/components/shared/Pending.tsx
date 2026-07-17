import { Empty } from '@/components/ui/Empty';

/** Temporary placeholder for routes whose pages land in a later build step. */
export default function Pending({ step }: { step: string }) {
  return <Empty title={`lands at ${step}`} hint="This page is next in the build order." />;
}
