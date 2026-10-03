import { NotebookPen } from "lucide-react";

const MESSAGE = "یک یادداشت را انتخاب کنید یا یک یادداشت جدید بسازید";

export function WelcomePage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      <NotebookPen className="size-10" />
      <p className="text-sm">{MESSAGE}</p>
    </div>
  );
}
