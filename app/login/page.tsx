"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";

const emailPhoneSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) {
      return false;
    }

    const trimmed = value.trim();

    if (trimmed.includes("@")) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    }

    const digitsOnly = trimmed.replace(/\+/g, "");
    return /^\d{10,14}$/.test(digitsOnly);
  }, "Enter a valid email or phone number.");

const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name or nickname.")
    .max(100, "Name must be 100 characters or fewer."),
  emailOrPhone: emailPhoneSchema,
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const loginSchema = z.object({
  emailOrPhone: emailPhoneSchema,
  password: z.string().min(1, "Password is required."),
});

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
  const [activeTab, setActiveTab] = useState<Tab>("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    emailOrPhone: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab") === "login" ? "login" : "signup";
    setActiveTab(tabFromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (Object.keys(errors).length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrors({});
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [errors]);

  const switchTab = (nextTab: Tab) => {
    setActiveTab(nextTab);
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
    const payload = activeTab === "signup" ? signUpSchema.safeParse(values) : loginSchema.safeParse(values);

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

    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);

    const nextErrors = buildErrors(formValues);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    console.log("form valid");
    // TODO: send API request here.
  };

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
            <form onSubmit={handleSubmit} noValidate>
              {activeTab === "signup" && (
                <div className="mb-4">
                  <label htmlFor="name" className="mb-2 block text-sm font-bold text-ink">
                    Name or nickname
                  </label>
                  <input
                    id="name"
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

              <button
                type="submit"
                className="flex h-[52px] w-full items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37]"
              >
                {activeTab === "signup" ? "Create account" : "Log in"}
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
