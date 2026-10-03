import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex min-h-screen flex-col items-start gap-4 bg-background p-8 text-foreground">
      <h1 className="font-heading text-3xl font-bold">note-app</h1>
      <p className="text-muted-foreground">
        اپلیکیشن یادداشت‌برداری با React، TypeScript و Vite
      </p>
      <div className="flex gap-2">
        <Button>یادداشت جدید</Button>
        <Button variant="outline">تنظیمات</Button>
      </div>
    </main>
  );
}

export default App;
