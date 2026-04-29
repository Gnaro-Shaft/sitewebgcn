export default function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 dark:text-dark-muted uppercase tracking-widest">
          Loading
        </span>
      </div>
    </div>
  );
}
