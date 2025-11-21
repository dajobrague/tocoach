"use client";

import { Button, Form, Input, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";

interface ForgotPasswordFormProps {
  tenantSlug: string;
}

export function ForgotPasswordForm({ tenantSlug }: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tenantSlug }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send reset email");
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-large bg-content1 shadow-small p-8">
        <div className="flex items-center gap-3 mb-4">
          <Icon
            className="text-success text-3xl"
            icon="solar:check-circle-bold"
          />
          <h3 className="text-lg font-semibold font-heading">
            Check Your Email
          </h3>
        </div>
        <p className="text-default-600 mb-4 font-body">
          If an account exists with that email, you&apos;ll receive password
          reset instructions.
        </p>
        <Link className="text-primary font-body" href={`/${tenantSlug}/login`}>
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-large bg-content1 shadow-small p-8">
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 mb-4">
          <p className="text-danger text-sm font-body">{error}</p>
        </div>
      )}

      <Form
        className="flex flex-col gap-4"
        validationBehavior="native"
        onSubmit={handleSubmit}
      >
        <Input
          isRequired
          className="font-body"
          label="Email Address"
          name="email"
          placeholder="Enter your email"
          type="email"
          variant="bordered"
        />

        <Button
          className="w-full mt-2"
          color="primary"
          disabled={isLoading}
          isLoading={isLoading}
          size="lg"
          type="submit"
        >
          Send Reset Link
        </Button>
      </Form>

      <div className="mt-4 text-center">
        <Link className="font-body" href={`/${tenantSlug}/login`} size="sm">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
