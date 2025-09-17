"use client";

import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Chip } from "@heroui/chip";

export default function Home() {
  return (
    <section className="flex flex-col gap-6 py-4">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-heading text-primary">
          TopCoach Platform
        </h1>
        <p className="text-secondary font-body">
          Multi-tenant personal training platform with dynamic theming
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
            <p className="text-secondary text-sm">
              Switch brands using the buttons in the navbar to see dynamic
              theming in action.
            </p>

            <div className="flex gap-2 flex-wrap">
              <Chip className="bg-brand text-white">Brand Color</Chip>
              <Chip className="bg-accent text-white">Accent Color</Chip>
              <Chip className="bg-fill text-primary">Fill Color</Chip>
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
              <Button className="bg-brand text-white rounded-theme-md">
                Primary Button
              </Button>
              <Button className="bg-surface-1 text-primary border border-theme rounded-theme-md">
                Secondary Button
              </Button>
            </div>

            <Input
              className="max-w-full"
              classNames={{
                input: "text-primary",
                label: "text-secondary",
              }}
              label="Sample Input"
              placeholder="Type something..."
            />

            <Textarea
              className="max-w-full"
              classNames={{
                input: "text-primary",
                label: "text-secondary",
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

            <div className="p-4 bg-fill rounded-theme-lg border border-theme">
              <p className="text-primary text-sm">
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
            <p className="text-secondary text-sm mb-4">
              This interface is optimized for mobile devices. On desktop,
              you&apos;ll see it centered in a mobile-sized frame with
              device-like styling.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-brand/10 p-3 rounded-theme-sm text-center">
                <p className="text-brand text-xs font-medium">Brand Tint</p>
              </div>
              <div className="bg-accent/10 p-3 rounded-theme-sm text-center">
                <p className="text-accent text-xs font-medium">Accent Tint</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="bg-surface-1 shadow-e1 border border-theme">
        <CardBody className="text-center space-y-2">
          <h4 className="font-heading text-primary text-sm">Try It Out!</h4>
          <p className="text-secondary text-xs">
            Use the brand switcher in the navbar or try these URLs:
          </p>
          <div className="flex flex-col gap-1 text-xs">
            <Link className="text-brand" href="?brand=default">
              ?brand=default
            </Link>
            <Link className="text-brand" href="?brand=ironfit">
              ?brand=ironfit
            </Link>
            <Link className="text-brand" href="?brand=zen-coach">
              ?brand=zen-coach
            </Link>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
