"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { afterLoginDestination } from "@/lib/auth-destination";
import { loginSchema, signupSchema, type AuthUser } from "@/lib/auth-validation";

type Tab = "signup" | "login";

type FormErrors = {
  name?: string;
  emailOrPhone?: string;
  password?: string;
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: Tab = searchParams.get("tab") === "login" ? "login" : "signup";
  const [user, setUser] = useState<AuthUser | null>();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    emailOrPhone: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          if (!controller.signal.aborted) setUser(null);
          return;
        }
        const data: { user: AuthUser } = await response.json();
        if (!controller.signal.aborted) setUser(data.user);
      } catch {
        if (!controller.signal.aborted) setUser(null);
      }
    }
    void loadSession();
    return () => controller.abort();
  }, []);

  const switchTab = (nextTab: Tab) => {
    setFeedback(null);
    setShowPassword(false);
    setFormValues((current) => ({ ...current, password: "" }));
    setErrors({});
    setSubmitAttempted(false);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "login") {
      params.set("tab", "login");
    } else {
      params.delete("tab");
    }
    router.replace(`/login${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const buildErrors = (values: typeof formValues) => {
    const payload = activeTab === "signup" ? signupSchema.safeParse(values) : loginSchema.safeParse(values);

    if (payload.success) {
      return {};
    }

    const nextErrors: FormErrors = {};
    payload.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof FormErrors;
      if (key) {
        nextErrors[key] = issue.message;
      }
    });

    return nextErrors;
  };

  const handleChange = (field: keyof typeof formValues, value: string) => {
    const nextValues = {
      ...formValues,
      [field]: value,
    };

    setFormValues(nextValues);
    setFeedback(null);

    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setSubmitAttempted(true);
    setFeedback(null);

    const nextErrors = buildErrors(formValues);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/" + activeTab, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      if (!response.ok) {
        const data: { error: string } = await response.json();
        setFeedback({ message: data.error, error: true });
      } else if (activeTab === "signup") {
        switchTab("login");
        setFeedback({ message: "Account created. Log in to continue.", error: false });
      } else {
        router.replace(afterLoginDestination(searchParams.get("next")));
        router.refresh();
        return;
      }
    } catch {
      setFeedback({ message: "Could not reach the server. Try again.", error: true });
    }
    setPending(false);
  };

  const logout = async () => {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed.");
      setUser(null);
      setPending(false);
      router.replace("/login?tab=login");
      router.refresh();
    } catch {
      setFeedback({ message: "Could not log out. Try again.", error: true });
      setPending(false);
    }
  };

  if (user === undefined) {
    return <p role="status" className="mx-auto max-w-md px-4 py-10 text-muted">Checking your session?</p>;
  }

  if (user) {
    return (
      <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
        <div className="mx-auto max-w-md">
          <h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">Your account</h1>
          <div className="mt-6 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:p-6">
            <p className="text-ink">Signed in as <strong>{user.name}</strong>.</p>
            {feedback && <p role="alert" className="mt-3 text-sm text-[#B42318]">{feedback.message}</p>}
            <button type="button" onClick={logout} disabled={pending}
              className="mt-5 flex h-[52px] w-full items-center justify-center bg-brand font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:opacity-60">
              {pending ? "Logging out?" : "Log out"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const currentErrors = {
    name: submitAttempted ? errors.name : undefined,
    emailOrPhone: submitAttempted ? errors.emailOrPhone : undefined,
    password: submitAttempted ? errors.password : undefined,
  };

  return (
    <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
      <div className="mx-auto max-w-md pb-8 md:pb-10">
        <div className="text-left">
          <h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">
            Create an account or log in
          </h1>
          <p className="mt-3 max-w-[28rem] text-base leading-7 text-muted">
            Sign up to submit a polling unit result or log in to your existing account.
          </p>
        </div>

        <div className="mt-6 border border-line bg-white shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
          <div className="grid grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => switchTab("signup")}
              className={[
                "flex h-[52px] items-center justify-center text-base font-bold",
                activeTab === "signup" ? "bg-brand text-white" : "border border-brand bg-white text-brand",
              ].join(" ")}
            >
              Sign up
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => switchTab("login")}
              className={[
                "flex h-[52px] items-center justify-center text-base font-bold",
                activeTab === "login" ? "bg-brand text-white" : "border border-brand bg-white text-brand",
              ].join(" ")}
            >
              Log in
            </button>
          </div>

          <div className="p-4 md:p-6">
            <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
              {activeTab === "signup" && (
                <div className="mb-4">
                  <label htmlFor="name" className="mb-2 block text-sm font-bold text-ink">
                    Name or nickname
                  </label>
                  <input
                    id="name"
                    autoComplete="nickname"
                    maxLength={100}
                    type="text"
                    value={formValues.name}
                    onChange={(event) => handleChange("name", event.target.value)}
                    placeholder="Enter your name or nickname"
                    className={[
                      "h-[52px] w-full border bg-white px-3 text-base text-ink outline-none",
                      currentErrors.name ? "border-[#B42318]" : "border-line",
                      "focus:border-brand",
                    ].join(" ")}
                  />
                  {currentErrors.name && <p role="alert" className="mt-2 text-xs font-medium text-[#B42318]">{currentErrors.name}</p>}
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="emailOrPhone" className="mb-2 block text-sm font-bold text-ink">
                  Email or phone number
                </label>
                <input
                  id="emailOrPhone"
                  autoComplete="username"
                  maxLength={191}
                  type="text"
                  value={formValues.emailOrPhone}
                  onChange={(event) => handleChange("emailOrPhone", event.target.value)}
                  placeholder="Enter your email or phone number"
                  className={[
                    "h-[52px] w-full border bg-white px-3 text-base text-ink outline-none",
                    currentErrors.emailOrPhone ? "border-[#B42318]" : "border-line",
                    "focus:border-brand",
                  ].join(" ")}
                />
                {currentErrors.emailOrPhone && (
                  <p role="alert" className="mt-2 text-xs font-medium text-[#B42318]">{currentErrors.emailOrPhone}</p>
                )}
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-bold text-ink">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-sm font-bold text-brand"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <input
                  id="password"
                  autoComplete={activeTab === "signup" ? "new-password" : "current-password"}
                  type={showPassword ? "text" : "password"}
                  value={formValues.password}
                  onChange={(event) => handleChange("password", event.target.value)}
                  placeholder={activeTab === "signup" ? "Create a password" : "Enter your password"}
                  className={[
                    "h-[52px] w-full border bg-white px-3 text-base text-ink outline-none",
                    currentErrors.password ? "border-[#B42318]" : "border-line",
                    "focus:border-brand",
                  ].join(" ")}
                />

                {activeTab === "signup" && (
                  <p className="mt-2 text-xs font-medium text-muted">Use at least 8 characters.</p>
                )}

                {currentErrors.password && (
                  <p role="alert" className="mt-2 text-xs font-medium text-[#B42318]">{currentErrors.password}</p>
                )}
              </div>

              {feedback && (
                <p role={feedback.error ? "alert" : "status"}
                  className={feedback.error ? "mb-4 text-sm text-[#B42318]" : "mb-4 text-sm text-brand-dark"}>
                  {feedback.message}
                </p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="flex h-[52px] w-full items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:opacity-60"
              >
                {pending ? "Please wait?" : activeTab === "signup" ? "Create account" : "Log in"}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 border border-line bg-[#eef8f1] p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand text-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 3.75L18.5 6V11.15C18.5 15.3 15.88 18.96 12 20.5C8.12 18.96 5.5 15.3 5.5 11.15V6L12 3.75Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.5 12.25L11.25 14L14.75 10.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="text-sm leading-6 text-ink md:text-base">
              We collect only your name or nickname and your email or phone number to keep the platform secure.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
