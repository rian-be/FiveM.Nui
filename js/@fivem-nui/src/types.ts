/**
 * Represents an error in NUI communication.
 */
export interface NuiError {
  code: string;
  message: string;
}

/**
 * Window lifecycle envelope type sent by C# window management.
 */
export type NuiWindowAction = 'open' | 'close' | 'focus' | 'unfocus';

/**
 * Represents a message sent between C# and NUI.
 */
export interface NuiMessage {
  id?: string;
  type: 'request' | 'response' | 'event' | NuiWindowAction;
  /**
   * Absent on responses - the correlation `id` already identifies the call.
   */
  event?: string;
  payload?: unknown;
  success?: boolean;
  error?: NuiError;
}

/**
 * Result of an NUI operation.
 */
export interface NuiResult<T> {
  success: boolean;
  value?: T;
  error?: NuiError;
}
