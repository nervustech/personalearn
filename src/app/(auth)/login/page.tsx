import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to PersonaLearn</CardTitle>
          <CardDescription>
            Email and Google authentication will be wired in Sprint 1 (PSL-4).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" className="w-full">
            Continue with Google
          </Button>
          <Button type="button" variant="secondary" className="w-full">
            Continue with Email
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
