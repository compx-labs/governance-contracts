export type ProposalIdType = { nonce: uint64; proposalType: string };

/**
 * Represents a unique key for identifying validator pool entries.
 *
 * @typedef {object} ProposalDataType
 * @property {string} poposalTitle - Title of the proposal.
 * @property {string} ProposalDescription - Description of the proposal.
 * @property {uint64} ProposalTotalVotes - Total votes on this proposal.
 * @property {uint64} ProposalYesVotes - Description of the proposal.
 * @property {uint64} CreatedAtTimestamp - Description of the proposal.
 * @property {uint64} ExpiryTimestamp - Description of the proposal.
 */
export type ProposalDataType = {
  proposalTitle: string;
  proposalDescription: string;
  ProposalTotalVotes: uint64;
  ProposalYesVotes: uint64;
  CreatedAtTimestamp: uint64;
  ExpiryTimestamp: uint64;
};
