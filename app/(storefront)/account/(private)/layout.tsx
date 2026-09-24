import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/app/actions/customerAuth";
import AccountSidebar from "./AccountSidebar";

export default async function AccountPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/account/login?redirect=/account");
  }

  return (
    <div className="w-full bg-store-bg">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
          <AccountSidebar customerName={customer.firstName} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
