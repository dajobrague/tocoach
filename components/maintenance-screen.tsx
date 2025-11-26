"use client";

import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Link } from "@heroui/link";

import { useTenant } from "@/components/tenant-provider";

export interface MaintenanceScreenProps {
  tenantSlug: string;
  tenantName: string;
  maintenanceReason?: string;
  maintenanceUntil?: string;
}

export function MaintenanceScreen({
  tenantSlug,
  tenantName,
  maintenanceReason,
  maintenanceUntil,
}: MaintenanceScreenProps) {
  const tenant = useTenant();

  const handleRetry = () => {
    window.location.reload();
  };

  const formatMaintenanceUntil = (until?: string) => {
    if (!until) return null;
    try {
      const date = new Date(until);

      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch {
      return until;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        {/* Branded Logo */}
        <div className="text-center mb-8">
          <img
            alt={`${tenantName} Logo`}
            className="h-16 w-auto mx-auto mb-4"
            src={`/brands/${tenantSlug}/logo.svg`}
            onError={(e) => {
              // Fallback to default logo if tenant logo missing
              e.currentTarget.src = "/brands/default/logo.svg";
            }}
          />
          <h1 className="text-2xl font-heading text-primary font-bold">
            {tenantName}
          </h1>
        </div>

        {/* Maintenance Message */}
        <Card className="bg-surface-1 shadow-e2">
          <CardBody className="text-center space-y-6 p-8">
            <div className="space-y-3">
              <h2 className="text-xl font-heading text-primary">
                Temporarily Unavailable
              </h2>

              <p className="text-secondary font-body">
                {maintenanceReason ||
                  "This trainer's app is temporarily unavailable for maintenance."}
              </p>

              {maintenanceUntil && (
                <p className="text-sm text-secondary font-body">
                  Expected to return: {formatMaintenanceUntil(maintenanceUntil)}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button
                className="font-body"
                color="primary"
                size="lg"
                onClick={handleRetry}
              >
                Try Again
              </Button>

              <Button
                isExternal
                as={Link}
                className="font-body"
                color="default"
                href={`mailto:support@${tenantSlug}.com?subject=App Access Issue`}
                size="lg"
                variant="bordered"
              >
                Contact Coach
              </Button>
            </div>

            {/* Optional Status Link */}
            <div className="pt-4 border-t border-default-200">
              <Link
                className="text-xs text-secondary font-body"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Could link to status page in the future
                }}
              >
                Status Updates
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-secondary font-body">
            Powered by TopCoach Platform
          </p>
        </div>
      </div>
    </div>
  );
}
