import { expect } from "chai";
import { getBytes, type Contract, type HDNodeWallet, type Signer } from "ethers";
import { network } from "hardhat";
import {
  actionDigest,
  domainSeparator,
  payloadHash,
  STATE_CODE,
  type ClaimEvent,
} from "@claimstate/sdk";

declare function describe(name: string, fn: (this: MochaContext) => void): void;
declare function it(name: string, fn: (this: MochaContext) => Promise<void>): void;
declare function before(fn: (this: MochaContext) => Promise<void>): void;
interface MochaContext {
  timeout(ms: number): void;
}

const { ethers } = await network.create();

const TOPIC_ID = "0.0.1";
const DUE = 1_800_000_000n;
const TERMS = bytes32(0x11);
const FINGERPRINT = bytes32(0x12);
const AMOUNT = bytes32(0x13);
const NEXT_TERMS = bytes32(0x21);
const NEXT_AMOUNT = bytes32(0x22);
const EVIDENCE = bytes32(0x31);
const PAYMENT = bytes32(0x32);

let nextEvent = 1n;
let kernelContract: Contract | undefined;

interface World {
  kernel: Contract;
  kernelAccount: Signer;
  supplier: HDNodeWallet;
  buyer: HDNodeWallet;
  factor: HDNodeWallet;
  otherFactor: HDNodeWallet;
  paymentAgent: HDNodeWallet;
  executor: HDNodeWallet;
  domain: string;
}

describe("ClaimStateKernel", function () {
  let world: World;

  before(async function () {
    const chain = await ethers.provider.getNetwork();
    expect(chain.chainId).to.equal(296n);

    const [relayer, kernelAccount] = await ethers.getSigners();
    const supplier = ethers.Wallet.createRandom();
    const buyer = ethers.Wallet.createRandom();
    const factor = ethers.Wallet.createRandom();
    const otherFactor = ethers.Wallet.createRandom();
    const paymentAgent = ethers.Wallet.createRandom();
    const executor = ethers.Wallet.createRandom();
    const kernel = await ethers.deployContract(
      "ClaimStateKernel",
      [TOPIC_ID, "testnet", kernelAccount.address],
      relayer,
    );
    const registry = await kernel.getAddress();
    kernelContract = kernel;
    world = {
      kernel,
      kernelAccount,
      supplier,
      buyer,
      factor,
      otherFactor,
      paymentAgent,
      executor,
      domain: domainSeparator({
        chainId: 296n,
        registry,
        topicId: TOPIC_ID,
        networkLabel: "testnet",
      }),
    };
  });

  it("matches the SDK domain separator", async function () {
    expect(await world.kernel.domainSeparator()).to.equal(world.domain);
  });

  it("creates a draft at version 1 and acknowledges it", async function () {
    const obligation = freshObligation();
    await create(world, obligation);
    let env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.DRAFT));
    expect(env.version).to.equal(1n);
    expect(env.factor).to.equal(ethers.ZeroAddress);
    expect(await world.kernel.scheduledExecutors(obligation)).to.equal(world.executor.address);

    await acknowledge(world, obligation, env.version);
    env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.ACKNOWLEDGED));
    expect(env.version).to.equal(2n);
    expect(env.factor).to.equal(ethers.ZeroAddress);
  });

  it("activates a reservation without putting the holder in the log", async function () {
    const obligation = await acknowledged(world);
    const version = (await read(world, obligation)).version;
    const id = eventId();
    const event = activateEvent(world, world.factor, id, version);
    const tx = await world.kernel.activate(
      obligation,
      world.factor.address,
      id,
      version,
      sign(world.supplier, world, event, obligation),
      sign(world.factor, world, event, obligation),
    );
    const receipt = await tx.wait();
    expect(receipt).to.not.equal(null);
    const holder = world.factor.address.slice(2).toLowerCase();
    for (const log of receipt?.logs ?? []) {
      expect(log.data.toLowerCase().includes(holder)).to.equal(false);
      for (const topic of log.topics) {
        expect(topic.toLowerCase().includes(holder)).to.equal(false);
      }
    }
    const env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.RESERVED));
    expect(env.factor).to.equal(world.factor.address);
    expect(env.version).to.equal(version + 1n);
  });

  it("applies a credit note without changing the obligation id", async function () {
    const obligation = await reserved(world);
    const before = await read(world, obligation);
    await creditNote(world, obligation, before.version, NEXT_TERMS, NEXT_AMOUNT);
    const after = await read(world, obligation);
    expect(after.termsRoot).to.equal(NEXT_TERMS);
    expect(after.amountCommitment).to.equal(NEXT_AMOUNT);
    expect(after.state).to.equal(BigInt(STATE_CODE.RESERVED));
    expect(after.factor).to.equal(world.factor.address);
    expect(after.version).to.equal(before.version + 1n);
  });

  it("opens and cures a dispute without moving the holder", async function () {
    const obligation = await reserved(world);
    let version = (await read(world, obligation)).version;
    await openDispute(world, obligation, version);
    let env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.DISPUTED));
    expect(env.factor).to.equal(world.factor.address);
    version = env.version;
    await cureDispute(world, obligation, version);
    env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.RESERVED));
    expect(env.factor).to.equal(world.factor.address);
  });

  it("keeps the state on a non-settling allocation and settles from either open state", async function () {
    const open = await reserved(world);
    let version = (await read(world, open)).version;
    await allocate(world, open, version, false);
    let env = await read(world, open);
    expect(env.state).to.equal(BigInt(STATE_CODE.RESERVED));
    expect(env.factor).to.equal(world.factor.address);

    const late = await delinquent(world);
    version = (await read(world, late)).version;
    await allocate(world, late, version, false);
    env = await read(world, late);
    expect(env.state).to.equal(BigInt(STATE_CODE.DELINQUENT));
    expect(env.factor).to.equal(world.factor.address);

    const fromReserved = await reserved(world);
    version = (await read(world, fromReserved)).version;
    await allocate(world, fromReserved, version, true);
    env = await read(world, fromReserved);
    expect(env.state).to.equal(BigInt(STATE_CODE.SETTLED));
    expect(env.factor).to.equal(world.factor.address);

    const fromLate = await delinquent(world);
    version = (await read(world, fromLate)).version;
    await allocate(world, fromLate, version, true);
    env = await read(world, fromLate);
    expect(env.state).to.equal(BigInt(STATE_CODE.SETTLED));
    expect(env.factor).to.equal(world.factor.address);
  });

  it("marks an envelope delinquent only after the due date", async function () {
    const obligation = await reserved(world);
    const version = (await read(world, obligation)).version;
    await markDelinquent(world, obligation, version, DUE + 1n);
    const env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.DELINQUENT));
    expect(env.factor).to.equal(world.factor.address);
  });

  it("declares default from dispute or delinquency and keeps the holder", async function () {
    const disputed = await reserved(world);
    let version = (await read(world, disputed)).version;
    await openDispute(world, disputed, version);
    version = (await read(world, disputed)).version;
    await declareDefault(world, disputed, version);
    let env = await read(world, disputed);
    expect(env.state).to.equal(BigInt(STATE_CODE.DEFAULTED));
    expect(env.factor).to.equal(world.factor.address);

    const late = await delinquent(world);
    version = (await read(world, late)).version;
    await declareDefault(world, late, version);
    env = await read(world, late);
    expect(env.state).to.equal(BigInt(STATE_CODE.DEFAULTED));
    expect(env.factor).to.equal(world.factor.address);
  });

  it("releases by the factor or the kernel and clears the holder", async function () {
    const byFactor = await settled(world);
    let version = (await read(world, byFactor)).version;
    await releaseByFactor(world, byFactor, version);
    let env = await read(world, byFactor);
    expect(env.state).to.equal(BigInt(STATE_CODE.RELEASED));
    expect(env.factor).to.equal(ethers.ZeroAddress);

    const byKernel = await settled(world);
    version = (await read(world, byKernel)).version;
    const id = eventId();
    await world.kernel
      .connect(world.kernelAccount)
      .getFunction("releaseByKernel")(byKernel, id, version);
    env = await read(world, byKernel);
    expect(env.state).to.equal(BigInt(STATE_CODE.RELEASED));
    expect(env.factor).to.equal(ethers.ZeroAddress);
    expect(await world.kernel.consumedEvents(byKernel, id)).to.equal(true);
  });

  it("rejects Activate from DRAFT as AlreadyReserved with no holder", async function () {
    const obligation = freshObligation();
    await create(world, obligation);
    const version = (await read(world, obligation)).version;
    const id = eventId();
    const data = await revertData(
      sendActivate(world, obligation, world.factor, id, version),
    );
    expect(data).to.equal(selector("AlreadyReserved()"));
    omitsAddress(data, world.factor.address);
    const env = await read(world, obligation);
    expect(env.state).to.equal(BigInt(STATE_CODE.DRAFT));
    expect(env.version).to.equal(version);
    expect(await world.kernel.consumedEvents(obligation, id)).to.equal(false);
  });

  it("rejects a second Activate without revealing either holder", async function () {
    const obligation = await reserved(world);
    const before = await read(world, obligation);
    const id = eventId();
    const data = await revertData(
      sendActivate(world, obligation, world.otherFactor, id, before.version),
    );
    expect(data).to.equal(selector("AlreadyReserved()"));
    omitsAddress(data, world.factor.address);
    omitsAddress(data, world.otherFactor.address);
    const after = await read(world, obligation);
    expect(after.state).to.equal(BigInt(STATE_CODE.RESERVED));
    expect(after.factor).to.equal(world.factor.address);
    expect(after.version).to.equal(before.version);
    expect(await world.kernel.consumedEvents(obligation, id)).to.equal(false);
  });

  it("rejects a stale version before the edge check and does not consume the id", async function () {
    const obligation = freshObligation();
    await create(world, obligation);
    const id = eventId();
    const event: ClaimEvent = {
      eventType: "Acknowledge",
      eventId: id,
      expectedVersion: 0n,
      signers: [{ role: "buyer", account: world.buyer.address }],
      termsRoot: TERMS,
    };
    const data = await revertData(
      world.kernel.acknowledge(obligation, TERMS, id, 0n, sign(world.buyer, world, event, obligation)),
    );
    expect(data).to.equal(encoded("StaleVersion", [1n, 0n]));

    const staleActivate = eventId();
    const activateData = await revertData(
      sendActivate(world, obligation, world.factor, staleActivate, 0n),
    );
    expect(activateData).to.equal(encoded("StaleVersion", [1n, 0n]));
    expect(await world.kernel.consumedEvents(obligation, id)).to.equal(false);
    expect(await world.kernel.consumedEvents(obligation, staleActivate)).to.equal(false);
  });

  it("rejects a replayed event id when the version is current", async function () {
    const obligation = await reserved(world);
    const version = (await read(world, obligation)).version;
    const id = eventId();
    await creditNote(world, obligation, version, NEXT_TERMS, NEXT_AMOUNT, id);
    const noted = await read(world, obligation);
    const again: ClaimEvent = {
      eventType: "CreditNote",
      eventId: id,
      expectedVersion: noted.version,
      signers: [
        { role: "buyer", account: world.buyer.address },
        { role: "supplier", account: world.supplier.address },
      ],
      termsRoot: bytes32(0x41),
      amountCommitment: bytes32(0x42),
    };
    const data = await revertData(
      world.kernel.creditNote(
        obligation,
        bytes32(0x41),
        bytes32(0x42),
        id,
        noted.version,
        sign(world.buyer, world, again, obligation),
        sign(world.supplier, world, again, obligation),
      ),
    );
    expect(data).to.equal(encoded("ReplayedEvent", [id]));
    const after = await read(world, obligation);
    expect(after.termsRoot).to.equal(NEXT_TERMS);
    expect(after.amountCommitment).to.equal(NEXT_AMOUNT);
  });

  it("rejects a credit note signed by the factor and does not return the holder", async function () {
    const obligation = await reserved(world);
    const before = await read(world, obligation);
    const id = eventId();
    const event: ClaimEvent = {
      eventType: "CreditNote",
      eventId: id,
      expectedVersion: before.version,
      signers: [{ role: "factor", account: world.factor.address }],
      termsRoot: NEXT_TERMS,
      amountCommitment: NEXT_AMOUNT,
    };
    const factorSignature = sign(world.factor, world, event, obligation);
    const data = await revertData(
      world.kernel.creditNote(
        obligation,
        NEXT_TERMS,
        NEXT_AMOUNT,
        id,
        before.version,
        factorSignature,
        factorSignature,
      ),
    );
    expect(data).to.equal(selector("Unauthorized()"));
    omitsAddress(data, world.factor.address);
    const after = await read(world, obligation);
    expect(after.amountCommitment).to.equal(before.amountCommitment);
    expect(after.factor).to.equal(world.factor.address);
  });

  it("rejects MarkDelinquent at the due date", async function () {
    const obligation = await reserved(world);
    const version = (await read(world, obligation)).version;
    const id = eventId();
    const event: ClaimEvent = {
      eventType: "MarkDelinquent",
      eventId: id,
      expectedVersion: version,
      signers: [{ role: "scheduledExecutor", account: world.executor.address }],
      observedAt: DUE,
    };
    const data = await revertData(
      world.kernel.markDelinquent(
        obligation,
        DUE,
        id,
        version,
        sign(world.executor, world, event, obligation),
      ),
    );
    expect(data).to.equal(selector("BeforeDueDate()"));
    expect(await world.kernel.consumedEvents(obligation, id)).to.equal(false);
    expect((await read(world, obligation)).state).to.equal(BigInt(STATE_CODE.RESERVED));
  });

  it("rejects Activate after release", async function () {
    const obligation = await settled(world);
    const version = (await read(world, obligation)).version;
    await releaseByFactor(world, obligation, version);
    const released = await read(world, obligation);
    const id = eventId();
    const data = await revertData(
      sendActivate(world, obligation, world.otherFactor, id, released.version),
    );
    expect(data).to.equal(selector("AlreadyReserved()"));
    expect((await read(world, obligation)).state).to.equal(BigInt(STATE_CODE.RELEASED));
    expect((await read(world, obligation)).factor).to.equal(ethers.ZeroAddress);
  });

  it("rejects a second Create as an illegal transition", async function () {
    const obligation = freshObligation();
    await create(world, obligation);
    const id = eventId();
    const event = createEvent(world, obligation, id);
    const data = await revertData(
      world.kernel.create(
        obligation,
        TERMS,
        FINGERPRINT,
        AMOUNT,
        world.buyer.address,
        world.supplier.address,
        world.paymentAgent.address,
        world.executor.address,
        DUE,
        id,
        0n,
        sign(world.supplier, world, event, obligation),
      ),
    );
    expect(data).to.equal(selector("IllegalTransition()"));
  });

  it("rejects an acknowledgement of a different terms root", async function () {
    const obligation = freshObligation();
    await create(world, obligation);
    const version = (await read(world, obligation)).version;
    const id = eventId();
    const event: ClaimEvent = {
      eventType: "Acknowledge",
      eventId: id,
      expectedVersion: version,
      signers: [{ role: "buyer", account: world.buyer.address }],
      termsRoot: NEXT_TERMS,
    };
    const data = await revertData(
      world.kernel.acknowledge(
        obligation,
        NEXT_TERMS,
        id,
        version,
        sign(world.buyer, world, event, obligation),
      ),
    );
    expect(data).to.equal(selector("TermsMismatch()"));
    expect((await read(world, obligation)).state).to.equal(BigInt(STATE_CODE.DRAFT));
  });
});

function bytes32(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0").repeat(32)}`;
}

function eventId(): string {
  const id = ethers.zeroPadValue(ethers.toBeHex(nextEvent), 32);
  nextEvent += 1n;
  return id;
}

function freshObligation(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

function sign(wallet: HDNodeWallet, world: World, event: ClaimEvent, obligationId: string): string {
  const digest = actionDigest({
    domain: world.domain,
    eventType: event.eventType,
    obligationId,
    expectedVersion: event.expectedVersion,
    payloadHash: payloadHash(event),
  });
  return wallet.signingKey.sign(getBytes(digest)).serialized;
}

function selector(signature: string): string {
  return ethers.id(signature).slice(0, 10).toLowerCase();
}

function encoded(name: string, args: readonly unknown[]): string {
  if (kernelContract === undefined) {
    throw new Error("kernel interface is not ready");
  }
  return kernelContract.interface.encodeErrorResult(name, [...args]).toLowerCase();
}

async function read(world: World, obligation: string) {
  const env = await world.kernel.envelopes(obligation);
  return {
    state: env.state as bigint,
    version: env.version as bigint,
    factor: env.factor as string,
    termsRoot: env.termsRoot as string,
    amountCommitment: env.amountCommitment as string,
  };
}

function omitsAddress(data: string, address: string): void {
  expect(data.toLowerCase().includes(address.slice(2).toLowerCase())).to.equal(false);
}

async function revertData(call: Promise<unknown>): Promise<string> {
  try {
    const result = await call;
    if (isReceiptSource(result)) {
      await result.wait();
    }
  } catch (error) {
    const data = payload(error);
    if (data !== undefined) {
      return data.toLowerCase();
    }
    throw error;
  }
  throw new Error("call succeeded");
}

function isReceiptSource(value: unknown): value is { wait: () => Promise<unknown> } {
  return typeof value === "object" && value !== null && "wait" in value;
}

function payload(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const data = (error as { data?: unknown }).data;
  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    return data;
  }
  return undefined;
}

function createEvent(world: World, obligation: string, id: string): ClaimEvent {
  return {
    eventType: "Create",
    eventId: id,
    expectedVersion: 0n,
    signers: [{ role: "supplier", account: world.supplier.address }],
    obligationId: obligation,
    termsRoot: TERMS,
    fingerprint: FINGERPRINT,
    amountCommitment: AMOUNT,
    buyer: world.buyer.address,
    supplier: world.supplier.address,
    paymentAgent: world.paymentAgent.address,
    scheduledExecutor: world.executor.address,
    dueDate: DUE,
  };
}

async function create(world: World, obligation: string): Promise<void> {
  const id = eventId();
  const event = createEvent(world, obligation, id);
  const tx = await world.kernel.create(
    obligation,
    TERMS,
    FINGERPRINT,
    AMOUNT,
    world.buyer.address,
    world.supplier.address,
    world.paymentAgent.address,
    world.executor.address,
    DUE,
    id,
    0n,
    sign(world.supplier, world, event, obligation),
  );
  await tx.wait();
}

async function acknowledge(world: World, obligation: string, version: bigint): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "Acknowledge",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "buyer", account: world.buyer.address }],
    termsRoot: TERMS,
  };
  const tx = await world.kernel.acknowledge(
    obligation,
    TERMS,
    id,
    version,
    sign(world.buyer, world, event, obligation),
  );
  await tx.wait();
}

function activateEvent(world: World, holder: HDNodeWallet, id: string, version: bigint): ClaimEvent {
  return {
    eventType: "Activate",
    eventId: id,
    expectedVersion: version,
    signers: [
      { role: "supplier", account: world.supplier.address },
      { role: "factor", account: holder.address },
    ],
    factor: holder.address,
  };
}

function sendActivate(world: World, obligation: string, holder: HDNodeWallet, id: string, version: bigint) {
  const event = activateEvent(world, holder, id, version);
  return world.kernel.activate(
    obligation,
    holder.address,
    id,
    version,
    sign(world.supplier, world, event, obligation),
    sign(holder, world, event, obligation),
  );
}

async function acknowledged(world: World): Promise<string> {
  const obligation = freshObligation();
  await create(world, obligation);
  await acknowledge(world, obligation, 1n);
  return obligation;
}

async function reserved(world: World): Promise<string> {
  const obligation = await acknowledged(world);
  const version = (await read(world, obligation)).version;
  const id = eventId();
  const tx = await sendActivate(world, obligation, world.factor, id, version);
  await tx.wait();
  return obligation;
}

async function creditNote(
  world: World,
  obligation: string,
  version: bigint,
  termsRoot: string,
  amountCommitment: string,
  id = eventId(),
): Promise<void> {
  const event: ClaimEvent = {
    eventType: "CreditNote",
    eventId: id,
    expectedVersion: version,
    signers: [
      { role: "buyer", account: world.buyer.address },
      { role: "supplier", account: world.supplier.address },
    ],
    termsRoot,
    amountCommitment,
  };
  const tx = await world.kernel.creditNote(
    obligation,
    termsRoot,
    amountCommitment,
    id,
    version,
    sign(world.buyer, world, event, obligation),
    sign(world.supplier, world, event, obligation),
  );
  await tx.wait();
}

async function openDispute(world: World, obligation: string, version: bigint): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "OpenDispute",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "buyer", account: world.buyer.address }],
    evidenceHash: EVIDENCE,
  };
  const tx = await world.kernel.openDispute(
    obligation,
    EVIDENCE,
    id,
    version,
    sign(world.buyer, world, event, obligation),
  );
  await tx.wait();
}

async function cureDispute(world: World, obligation: string, version: bigint): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "CureDispute",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "buyer", account: world.buyer.address }],
    evidenceHash: EVIDENCE,
  };
  const tx = await world.kernel.cureDispute(
    obligation,
    EVIDENCE,
    id,
    version,
    sign(world.buyer, world, event, obligation),
  );
  await tx.wait();
}

async function allocate(world: World, obligation: string, version: bigint, settles: boolean): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "AllocatePayment",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "paymentAgent", account: world.paymentAgent.address }],
    settles,
    paymentHash: PAYMENT,
  };
  const tx = await world.kernel.allocatePayment(
    obligation,
    settles,
    PAYMENT,
    id,
    version,
    sign(world.paymentAgent, world, event, obligation),
  );
  await tx.wait();
}

async function markDelinquent(
  world: World,
  obligation: string,
  version: bigint,
  observedAt: bigint,
): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "MarkDelinquent",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "scheduledExecutor", account: world.executor.address }],
    observedAt,
  };
  const tx = await world.kernel.markDelinquent(
    obligation,
    observedAt,
    id,
    version,
    sign(world.executor, world, event, obligation),
  );
  await tx.wait();
}

async function declareDefault(world: World, obligation: string, version: bigint): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "DeclareDefault",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "factor", account: world.factor.address }],
    evidenceHash: EVIDENCE,
  };
  const tx = await world.kernel.declareDefault(
    obligation,
    EVIDENCE,
    id,
    version,
    sign(world.factor, world, event, obligation),
  );
  await tx.wait();
}

async function settled(world: World): Promise<string> {
  const obligation = await reserved(world);
  const version = (await read(world, obligation)).version;
  await allocate(world, obligation, version, true);
  return obligation;
}

async function delinquent(world: World): Promise<string> {
  const obligation = await reserved(world);
  const version = (await read(world, obligation)).version;
  await markDelinquent(world, obligation, version, DUE + 1n);
  return obligation;
}

async function releaseByFactor(world: World, obligation: string, version: bigint): Promise<void> {
  const id = eventId();
  const event: ClaimEvent = {
    eventType: "Release",
    eventId: id,
    expectedVersion: version,
    signers: [{ role: "factor", account: world.factor.address }],
  };
  const tx = await world.kernel.release(
    obligation,
    id,
    version,
    sign(world.factor, world, event, obligation),
  );
  await tx.wait();
}
