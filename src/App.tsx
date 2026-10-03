import { ThemeToggle } from "@/components/theme-toggle";

function App() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Physically top-left. Swap `left-0` for `start-0` to follow the RTL
          text direction instead (which would move it to the right edge). */}
      <div className="absolute top-0 left-0 p-2">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default App;
