/**
 * Sender utility functions for distinguishing internal staff from customers
 *
 * Rules:
 * - Sender names starting with "모션랩스_" or "[모션랩스_" are internal staff members
 * - All other sender names are customers
 */

const STAFF_PREFIX = '모션랩스_'
const STAFF_PREFIX_WITH_BRACKET = '[모션랩스_'

/**
 * Check if the sender is an internal staff member
 * Supports both formats: "모션랩스_이름" and "[모션랩스_이름]"
 * @param senderName - The sender's display name
 * @returns true if the sender is a staff member
 */
export function isStaffMember(senderName: string): boolean {
  return senderName.startsWith(STAFF_PREFIX) || senderName.startsWith(STAFF_PREFIX_WITH_BRACKET)
}

/**
 * Check if the sender is a customer
 * @param senderName - The sender's display name
 * @returns true if the sender is a customer
 */
export function isCustomer(senderName: string): boolean {
  return !isStaffMember(senderName)
}

/**
 * Get sender type based on sender name
 * @param senderName - The sender's display name
 * @returns 'staff' or 'customer'
 */
export function getSenderType(senderName: string): 'staff' | 'customer' {
  return isStaffMember(senderName) ? 'staff' : 'customer'
}

/**
 * Get message type for CS system based on sender name
 * @param senderName - The sender's display name
 * @returns 'agent' for staff, 'customer' for customers
 */
export function getMessageType(senderName: string): 'agent' | 'customer' {
  return isStaffMember(senderName) ? 'agent' : 'customer'
}

/**
 * Extract the actual name from staff sender name (removes prefix and brackets)
 * @param senderName - The sender's display name
 * @returns The name without the prefix, or original name if not staff
 */
export function getDisplayName(senderName: string): string {
  // Format: [모션랩스_이름]
  if (senderName.startsWith(STAFF_PREFIX_WITH_BRACKET)) {
    const nameWithBracket = senderName.slice(STAFF_PREFIX_WITH_BRACKET.length)
    // Remove trailing bracket if present
    return nameWithBracket.endsWith(']') ? nameWithBracket.slice(0, -1) : nameWithBracket
  }
  // Format: 모션랩스_이름
  if (senderName.startsWith(STAFF_PREFIX)) {
    return senderName.slice(STAFF_PREFIX.length)
  }
  return senderName
}
