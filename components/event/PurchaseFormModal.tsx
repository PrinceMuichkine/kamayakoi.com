"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Ticket, Plus, Minus } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/contexts/TranslationContext";
import { SupabaseClient } from "@supabase/supabase-js";
import PhoneNumberInput from "@/components/ui/phone-number-input";

// Helper function for formatting price (matching event page)
const formatPrice = (price: number): string => {
  // Use non-breaking space (\u00A0) for thousands separator
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
};

// Define the shape of the ticket/bundle item passed to the modal
interface PurchaseItem {
  id: string; // Sanity _key or bundleId.current
  name: string;
  price: number;
  isBundle: boolean;
  maxPerOrder?: number;
  stock?: number | null;
  productId?: string;
  ticketsIncluded?: number; // Number of tickets included per bundle
}

// Define the expected payload for the Supabase function
interface CreateCheckoutSessionPayload {
  eventId: string;
  eventTitle: string;
  ticketTypeId: string; // Corresponds to PurchaseItem.id
  ticketName: string; // Corresponds to PurchaseItem.name
  pricePerTicket: number;
  quantity: number;
  currencyCode?: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  successUrlPath?: string;
  cancelUrlPath?: string;
  productId?: string;
  allowCouponCode?: boolean;
  allowQuantity?: boolean;
  eventDateText?: string;
  eventTimeText?: string;
  eventVenueName?: string;
  // Bundle-specific fields
  isBundle?: boolean;
  ticketsPerBundle?: number;
}

interface PurchaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PurchaseItem | null;
  eventDetails: {
    id: string; // Event Sanity _id
    title: string;
    dateText?: string;
    timeText?: string;
    venueName?: string;
  };
  supabaseClient: SupabaseClient; // Pass the Supabase client instance
}

export default function PurchaseFormModal({
  isOpen,
  onClose,
  item,
  eventDetails,
  supabaseClient,
}: PurchaseFormModalProps) {
  const { currentLanguage } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [quantityDisplay, setQuantityDisplay] = useState("1");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setQuantity(1); // Reset quantity when item changes
      setQuantityDisplay("1"); // Reset display value too
      setError(null); // Reset error
    }
  }, [item]);

  if (!item) return null;

  // Refined maxQuantity calculation
  const stockLimit =
    item.stock !== null && item.stock !== undefined && item.stock >= 0
      ? item.stock
      : Infinity;
  const orderLimit = item.maxPerOrder || Infinity;
  const calculatedMax = Math.min(stockLimit, orderLimit);
  // If the item is available (modal is open), stock should be > 0 or unlimited.
  // Thus, calculatedMax should be > 0 or Infinity.
  // Default to 20 if no other limits are effectively set.
  const maxQuantity =
    calculatedMax === Infinity || calculatedMax === 0 ? 20 : calculatedMax;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Allow empty string for better UX (user can clear and type new number)
    if (value === "") {
      setQuantityDisplay("");
      return;
    }

    // Only allow numeric input
    if (!/^\d+$/.test(value)) {
      return; // Don't update if not a valid number
    }

    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
      return;
    }

    // Update display immediately
    setQuantityDisplay(value);

    // Clamp the value between 1 and maxQuantity for the actual quantity
    const clampedValue = Math.max(1, Math.min(parsedValue, maxQuantity));
    setQuantity(clampedValue);

    // If the parsed value exceeds limits, update display to show the clamped value
    if (parsedValue !== clampedValue) {
      setTimeout(() => setQuantityDisplay(clampedValue.toString()), 0);
    }
  };

  const handleQuantityBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || parseInt(value, 10) < 1) {
      setQuantity(1);
      setQuantityDisplay("1");
    } else {
      // Ensure display matches the actual quantity
      setQuantityDisplay(quantity.toString());
    }
  };

  const handleQuantityIncrement = () => {
    if (quantity < maxQuantity) {
      const newQuantity = quantity + 1;
      setQuantity(newQuantity);
      setQuantityDisplay(newQuantity.toString());
    }
  };

  const handleQuantityDecrement = () => {
    if (quantity > 1) {
      const newQuantity = quantity - 1;
      setQuantity(newQuantity);
      setQuantityDisplay(newQuantity.toString());
    }
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userName.trim()) {
      setError(t(currentLanguage, "purchaseModal.errors.nameRequired"));
      return;
    }
    if (!userEmail.trim()) {
      setError(t(currentLanguage, "purchaseModal.errors.emailRequired"));
      return;
    }
    if (!validateEmail(userEmail)) {
      setError(t(currentLanguage, "purchaseModal.errors.emailInvalid"));
      return;
    }
    if (quantity <= 0) {
      setError(t(currentLanguage, "purchaseModal.errors.quantityInvalid"));
      return;
    }
    if (item.maxPerOrder && quantity > item.maxPerOrder) {
      setError(
        t(currentLanguage, "purchaseModal.errors.quantityExceedsMax", {
          max: item.maxPerOrder,
        }),
      );
      return;
    }
    if (
      item.stock !== null &&
      item.stock !== undefined &&
      quantity > item.stock
    ) {
      setError(
        t(currentLanguage, "purchaseModal.errors.quantityExceedsStock", {
          stock: item.stock,
        }),
      );
      return;
    }

    setIsLoading(true);

    console.log("PurchaseFormModal - item.productId:", item.productId);

    const shouldAllowQuantity =
      (item.maxPerOrder && item.maxPerOrder > 1) ||
      item.stock === null ||
      item.stock === undefined ||
      item.stock > 1;

    const payload: CreateCheckoutSessionPayload = {
      eventId: eventDetails.id,
      eventTitle: eventDetails.title,
      ticketTypeId: item.id,
      ticketName: item.name,
      pricePerTicket: item.price,
      quantity: quantity,
      userName: userName.trim(),
      userEmail: userEmail.trim(),
      userPhone: userPhone || undefined, // Send phone number properly formatted
      currencyCode: "XOF", // Assuming XOF, make dynamic if needed
      successUrlPath: "/payment/success", // Or from config
      cancelUrlPath: "/payment/cancel", // Or from config
      productId: item.productId,
      allowCouponCode: true, // Enable coupon codes by default
      allowQuantity: shouldAllowQuantity,
      eventDateText: eventDetails.dateText,
      eventTimeText: eventDetails.timeText,
      eventVenueName: eventDetails.venueName,
      // Bundle-specific fields
      isBundle: item.isBundle,
      ticketsPerBundle: item.ticketsIncluded || 1,
    };

    let successfullyInitiatedRedirect = false;

    try {
      // Note: Ensure your Supabase function is named 'create-lomi-checkout-session'
      const { data, error: functionError } =
        await supabaseClient.functions.invoke("create-lomi-checkout-session", {
          body: payload,
        });

      if (functionError) {
        console.error("Supabase function error:", functionError);
        setError(
          functionError.message ||
          t(currentLanguage, "purchaseModal.errors.functionError"),
        );
        setIsLoading(false);
        return;
      }

      if (data && data.checkout_url) {
        window.location.href = data.checkout_url;
        successfullyInitiatedRedirect = true;
      } else {
        console.error("Lomi checkout URL not found in response:", data);
        setError(
          data.error ||
          t(currentLanguage, "purchaseModal.errors.lomiUrlMissing"),
        );
      }
    } catch (e: unknown) {
      console.error("Error invoking Supabase function:", e);
      let message = t(currentLanguage, "purchaseModal.errors.submitError");
      if (e instanceof Error) {
        message = e.message;
      } else if (typeof e === "string") {
        message = e;
      }
      setError(message);
    } finally {
      // Only set isLoading to false if there was an error and we are not redirecting
      if (!successfullyInitiatedRedirect) {
        setIsLoading(false);
      }
    }
  };

  // Helper function to check if form is valid
  const isFormValid = () => {
    return (
      userName.trim().length > 0 &&
      userEmail.trim().length > 0 &&
      validateEmail(userEmail) &&
      userPhone.trim().length > 4 && // Phone is now required
      quantity > 0
    );
  };

  const totalPrice = item.price * quantity;
  const actualTicketCount = item.isBundle
    ? quantity * (item.ticketsIncluded || 1)
    : quantity;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[380px] rounded-sm">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-semibold">
            Purchase Tickets
          </DialogTitle>
          <DialogDescription className="text-sm">
            Complete your order details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 py-2">
            {/* Item Details */}
            <div className="bg-muted/30 p-2 rounded-sm">
              <h4 className="font-medium text-sm">{item.name}</h4>
              <p className="text-xs text-muted-foreground">
                {formatPrice(item.price)}
                {t(currentLanguage, "eventSlugPage.tickets.currencySuffix")}
                {item.isBundle && (
                  <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-sm">
                    {item.ticketsIncluded || 1} tickets
                  </span>
                )}
              </p>
            </div>

            {/* Name Field */}
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm">
                Name
              </Label>
              <Input
                id="name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="rounded-sm h-8 text-sm"
                placeholder="Your full name"
                required
              />
            </div>

            {/* Email Field */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="rounded-sm h-8 text-sm"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* Phone Field */}
            <div className="space-y-1">
              <Label className="text-sm">Phone</Label>
              <PhoneNumberInput
                value={userPhone}
                onChange={(value) => setUserPhone(value || "")}
                placeholder="+221 77 123 45 67"
              />
            </div>

            {/* Quantity Field */}
            <div className="space-y-1">
              <Label htmlFor="quantity" className="text-sm">
                Quantity
              </Label>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuantityDecrement}
                  disabled={quantity <= 1}
                  className="rounded-sm h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="quantity"
                  type="text"
                  inputMode="numeric"
                  value={quantityDisplay}
                  onChange={handleQuantityChange}
                  onBlur={handleQuantityBlur}
                  className="rounded-sm h-8 text-sm text-center flex-1"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuantityIncrement}
                  disabled={quantity >= maxQuantity}
                  className="rounded-sm h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="text-xs text-red-400 text-center px-2 py-1 bg-red-900/20 rounded-sm border border-red-700/50">
                {error}
              </div>
            )}

            {/* Total Price */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total:</span>
                <span className="text-primary font-semibold">
                  {formatPrice(totalPrice)}
                  {t(currentLanguage, "eventSlugPage.tickets.currencySuffix")}
                </span>
              </div>
              {item.isBundle && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    Tickets:
                  </span>
                  <span className="text-xs font-medium">
                    {actualTicketCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="submit"
              disabled={isLoading || !isFormValid()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm text-sm w-full font-medium h-9"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Ticket className="mr-2 h-3 w-3" />
                  Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
