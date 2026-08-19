import { createFileRoute } from "@tanstack/react-router";
import { WindScape } from "@/components/WindScape";

export const Route = createFileRoute("/wind-test")({
  component: () => (
    <div className="relative min-h-screen">
      <WindScape fixed={false} />
    </div>
  ),
});
