import LoginForm from "./LoginForm";

export const metadata = {
  title: "Login | KORA",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[440px] mx-auto px-6 py-20 sm:py-28">
        <h1 className="font-serif text-[34px] sm:text-[42px] text-store-fg text-center font-normal tracking-[0.01em] mb-14">
          Login
        </h1>
        <LoginForm redirectTo={redirect} />
      </div>
    </div>
  );
}
