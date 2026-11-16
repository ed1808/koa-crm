export interface DomainEvent {
  aggregateType: string;
  aggregateId: string;
  routingKey: string;
  payload: Record<string, any>;
  occurredOn: Date;
}

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export const Result = {
  ok: <T>(value: T): Result<T, never> => ({ success: true, value }),
  fail: <E = Error>(error: E): Result<never, E> => ({ success: false, error }),
};
