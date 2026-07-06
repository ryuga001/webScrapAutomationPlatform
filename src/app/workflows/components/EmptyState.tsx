interface EmptyStateProps {
  query: string;
}

// Shown when a search yields no matching workflows.
export function EmptyState({ query }: EmptyStateProps) {
  return (
    <p className="mt-6 text-on-surface-variant">No workflows match “{query}”.</p>
  );
}
