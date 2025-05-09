import { Account, arc4 } from '@algorandfoundation/algorand-typescript';

// ProposalIdType: a struct with a single uint64 field
export class ProposalIdType extends arc4.Struct<{
  nonce: arc4.UintN64;
}> {}

// ProposalDataType: a struct with string and uint64 fields
export class ProposalDataType extends arc4.Struct<{
  proposalTitle: arc4.Str;
  proposalDescription: arc4.Str;
  proposalTotalVotes: arc4.UintN64;
  proposalYesVotes: arc4.UintN64;
  proposalTotalPower: arc4.UintN64;
  proposalYesPower: arc4.UintN64;
  createdAtTimestamp: arc4.UintN64;
  expiryTimestamp: arc4.UintN64;
}> {}

// ProposalVoteIdType: a struct with a nested ProposalIdType and an address
export class ProposalVoteIdType extends arc4.Struct<{
  proposalId: ProposalIdType;
  voterAddress: Account;
}> {}

// ProposalVoteDataType: a struct with uint64 fields
export class ProposalVoteDataType extends arc4.Struct<{
  voteTimestamp: arc4.UintN64;
  votingPower: arc4.UintN64;
}> {}
