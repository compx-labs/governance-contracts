/**
 * Defines the proposal box Ids
 * @typedef
 * @property {uint64}
 */

export type ProposalIdType = { nonce: uint64 };

/**
 * Reprensents the Proposal Data Object
 *
 * @typedef {object} ProposalDataType
 * @property {string} poposalTitle - Title of the proposal.
 * @property {string} proposalDescription - Description of the proposal.
 * @property {uint64} proposalTotalVotes - Total votes on this proposal.
 * @property {uint64} proposalYesVotes - Total yes votes on this proposal.
 * @property {uint64} proposalTotalPower - Total governance power on this proposal.
 * @property {uint64} proposalYesPower - Total governance power on this proposal.
 * @property {uint64} createdAtTimestamp - Timestamp the proposal was created.
 * @property {uint64} expiryTimestamp - When the proposal will expire.
 */

export type ProposalDataType = {
  proposalTitle: string;
  proposalDescription: string;
  proposalTotalVotes: uint64;
  proposalYesVotes: uint64;
  proposalTotalPower: uint64;
  proposalYesPower: uint64;
  createdAtTimestamp: uint64;
  expiryTimestamp: uint64;
};

/**
 * Defines the vote box Ids
 * @typedef {object} ProposalVoteIdType
 * @property {ProposalIdType} proposalId
 * @property {Address} voterAddress
 */

export type ProposalVoteIdType = { proposalId: ProposalIdType; voterAddress: Address };

/**
 * Reprensents the Proposal Data Object
 *
 * @typedef {object} ProposalVoteDataType
 * @property {uint64} voteTimestamp - Who voted to the given proposal
 */

export type ProposalVoteDataType = {
  voteTimestamp: uint64;
  votingPower: uint64;
};
