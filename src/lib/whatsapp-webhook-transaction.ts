export type WhatsAppWebhookTransactionBoundary<TTransaction> = {
  begin<T>(callback: (transaction: TTransaction) => Promise<T>): Promise<T>;
};

export async function persistWhatsAppWebhookAtomically<TTransaction>(
  boundary: WhatsAppWebhookTransactionBoundary<TTransaction>,
  insertEvent: (transaction: TTransaction) => Promise<boolean>,
  applyStatus: (transaction: TTransaction) => Promise<number>,
) {
  return boundary.begin(async transaction => {
    const inserted = await insertEvent(transaction);
    // Always retry the monotonic status application. This is a no-op after a
    // successful prior commit, but repairs a legacy event that committed before
    // its status mutation under the former two-commit implementation.
    const updated = await applyStatus(transaction);
    return { duplicate: !inserted, updated };
  });
}
