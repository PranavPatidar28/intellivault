"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ContinueWithGoogle } from "../_components/continueWithGoogle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";

const SignInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type SignInForm = z.infer<typeof SignInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Where to send the user after login. Read from the ?callbackUrl= param the
  // middleware sets, sanitized to a same-origin path to prevent open redirects.
  const [callbackUrl, setCallbackUrl] = useState("/");

  // Read callbackUrl from the URL on mount (via window to avoid forcing this
  // static page into dynamic rendering with useSearchParams).
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("callbackUrl");
    setCallbackUrl(sanitizeCallbackUrl(param));
  }, []);

  const form = useForm<SignInForm>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange", // Validate on change for better UX
  });

  // Clear a stale auth error as soon as the user edits any field, so the
  // previous "sign in failed" message doesn't linger under fields they're
  // actively correcting.
  useEffect(() => {
    const subscription = form.watch(() => {
      setAuthError((prev) => (prev ? null : prev));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSignIn = async (data: SignInForm) => {
    if (isLoading) return;

    setIsLoading(true);
    setAuthError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        callbackURL: callbackUrl,
      });

      if (result.error) {
        setAuthError(result.error.message || "Sign in failed. Please try again.");
      } else {
        // Successful sign in - redirect to the (sanitized) callback target
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Note: authenticated users are redirected away from /signin by middleware,
  // so this component only ever renders for unauthenticated visitors. We render
  // the form immediately rather than gating it behind a client session check.
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
        </CardHeader>

        <CardContent>
          {authError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSignIn)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>

          <div className="relative my-6">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <ContinueWithGoogle callbackURL={callbackUrl} />
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-center text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
