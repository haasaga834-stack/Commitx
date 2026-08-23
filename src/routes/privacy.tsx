import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyRedirect,
});

function PrivacyRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/privacy-policy", replace: true });
  }, [navigate]);
  return null;
}
