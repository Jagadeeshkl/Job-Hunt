import { Construction } from 'lucide-react';

export function PagePlaceholder({
  title, description, icon: Icon = Construction, note,
}: {
  title: string; description: string; icon?: React.ElementType; note?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="card grid place-items-center gap-3 py-24 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <p className="font-display text-lg font-semibold text-foreground">Coming up next</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {note ?? 'This section is being built — layout and data wiring land in the next pass.'}
        </p>
      </div>
    </div>
  );
}
