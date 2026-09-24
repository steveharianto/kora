import ResetForm from "./ResetForm";

export const metadata = {
  title: "Reset Password | KORA",
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[440px] mx-auto px-6 py-20 sm:py-28">
        <h1 className="font-serif text-[34px] sm:text-[42px] text-store-fg text-center font-normal tracking-[0.01em] mb-3">
          Reset your Password
        </h1>
        <p className="text-center text-[12.5px] text-store-fg-muted mb-14">
          We will send you an email to reset your password
        </p>
        <ResetForm />
      </div>
    </div>
  );
}
