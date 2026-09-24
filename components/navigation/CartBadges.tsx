"use client";

import { useEffect, useState } from "react";
import { countRentalCart, countFittingCart } from "@/lib/storefront/cart";

function useCartCounts() {
  const [rental, setRental] = useState(0);
  const [fitting, setFitting] = useState(0);

  useEffect(() => {
    const read = () => {
      setRental(countRentalCart());
      setFitting(countFittingCart());
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("kora-cart-updated", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("kora-cart-updated", read);
    };
  }, []);

  return { rental, fitting };
}

export function RentalCartBadge() {
  const { rental } = useCartCounts();
  return <span className="text-xs font-mono font-medium">{rental}</span>;
}

export function FittingCartBadge() {
  const { fitting } = useCartCounts();
  return <span className="text-xs font-mono font-medium">{fitting}</span>;
}
