interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-content-muted">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3 mt-3 sm:mt-0">{children}</div>}
    </div>
  );
}