// This file is auto-generated. Do not edit manually.
// Generated from config/network.json for network: {{network}}
// Last generated: {{timestamp}}

import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

export class ContractConstants {
  static readonly PDPVerifierAddress: Address = Address.fromBytes(
    Bytes.fromHexString("{{PDPVerifier.address}}")
  );
  static readonly MaxProvingPeriod: BigInt = BigInt.fromString(
    "{{FWSS.maxProvingPeriod}}"
  );
  static readonly ChallengeWindowSize: BigInt = BigInt.fromString(
    "{{FWSS.challengeWindowSize}}"
  );
}
