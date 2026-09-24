import {
  ContractExecuteTransaction,
  ScheduleCreateTransaction,
  Timestamp,
  type Transaction,
} from "@hiero-ledger/sdk";
import { assertScheduleDueDate } from "./payment-plan.js";

const MEMO = "ClaimState/v1 markDelinquent";

/**
 * Arms markDelinquent at the envelope due date. The inner transaction is a contract call.
 * It is not a HIP-551 batch. waitForExpiry keeps it from running before that due date.
 */
export function buildDelinquencySchedule(input: {
  contractCall: Transaction;
  dueDateUnix: bigint;
  nowUnix: bigint;
}): ScheduleCreateTransaction {
  if (!(input.contractCall instanceof ContractExecuteTransaction)) {
    throw new Error("A delinquency schedule must be a contract call");
  }
  assertScheduleDueDate(input.dueDateUnix, input.nowUnix);
  const schedule = new ScheduleCreateTransaction()
    .setScheduledTransaction(input.contractCall)
    .setWaitForExpiry(true)
    .setExpirationTime(Timestamp.fromDate(new Date(Number(input.dueDateUnix) * 1000)))
    .setScheduleMemo(MEMO);
  return schedule;
}
