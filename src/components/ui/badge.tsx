import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-bg-secondary text-text-secondary',
        screening: 'bg-indigo-100 text-indigo-700',
        written_test: 'bg-purple-100 text-purple-700',
        interview: 'bg-amber-100 text-amber-700',
        offer: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700',
        withdrawn: 'bg-gray-100 text-gray-600',
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-emerald-100 text-emerald-700',
        red: 'bg-red-100 text-red-700',
        yellow: 'bg-amber-100 text-amber-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_LABELS: Record<string, string> = {
  screening: '笔试中',
  written_test: '笔试中',
  interview: '面试中',
  offer: '已 offer',
  rejected: '已拒绝',
  withdrawn: '已撤回',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status as BadgeProps['variant']}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
