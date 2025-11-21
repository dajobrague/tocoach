"use client";

import { Button, Form, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import React from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isVisible, setIsVisible] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [success, setSuccess] = React.useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const newPassword = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);

      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setIsLoading(false);

      return;
    }

    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);

      // Extract slug from pathname (e.g., /ironfit/reset-password -> ironfit)
      const slug = pathname.split("/")[1] || "";

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push(`/${slug}/login`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <div className="rounded-large bg-content1 shadow-small p-8 text-center">
            <Icon
              className="text-success text-6xl mx-auto mb-4"
              icon="solar:check-circle-bold"
            />
            <h2 className="text-2xl font-heading font-bold mb-2">
              Password Reset!
            </h2>
            <p className="text-default-600 font-body">
              Your password has been successfully reset. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center pb-8">
          <h1 className="text-3xl font-heading font-bold mb-4">
            Set New Password
          </h1>
          <p className="text-default-500 font-body text-center">
            Choose a strong password for your account
          </p>
        </div>

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
              endContent={
                <button type="button" onClick={toggleVisibility}>
                  {isVisible ? (
                    <Icon
                      className="text-default-400 pointer-events-none text-2xl"
                      icon="solar:eye-closed-linear"
                    />
                  ) : (
                    <Icon
                      className="text-default-400 pointer-events-none text-2xl"
                      icon="solar:eye-bold"
                    />
                  )}
                </button>
              }
              label="New Password"
              minLength={8}
              name="password"
              placeholder="Enter new password"
              type={isVisible ? "text" : "password"}
              variant="bordered"
            />

            <Input
              isRequired
              className="font-body"
              endContent={
                <button type="button" onClick={toggleVisibility}>
                  {isVisible ? (
                    <Icon
                      className="text-default-400 pointer-events-none text-2xl"
                      icon="solar:eye-closed-linear"
                    />
                  ) : (
                    <Icon
                      className="text-default-400 pointer-events-none text-2xl"
                      icon="solar:eye-bold"
                    />
                  )}
                </button>
              }
              label="Confirm Password"
              minLength={8}
              name="confirmPassword"
              placeholder="Confirm new password"
              type={isVisible ? "text" : "password"}
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
              Reset Password
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
