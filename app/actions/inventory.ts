export async function saveItem(itemData: any, isNew: boolean) {
  if (!itemData?.sku) return { error: "SKU is required." };

  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Unauthorized: Session not found." };

  if (!isNew && itemData.status === "Available") {
    const { data: activeRentals } = await supabase
      .from("order_products")
      .select("orders!inner(id, status)")
      .eq("item_sku", itemData.sku)
      .in("orders.status", ["In Shipping", "Active"])
      .limit(1);

    if (activeRentals && activeRentals.length > 0) {
      const activeId = (activeRentals[0] as any).orders?.id;
      return {
        error: `Cannot set status to "Available". This garment is currently out on loan with order ${activeId}.`,
      };
    }
  }

  const isSuperAdmin = checkSuperAdmin(admin.role);
  const permissions = await getSystemPermissions(supabase);

  const canDirectSave =
    isSuperAdmin || permissions.staff_edits_product_info === "direct_save";

  const coreData = {
    sku: itemData.sku,
    brand_id: itemData.brand_id ? parseInt(itemData.brand_id) : null,
    category_id: itemData.category_id ? parseInt(itemData.category_id) : null,
    type_id: itemData.type_id ? parseInt(itemData.type_id) : null,
    name: itemData.name,
    size: itemData.size,
    color: itemData.color,
    tags: itemData.tags || [],
    rental_price: itemData.rental_price
      ? parseFloat(itemData.rental_price)
      : null,
    /*
     * Multi-day add-on rate. Null-tolerant for defensive safety (the DB
     * column is NULLable and pre-migration rows would be null on a stale
     * client), but in practice the form always sends a number because
     * RupiahInput converts blank → 0 and the form's initial state falls
     * back to `rental_price` when `add_on_price` is unset.
     *
     * Because this lives inside `coreData`, it flows through BOTH the
     * direct-save path (`dbPayload = { ...coreData, ... }`) AND the
     * staff pending-approval path (`pending_changes: coreData`). The
     * `approvePendingChanges` action spreads `pending_changes` onto the
     * item row, so no additional plumbing is required there.
     *
     * Q1 semantics: a stored NULL means "same as base rental price".
     * The downstream server recalc honours that with an `??` fallback.
     */
    add_on_price:
      itemData.add_on_price != null && itemData.add_on_price !== ""
        ? parseFloat(itemData.add_on_price)
        : null,
    buffer_override:
      itemData.buffer_override !== "" &&
      itemData.buffer_override !== null &&
      itemData.buffer_override !== undefined
        ? parseInt(itemData.buffer_override)
        : null,
    status: itemData.status,
    website_status: itemData.website_status,
    description: itemData.description,
    date_added: itemData.date_added,
    measurements: itemData.measurements,
  };

  if (canDirectSave) {
    const dbPayload = {
      ...coreData,
      pending_changes: null,
      pending_action: null,
      pending_by: null,
    };

    if (isNew) {
      const { error } = await supabase.from("items").insert(dbPayload);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("items")
        .update(dbPayload)
        .eq("sku", itemData.sku);
      if (error) return { error: error.message };
    }
  } else {
    if (isNew) {
      const dbPayload = {
        sku: itemData.sku,
        name: itemData.name || "Draft Name",
        rental_price: itemData.rental_price
          ? parseFloat(itemData.rental_price)
          : 0,
        website_status: "Draft",
        status: "Unavailable",
        pending_changes: coreData,
        pending_action: "CREATE",
        pending_by: admin.id,
      };
      const { error } = await supabase.from("items").insert(dbPayload);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("items")
        .update({
          pending_changes: coreData,
          pending_action: "EDIT",
          pending_by: admin.id,
        })
        .eq("sku", itemData.sku);
      if (error) return { error: error.message };
    }
  }

  await supabase.from("admin_audit_logs").insert({
    admin_id: admin.id,
    admin_name: admin.name,
    entity_type: "item",
    entity_id: itemData.sku,
    action_type: canDirectSave
      ? isNew
        ? "CREATE"
        : "DIRECT_EDIT"
      : isNew
        ? "REQUEST_CREATE"
        : "REQUEST_EDIT",
    field_name: "all",
  });

  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${itemData.sku}`);
  revalidateTag("items", "max");
  return { success: true };
}
