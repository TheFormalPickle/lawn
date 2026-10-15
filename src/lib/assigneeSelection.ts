// The option value is UI state only. Pending emails are never authentication IDs.
export function assigneeSelection(subject?: string, pendingEmail?: string) {
  return pendingEmail ? `invite:${pendingEmail}` : (subject ?? "");
}

export function selectedAssignee(value: string) {
  return value.startsWith("invite:")
    ? { clerkId: undefined, pendingEmail: value.slice(7) }
    : { clerkId: value || undefined, pendingEmail: undefined };
}
