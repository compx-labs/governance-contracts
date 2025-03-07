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
 * @property {uint64} proposalType - Type of the proposal
 * @property {string} poposalTitle - Title of the proposal.
 * @property {string} ProposalDescription - Description of the proposal.
 * @property {uint64} ProposalTotalVotes - Total votes on this proposal.
 * @property {uint64} ProposalYesVotes - Total yes votes on this proposal.
 * @property {uint64} CreatedAtTimestamp - Timestamp the proposal was created.
 * @property {uint64} expiryTimestamp - When the proposal will expire.
 */

export type ProposalDataType = {
  proposalType: uint64;
  proposalTitle: string;
  proposalDescription: string;
  proposalTotalVotes: uint64;
  proposalYesVotes: uint64;
  createdAtTimestamp: uint64;
  expiryTimestamp: uint64;
};

/**
 * Defines the vote box Ids
 * @typedef
 * @property {ProposalIdType} proposalId
 * @property {Address} voter
 */

export type ProposalVoteIdType = { proposalId: ProposalIdType; voter: Address };

/**
 * Reprensents the Proposal Data Object
 *
 * @typedef {object} ProposalVoteDataType
 * @property {Address} voterAddress - Who voted to the given proposal
 * @property {uint64} voteTimestamp - Who voted to the given proposal
 */

export type ProposalVoteDataType = {
  voteTimestamp: uint64;
};
