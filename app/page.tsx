"use client";

import { useIsDefaultTenant, useTenant, useTenantName } from "@/components/tenant-provider";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Link } from "@heroui/link";

export default function Home() {
  const tenant = useTenant();
  const tenantName = useTenantName();
  const isDefaultTenant = useIsDefaultTenant();

  return (
    <section className="flex flex-col gap-6 py-4">

      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-heading text-primary">
          {tenant?.theme_json?.meta?.name || tenantName || "TopCoach"} Platform
        </h1>
        <p className="text-secondary font-body">
          {isDefaultTenant
            ? "Multi-tenant personal training platform with dynamic theming"
            : `Professional training platform powered by ${tenant?.theme_json?.meta?.name || tenantName}`
          }
        </p>
      </div>

      {/* Theme Demo Cards */}
      <div className="grid gap-4">
        <Card className="bg-surface-1 shadow-e1">
          <CardHeader>
            <h3 className="text-lg font-heading text-primary">
              Brand Theming Demo
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-secondary text-sm font-body">
              {isDefaultTenant
                ? "Switch brands using the buttons in the navbar to see dynamic theming in action."
                : `Experience the ${tenant?.theme_json?.meta?.name || tenantName} brand with custom colors, fonts, and styling.`
              }
            </p>

            <div className="flex gap-2 flex-wrap">
              <Chip color="primary">Brand Color</Chip>
              <Chip color="secondary">Accent Color</Chip>
              <Chip color="default">Fill Color</Chip>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface-2 shadow-e1">
          <CardHeader>
            <h3 className="text-lg font-heading text-primary">
              Interactive Elements
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button color="primary">
                Primary Button
              </Button>
              <Button color="default" variant="bordered">
                Secondary Button
              </Button>
            </div>

            <Input
              className="max-w-full"
              classNames={{
                input: "text-foreground font-body",
                label: "text-secondary font-body",
              }}
              label="Sample Input"
              placeholder="Type something..."
            />

            <Textarea
              className="max-w-full"
              classNames={{
                input: "text-foreground font-body",
                label: "text-secondary font-body",
              }}
              label="Sample Textarea"
              placeholder="Enter your message..."
            />
          </CardBody>
        </Card>

        <Card className="bg-surface-1 shadow-e2">
          <CardHeader>
            <h3 className="text-lg font-heading text-primary">
              Typography & Spacing
            </h3>
          </CardHeader>
          <CardBody className="space-y-3">
            <div>
              <h4 className="font-heading text-primary text-base">
                Heading Font
              </h4>
              <p className="font-body text-secondary text-sm">
                This text uses the theme&apos;s body font family and secondary
                color.
              </p>
            </div>

            <div className="p-4 bg-default-100 rounded-large border border-default-300">
              <p className="text-foreground text-sm font-body">
                This container uses theme radius, fill color, and border
                styling.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-surface-2 shadow-e1">
          <CardHeader>
            <h3 className="text-lg font-heading text-primary">
              Mobile-First Design
            </h3>
          </CardHeader>
          <CardBody>
            <p className="text-secondary text-sm mb-4 font-body">
              This interface is optimized for mobile devices. On desktop,
              you&apos;ll see it centered in a mobile-sized frame with
              device-like styling.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary/10 p-3 rounded-small text-center">
                <p className="text-white text-xs font-medium font-body">Brand Tint</p>
              </div>
              <div className="bg-secondary/10 p-3 rounded-small text-center">
                <p className="text-primary text-xs font-medium font-body">Accent Tint</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Instructions */}
      {isDefaultTenant && (
        <Card className="bg-surface-1 shadow-e1 border border-theme-border">
          <CardBody className="text-center space-y-2">
            <h4 className="font-heading text-primary text-sm">Try It Out!</h4>
            <p className="text-secondary text-xs font-body">
              Use the brand switcher in the navbar or try these URLs:
            </p>
            <div className="flex flex-col gap-1 text-xs">
              <Link className="text-primary" href="?brand=default">
                ?brand=default
              </Link>
              <Link className="text-primary" href="?brand=ironfit">
                ?brand=ironfit
              </Link>
              <Link className="text-primary" href="?brand=zen-coach">
                ?brand=zen-coach
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </section>
  );
}
