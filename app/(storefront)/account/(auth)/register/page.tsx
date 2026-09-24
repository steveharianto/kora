import RegisterForm from "./RegisterForm";

export const metadata = {
  title: "Create Account | KORA",
};

export default function RegisterPage() {
  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[520px] mx-auto px-6 py-20 sm:py-24">
        <h1 className="font-serif text-[34px] sm:text-[42px] text-store-fg text-center font-normal tracking-[0.01em] mb-4">
          Create Account
        </h1>
        <p className="text-center text-[12.5px] text-store-fg-muted mb-12">
          Save your details for faster checkout and easier rental tracking.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
